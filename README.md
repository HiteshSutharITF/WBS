# WBS — WhatsApp Business Solution (Version 1.0)

WBS (WhatsApp Business Solution) is a multi-tenant enterprise messaging and lead tracking platform built on the official **WhatsApp Business Platform (Cloud API v25.0)** using the **MERN Stack** (MongoDB, Express, React + Vite, Node.js + Tailwind CSS).

The platform features **two completely separate frontend applications** for total separation of concerns, zero code leakage, and strict compliance with the **MERN Stack Development SOP**, **WLTS PRD**, and **Developer Handover Specifications**.

---

## 🏛️ System Architecture: Two Independent Frontends

```
whatshaap assistent/
├── backend/                  # Express + Mongoose + Socket.io Server (Port 5000)
│   ├── config/               # Database, env loader, and Socket.io setup
│   ├── controllers/          # Module-wise business logic
│   ├── middleware/           # JWT auth, tenant isolation, Multer, error handler
│   ├── models/               # Mongoose schemas
│   │   └── zindex.js         # MANDATORY SOP: All models exported here
│   ├── routes/               # Module-wise route declarations
│   ├── uploads/              # Module-wise uploads (media, templates, avatars, imports)
│   ├── utils/                # Centralized response formatter, crypto, Meta API client
│   ├── validations/          # Request schema validation
│   └── public/               # Production Builds Directory
│       ├── admin/            # Super Admin Console Build (Served at /admin/)
│       └── index.html        # Client Portal Build (Served at /)
│
├── frontend-client/          # Dedicated Client Business Application (Port 5173)
│   ├── src/
│   │   ├── pages/            # Login, Register, Dashboard, Onboarding, Inbox, Contacts, Templates, Broadcasts, Chatbot, Team, Settings
│   │   ├── services/         # SOP: All API calls managed here
│   │   ├── components/       # SOP-compliant Modals, Inputs, Buttons, Badges, Alerts
│   │   └── utils/            # Socket.io client, formatters
│   └── vite.config.js        # Builds to backend/public/
│
└── frontend-admin/           # Dedicated Super Admin Console (Port 5174)
    ├── src/
    │   ├── pages/            # Staff Login, Platform Diagnostics, Clients/Tenants, Health Alerts, Audit Trail
    │   ├── services/         # SOP: Admin API client and services
    │   ├── components/       # Dark console UI components
    │   └── utils/            # Formatters
    └── vite.config.js        # Base /admin/, builds to backend/public/admin/
```

---

## 🚀 Key Modules (Version 1)

### 1. Client Business Portal (`frontend-client/`)
- **WhatsApp Embedded Signup & Onboarding (v4)**:
  - Official Meta Embedded Signup popup integration (`FB.login` with App ID `1075294524979498` & Config ID `4546265418941622`).
  - 30-second token exchange (`GET /oauth/access_token`), automatic app webhook subscription, and 6-digit registration PIN.
  - Dual-Mode Connection: Live Meta Cloud API and Built-in Instant Sandbox Mode (pre-configured with test number `+1 555 672 2362`).
  - AES-256-GCM token and PIN encryption at rest.
- **Team Inbox & Real-Time WhatsApp Chats**:
  - Two-way messaging powered by **Socket.io** and Meta Webhook ingestion.
  - **24-Hour Customer Window Compliance**: Active countdown badge; automatically locks free-form reply and prompts an approved template picker when expired.
  - Rich media sending: Images and documents uploaded via Multer.
  - Agent assignment, internal CRM notes, and human hand-off toggles.
- **Template Management & Meta Approval**:
  - Visual template builder for Marketing, Utility, and Authentication categories.
  - Dynamic parameter interpolation (`{{1}}`, `{{2}}`), text/image headers, footers, and interactive CTA buttons.
  - Interactive WhatsApp bubble live preview and status sync with Meta Cloud API (`APPROVED`, `PENDING`, `REJECTED`).
- **Broadcast Campaigns**:
  - Targeted campaign creation with audience segmentation by tags.
  - Dynamic template variable mapping to contact fields (e.g. `{{1}}` &rarr; name).
  - Rate-limited queue processing respecting Meta messaging tiers and opt-in status.
  - Real-time delivery analytics (sent, delivered, read, failed).
- **CRM Leads & Contact Profiling**:
  - Keyed on BSUID and phone number.
  - Pipeline stages: `New` &rarr; `Engaged` &rarr; `Qualified` &rarr; `Handed Off` &rarr; `Converted` &rarr; `Lost`.
  - CSV import with mandatory opt-in compliance checkbox.
  - Automatic opt-out processing when contacts reply "STOP" or "UNSUBSCRIBE" (PL-02).
- **Chatbot Automation & Human Hand-Off**:
  - Working hours configuration with automated Welcome and Away responses.
  - Keyword rule engine (Exact, Contains, Starts With).
  - **Human Hand-off**: Automatically pauses bot responses for that conversation, notifies human agent, and updates lead stage.

### 2. Super Admin Console (`frontend-admin/`)
- **Global Platform Diagnostics**: Total clients, active clients, message volume, failed counts.
- **Meta Rolling 7-Day Velocity Tracking**: Real-time progress bar monitoring onboarding velocity against Meta's cap of 200 (SA-08).
- **Client Management**: View quality ratings (`GREEN`/`YELLOW`/`RED`), messaging tiers (`TIER_250`, `TIER_10K`), suspend / reactivate clients.
- **Token Health Alerts**: Proactive alert system warning when client access tokens expire within 7 days.
- **Tamper-Proof Audit Trail (SA-09)**: Append-only log of staff actions.
- **Strict Privacy Compliance (NF-09)**: Zero display of client message content.

---

## 🔑 Pre-Seeded Credentials

Run `npm run seed` anytime to populate initial demo accounts:

| Role | Email | Password | Access / Panel |
|---|---|---|---|
| **Super Admin** | `superadmin@itfuturz.com` | `SuperAdmin@123` | Super Admin Console (`http://localhost:5000/admin/`) |
| **Client Admin** | `admin@acmeretail.com` | `Admin@123` | Client Business Panel (`http://localhost:5000/`) |
| **Client Agent** | `agent@acmeretail.com` | `Agent@123` | Agent Inbox (`http://localhost:5000/inbox`) |

---

## 🛠️ Quickstart & Development Guide

### 1. Production Mode (Single Backend Serving Both Frontends)
```bash
# Start backend server
npm start
```
- **Client Portal**: `http://localhost:5000/`
- **Super Admin Console**: `http://localhost:5000/admin/`
- **Backend API Health**: `http://localhost:5000/api/health`

### 2. Development Mode (Independent Hot-Reloading Servers)
```bash
# Terminal 1: Backend API & Socket Server (Port 5000)
npm run dev:backend

# Terminal 2: Client Portal (Port 5173)
npm run dev:client

# Terminal 3: Super Admin Console (Port 5174)
npm run dev:admin
```

### 3. Rebuild Both Frontends for Production
```bash
npm run build
```
*(Compiles `frontend-client` into `backend/public/` and `frontend-admin` into `backend/public/admin/`)*
