# WB Assistant — How a New Client Is Onboarded

**Prepared by Parth Varma · I T FUTURZ · 21 September 2026**

Answers the development team's questions: what a new client needs, the exact steps, which Meta APIs
are called, how we know "this is client 1", and which APIs feed the dashboard.
Checked against Meta's official Embedded Signup and Tech Provider documentation (links at the end).

---

## 1. The key idea

**We never create the client's WhatsApp account and we never take their Facebook password.**

The client logs in to **our** dashboard with **our** email + password. Inside our dashboard they click
**Connect WhatsApp**, which opens Meta's own popup (Embedded Signup). In that popup they log in with
**their own Facebook account** and connect **their own number**. Meta then hands our server the IDs and a
token for that client's account.

So "client 1" is simply **our own database row** (`tenant_id = 1`) that clicked Connect. We attach the
WhatsApp IDs Meta returns to that row.

```
Our dashboard (our login)          Meta popup (client's own Facebook)          Our server
─────────────────────────          ──────────────────────────────────          ──────────
1. Client signs up  ──► tenant 1
2. Clicks "Connect WhatsApp" ──►   3. Logs in to Facebook
                                   4. Picks / creates business portfolio
                                   5. Creates WhatsApp Business Account
                                   6. Adds phone number, enters OTP
                                   7. Sets display name, approves access
                                   ──► returns waba_id, phone_number_id,
                                       business_id  +  one-time code  ──────►  8. Exchange code → token
                                                                                9. Subscribe webhooks
                                                                               10. Register number (PIN)
                                                                               11. Fetch details, save
                                                                                   against tenant 1
12. Client sees "Connected ✓" ◄──────────────────────────────────────────────
```

---

## 2. What the client needs before starting

| Item | Notes |
|---|---|
| An account on **our** dashboard | Email + password we store (hashed). This is the only login we own |
| **Their own** Facebook account | Personal Facebook login of the business owner/manager. We never see or store it |
| A Meta business portfolio | Existing one, or created inside the popup |
| A phone number for WhatsApp | Must be able to receive an **SMS or voice OTP**. If the number is already on the WhatsApp Business **app**, Embedded Signup can onboard it in coexistence mode; if it is on normal consumer WhatsApp, the client must delete that WhatsApp account from the number first |
| Business details | Business name, website, category — asked in the popup |
| A payment method (after onboarding) | Added by the client in WhatsApp Manager: https://business.facebook.com/wa/manage/home/ — Meta bills them directly |

**Can we onboard a client from our side?** Yes — onboarding always starts from our dashboard. For
non-technical clients, our support can sit with them on a call and guide them through the popup, but the
**client** clicks through and logs in with their own Facebook. Never ask a client for their Facebook
password or their OTP.

---

## 3. What we need (already have)

| Item | Value / where |
|---|---|
| App ID | `1075294524979498` |
| Configuration ID | `4546265418941622` (Facebook Login for Business configuration) |
| Graph API version | `v25.0` |
| App Secret | Server `.env` only — used in the code exchange (step 8) |
| Domain | `https://wbassistant.itfuturz.cloud` — must be in App domains and Facebook Login allowed domains |
| Webhook | `https://wbassistant.itfuturz.cloud/webhook` configured in the Meta app |
| App status | Published (Live) — required for outside clients |

---

## 4. Step by step with the exact calls

### Step 1 — Client signs up on our dashboard
Our own code. Creates `tenants` row (id = 1) and a `users` row (role `client_admin`). No Meta call.

### Step 2–7 — Embedded Signup popup (frontend)

Load the SDK and init:

```html
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
```
```js
window.fbAsyncInit = function () {
  FB.init({ appId: '1075294524979498', autoLogAppEvents: true, xfbml: true, version: 'v25.0' });
};
```

Listen for the result **before** opening the popup:

```js
let signup = {};   // filled by the message event

window.addEventListener('message', (event) => {
  if (!event.origin.endsWith('facebook.com')) return;      // security: only trust Facebook
  try {
    const data = JSON.parse(event.data);
    if (data.type !== 'WA_EMBEDDED_SIGNUP') return;
    if (data.event === 'FINISH') {
      signup = {
        waba_id: data.data.waba_id,
        phone_number_id: data.data.phone_number_id,
        business_id: data.data.business_id,
      };
    } else if (data.event === 'CANCEL') {
      showMessage('Setup not finished. Stopped at: ' + data.data.current_step);
    } else if (data.event === 'ERROR') {
      showMessage('Meta reported an error: ' + JSON.stringify(data.data));
    }
    // Other events exist: FINISH_ONLY_WABA, FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING, etc.
    // Handle FINISH_ONLY_WABA (account created but no number yet) as "partially connected".
  } catch (_) { /* non-JSON messages from Facebook: ignore */ }
});
```

Open the popup:

```js
function connectWhatsApp() {
  FB.login(onLogin, {
    config_id: '4546265418941622',
    response_type: 'code',
    override_default_response_type: true,
    extras: { setup: {} },
  });
}

async function onLogin(response) {
  if (!response.authResponse || !response.authResponse.code) {
    return showMessage('Connection cancelled.');
  }
  // The code expires in 30 SECONDS — send it to our server immediately.
  await fetch('/api/onboarding/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',                    // our login session identifies the tenant
    body: JSON.stringify({ code: response.authResponse.code, ...signup }),
  });
}
```

> Confirm the `extras` options against the v4 page before launch — Meta changes them between versions.

### Step 8 — Exchange the code for the client's business token (server)

**The code lives for 30 seconds.** Do this first, before anything else.

```
GET https://graph.facebook.com/v25.0/oauth/access_token
    ?client_id=1075294524979498
    &client_secret=<APP_SECRET>
    &code=<CODE>
```
Response contains `access_token` — the **business token** for this client. Encrypt and store it
against the tenant from the logged-in session (tenant 1). Never send it to the browser.

### Step 9 — Subscribe our app to the client's webhooks

```
POST https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps
Authorization: Bearer <BUSINESS_TOKEN>
→ {"success": true}
```
Without this, the client's incoming messages never reach our webhook.

### Step 10 — Register the number for Cloud API

```
POST https://graph.facebook.com/v25.0/<PHONE_NUMBER_ID>/register
Authorization: Bearer <BUSINESS_TOKEN>
Content-Type: application/json

{ "messaging_product": "whatsapp", "pin": "<6-digit PIN we generate>" }
→ {"success": true}
```
Store the PIN encrypted. It is the number's two-step verification PIN.

### Step 11 — Fetch the details and save them

```
GET https://graph.facebook.com/v25.0/<PHONE_NUMBER_ID>
    ?fields=display_phone_number,verified_name,status,quality_rating,
            code_verification_status,account_mode,is_official_business_account,
            whatsapp_business_manager_messaging_limit
Authorization: Bearer <BUSINESS_TOKEN>

GET https://graph.facebook.com/v25.0/<WABA_ID>?fields=name,currency,timezone_id
Authorization: Bearer <BUSINESS_TOKEN>
```
Save into `waba_accounts` with `tenant_id = 1`. Mark tenant 1 **connected**.

### Step 12 — Tell the client what's next
Show: connected number, display name, quality rating, messaging limit — and a banner:
**"Add a payment method in WhatsApp Manager so you can send template messages."**

Optional test: send a text to the client's own mobile from the new number
(`POST /<PHONE_NUMBER_ID>/messages`) after they message it first (24-hour window).

---

## 5. Server code outline for `/api/onboarding/complete`

```ts
router.post('/api/onboarding/complete', requireLogin('client_admin'), async (req, res) => {
  const tenantId = req.user.tenantId;               // ← THIS is how we know it's client 1
  const { code, waba_id, phone_number_id, business_id } = req.body;

  // 8. exchange immediately (30-second code)
  const token = await exchangeCode(code);          // GET /oauth/access_token
  // Safety: confirm the token really covers this WABA (see section 6, debug_token)
  await assertTokenCoversWaba(token, waba_id);

  await saveEncryptedToken(tenantId, waba_id, phone_number_id, business_id, token);

  // 9–11, each idempotent so a retry is safe
  await subscribeApp(waba_id, token);              // POST /{waba}/subscribed_apps
  const pin = generatePin();
  await registerNumber(phone_number_id, pin, token);  // POST /{phone}/register
  await savePinEncrypted(tenantId, pin);
  const details = await fetchPhoneDetails(phone_number_id, token);
  await saveDetails(tenantId, details);
  await markConnected(tenantId);

  audit('client_connected', { tenantId, waba_id, phone_number_id });
  res.json({ connected: true, number: details.display_phone_number, name: details.verified_name });
});
```

Never log `code`, `token` or `pin`.

---

## 6. "How do we know this is client 1?"

Three layers, in order of importance:

1. **Our login session.** The Connect button is only on a logged-in tenant's page. The server takes
   `tenant_id` from the session, **never** from the request body.
2. **Our database link.** After step 8, `waba_accounts` stores `tenant_id = 1` with `waba_id`,
   `phone_number_id`, `business_id`. From then on:
   - dashboard → look up by `tenant_id`
   - incoming webhook → look up by `phone_number_id` (or `waba_id`) → gives `tenant_id = 1`
3. **Meta's confirmation.** `debug_token` shows which WABAs the token actually has access to — use it to
   reject a tampered `waba_id`:

```
GET https://graph.facebook.com/v25.0/debug_token
    ?input_token=<BUSINESS_TOKEN>
    &access_token=1075294524979498|<APP_SECRET>
```
Check that `waba_id` appears in the returned `granular_scopes` target IDs, and read `expires_at`
for the token-expiry job.

**Uniqueness rule:** a `waba_id` / `phone_number_id` can belong to only one tenant. If a second
tenant tries to connect a number already linked, stop and show an error.

---

## 7. Which APIs feed our dashboards

**Rule: the dashboard reads from our database, not from Meta on every page load.** Meta data is
fetched at onboarding, kept fresh by webhooks, and re-checked by a background job.

| Dashboard shows | Source | How it stays fresh |
|---|---|---|
| Client list, plan, status | Our DB (`tenants`) | Our own data |
| Connected number, display name | `GET /{PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,status` | Account/phone webhooks + daily job |
| Quality rating | `quality_rating` field | Phone quality webhook + daily job |
| Messaging limit | `whatsapp_business_manager_messaging_limit` field (**not** the deprecated `messaging_limit_tier`) | Daily job |
| Token expiry | `debug_token` → `expires_at` | Daily token job |
| Business profile (about, address, website, photo) | `GET /{PHONE_NUMBER_ID}/whatsapp_business_profile` | On edit + daily job |
| Templates and their status | `GET /{WABA_ID}/message_templates` | Template status webhook |
| Messages, delivery, read, failed | Our DB, written by the webhook handler | Real time from webhooks |
| Message counts, analytics | Our DB | Calculated from stored messages |

**Super Admin panel** = the same tables across **all** tenants.
**Client panel** = the same tables filtered to **that client's** `tenant_id`.

---

## 8. Test it before any real client

1. Developer creates a test tenant on our dashboard ("Client 1 — Test")
2. Uses **their own Facebook account** and a **spare SIM** that is not on WhatsApp
   (the Meta `+1 555` test number cannot be used for Embedded Signup)
3. Runs the full popup; confirms the server log shows steps 8–11 succeeding
4. Sends a WhatsApp message from a personal phone to the new number → it appears in tenant 1's inbox
5. Creates tenant 2 with another spare SIM → confirms tenant 1 and tenant 2 see only their own data

---

## 9. Things that commonly go wrong

| Problem | Cause |
|---|---|
| Code exchange fails with "code expired" | Code not sent to the server within 30 seconds |
| Popup blocked or blank | Domain not in App domains / Facebook Login allowed domains, or not HTTPS |
| Connected but no incoming messages | Step 9 (`subscribed_apps`) skipped, or webhook URL not set in the Meta app |
| Cannot send templates | Client hasn't added a payment method yet |
| Number rejected in the popup | Number still active on consumer WhatsApp |
| Outside clients can't connect | Meta app not Published |
| Messaging limit field empty | Using deprecated `messaging_limit_tier` |

---

## Sources

- Embedded Signup implementation — https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
- Onboarding customers as a Tech Provider — https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider
- Phone number management API — https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/phone-number-management-api
- Messaging limits — https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
