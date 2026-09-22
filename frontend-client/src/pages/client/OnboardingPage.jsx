import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Zap,
  Info,
  Building2,
  Lock,
  ArrowRight,
  Shield,
  KeyRound,
  Check,
  Smartphone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { tenantService } from '../../services/tenantService';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import { formatDate } from '../../utils/formatters';

const OnboardingPage = () => {
  const [profile, setProfile] = useState(null);
  const [waba, setWaba] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);

  // Signup data captured from Meta's postMessage (WA_EMBEDDED_SIGNUP)
  const signupDataRef = useRef({
    waba_id: '1098394529543443',
    phone_number_id: '1281664778368035',
    business_id: '442667213703747'
  });

  // Direct Meta Credentials state (for direct connect with Meta System User / Developer Token)
  const [directForm, setDirectForm] = useState({
    waba_id: '1098394529543443',
    phone_number_id: '1281664778368035',
    business_id: '442667213703747',
    direct_token: ''
  });

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await tenantService.getProfile();
      setProfile(res.data?.tenant);
      setWaba(res.data?.wabaAccount);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Exchange code helper
  const handleExchangeCode = async (codeParam) => {
    setConnecting(true);
    setErrorMsg('');
    try {
      const res = await tenantService.completeOnboarding({
        code: codeParam,
        redirect_uri: `${window.location.origin}/onboarding`,
        waba_id: signupDataRef.current.waba_id,
        phone_number_id: signupDataRef.current.phone_number_id,
        business_id: signupDataRef.current.business_id
      });
      setSuccessMsg(res.message || 'WhatsApp Business Account successfully connected!');
      loadProfile();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete Meta token exchange.');
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    loadProfile();

    // 1. Listen for Meta's Embedded Signup postMessage events as documented in client-onboarding-flow.md
    const handleMetaMessage = (event) => {
      // Handle OAuth popup callback from our own origin
      if (event.data?.type === 'META_AUTH_CODE' && event.data.code) {
        handleExchangeCode(event.data.code);
        return;
      }

      // Security: verify origin ends with facebook.com
      if (!event.origin || !event.origin.endsWith('facebook.com')) return;

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type !== 'WA_EMBEDDED_SIGNUP') return;

        if (data.event === 'FINISH') {
          signupDataRef.current = {
            waba_id: data.data?.waba_id || signupDataRef.current.waba_id,
            phone_number_id: data.data?.phone_number_id || signupDataRef.current.phone_number_id,
            business_id: data.data?.business_id || signupDataRef.current.business_id
          };
        } else if (data.event === 'CANCEL') {
          setErrorMsg(`Setup not finished. Stopped at: ${data.data?.current_step || 'cancelled by user'}`);
          setConnecting(false);
        } else if (data.event === 'ERROR') {
          setErrorMsg(`Meta reported an error: ${JSON.stringify(data.data)}`);
          setConnecting(false);
        }
      } catch (_) {
        // Non-JSON messages from Facebook: ignore safely
      }
    };

    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, []);

  // 2. Handle Meta OAuth redirect with ?code=... in query params
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = window.location.hash.includes('?')
      ? new URLSearchParams(window.location.hash.split('?')[1])
      : new URLSearchParams();
    const codeParam = searchParams.get('code') || hashParams.get('code');
    if (codeParam) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
      handleExchangeCode(codeParam);
    }
  }, []);

  // Primary: Connect WhatsApp with Meta (Official Embedded Signup v4)
  const handleConnectWhatsApp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setConnecting(true);

    // If on HTTPS, launch the official Meta FB.login popup
    if (isHttps && typeof window.FB !== 'undefined') {
      try {
        window.FB.login(
          async (response) => {
            if (response.authResponse && response.authResponse.code) {
              handleExchangeCode(response.authResponse.code);
            } else {
              setErrorMsg('Meta Facebook Login was closed or did not return an authorization code.');
              setConnecting(false);
            }
          },
          {
            config_id: '4546265418941622',
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {} }
          }
        );
        return;
      } catch (err) {
        setConnecting(false);
        setErrorMsg(`Meta FB.login error: ${err.message}`);
      }
    }

    // Direct Meta OAuth dialog in popup window (clean redirect_uri with no URL fragment)
    try {
      const redirectUri = `${window.location.origin}/onboarding`;
      const metaOAuthUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=1075294524979498&config_id=4546265418941622&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
      const popup = window.open(metaOAuthUrl, 'MetaEmbeddedSignup', 'width=650,height=750,scrollbars=yes');

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup was blocked by browser
        setShowManualForm(true);
        setErrorMsg('Meta popup window was blocked by your browser. Please allow popups or use direct credentials below.');
        setConnecting(false);
        return;
      }

      // Check if popup closes or provides code
      const checkPopup = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          setConnecting(false);
        }
      }, 1000);
    } catch (err) {
      setConnecting(false);
      setShowManualForm(true);
      setErrorMsg(`Could not launch Meta popup: ${err.message}. You can connect directly using Meta credentials.`);
    }
  };

  // Direct Meta Credentials submission (for direct connect with Meta System User / Developer Token)
  const handleDirectConnect = async (e) => {
    if (e) e.preventDefault();
    if (!directForm.direct_token) {
      setErrorMsg('Please enter a valid Meta Business Access Token or System User Token.');
      return;
    }

    setConnecting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await tenantService.completeOnboarding(directForm);
      setSuccessMsg(res.message || 'WhatsApp Business Account successfully connected!');
      loadProfile();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this WhatsApp number? Inbound and outbound messages will cease.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await tenantService.disconnectWhatsApp();
      setSuccessMsg(res.message);
      loadProfile();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connect WhatsApp with Meta</h1>
          <p className="text-sm text-slate-500 mt-1">
            Official Meta Embedded Signup (Tech Provider direct integration). Connect your WhatsApp number in under 2 minutes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isHttps ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock className="w-3.5 h-3.5" /> HTTPS Secure (Live Meta Active)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Shield className="w-3.5 h-3.5" /> Meta Graph API v25.0
            </span>
          )}
        </div>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} />}
      {successMsg && <Alert type="success" message={successMsg} />}

      {/* Connected State View */}
      {waba && waba.status === 'connected' ? (
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-6 md:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{waba.verifiedName || 'Business WhatsApp'}</h3>
                  <Badge variant="green">Connected</Badge>
                </div>
                <p className="text-base font-semibold text-slate-700 mt-0.5">{waba.displayPhoneNumber}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Phone ID: {waba.phoneNumberId} &bull; WABA ID: {waba.wabaId}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={loadProfile} icon={RefreshCw}>
                Refresh Health
              </Button>
              <Button variant="danger" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>

          {/* Diagnostic Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quality Rating</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-3 h-3 rounded-full ${
                    waba.qualityRating === 'GREEN'
                      ? 'bg-emerald-500'
                      : waba.qualityRating === 'YELLOW'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="font-bold text-slate-900">{waba.qualityRating}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">High delivery trust score</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Messaging Tier</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{waba.messagingLimit}</p>
              <p className="text-xs text-slate-500 mt-1">Shared business portfolio limit</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Token Expiry</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{formatDate(waba.tokenExpiresAt)}</p>
              <p className="text-xs text-emerald-600 mt-1">Encrypted AES-256 &bull; Monitored</p>
            </div>
          </div>

          {/* Important Payment Notice per PRD */}
          <div className="mt-6 p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold mb-0.5">Meta Direct Billing Requirement</p>
              <p>
                As an official Meta Tech Provider, ITFuturz charges software subscription only. Outbound conversation charges are billed directly by Meta to your own credit card. Add your payment method in{' '}
                <a
                  href="https://business.facebook.com/wa/manage/home/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline text-amber-950 inline-flex items-center gap-1"
                >
                  WhatsApp Business Manager <ExternalLink className="w-3 h-3" />
                </a>{' '}
                before sending marketing campaigns or templates.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Not Connected: Official Meta Onboarding Card */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Main Hero Callout */}
          <div className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">Direct WhatsApp Onboarding with Meta</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Connect your business phone number directly using Meta Embedded Signup. You log in with your own Facebook account and verify your business phone via SMS or phone call OTP.
                </p>
              </div>
            </div>

            {/* Prerequisites from client-onboarding-flow-in-simple-words.txt */}
            <div className="mt-6 p-5 bg-slate-50/80 rounded-xl border border-slate-200/70">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                What you need before connecting:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Your Facebook Account:</strong> You log in directly inside Meta's popup. Our platform never sees or stores your password.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Business Phone Number:</strong> Must be able to receive an SMS or voice OTP. If on regular WhatsApp, delete that account first.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Meta Business Portfolio:</strong> Pick an existing business portfolio or create one right inside the popup.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Payment Method:</strong> Add your credit card in WhatsApp Manager after connecting to pay Meta for outbound messages.
                  </div>
                </div>
              </div>
            </div>

            {/* Meta Configuration Details */}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <div>Meta App ID: <span className="font-mono font-semibold text-slate-700">1075294524979498</span></div>
              <div>Config ID: <span className="font-mono font-semibold text-slate-700">4546265418941622</span></div>
              <div>Graph API: <span className="font-mono font-semibold text-slate-700">v25.0 (Latest)</span></div>
              <div>Status: <span className="font-semibold text-emerald-600">Published (Live)</span></div>
            </div>

            {/* Primary Action Button */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
              <Button
                variant="whatsapp"
                size="lg"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold shadow-md shadow-emerald-500/10"
                onClick={handleConnectWhatsApp}
                isLoading={connecting}
                icon={PhoneCall}
              >
                Connect WhatsApp with Meta
              </Button>
              <p className="text-xs text-slate-500">
                Opens Meta's secure Embedded Signup popup to link your business number.
              </p>
            </div>
          </div>

          {/* Optional / Advanced: Direct Connect with Meta Credentials */}
          <div className="border-t border-slate-200/80 bg-slate-50/50 p-6">
            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-500" />
                <span>Advanced: Connect directly with Meta API Token / Developer Credentials</span>
              </div>
              {showManualForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showManualForm && (
              <form onSubmit={handleDirectConnect} className="mt-4 space-y-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  If you already generated a Meta System User Token, permanent Business Access Token, or developer test token from developers.facebook.com, you can connect directly below:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      WhatsApp Business Account (WABA) ID
                    </label>
                    <input
                      type="text"
                      value={directForm.waba_id}
                      onChange={(e) => setDirectForm({ ...directForm, waba_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-white"
                      placeholder="e.g. 1098394529543443"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={directForm.phone_number_id}
                      onChange={(e) => setDirectForm({ ...directForm, phone_number_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-white"
                      placeholder="e.g. 1281664778368035"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Meta Business Access Token / System User Token
                  </label>
                  <input
                    type="password"
                    value={directForm.direct_token}
                    onChange={(e) => setDirectForm({ ...directForm, direct_token: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-white"
                    placeholder="EAA..."
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Token is immediately encrypted with AES-256-GCM on our server. Never logged or exposed.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={connecting}
                    icon={Check}
                  >
                    Verify & Link with Meta
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingPage;
