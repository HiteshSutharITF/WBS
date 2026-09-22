const path = require('path');
const dotenv = require('dotenv');

// Check if running in development mode (e.g. npm run dev or dev:backend)
const lifecycle = process.env.npm_lifecycle_event || '';
const isDev = lifecycle === 'dev' || lifecycle === 'dev:backend' || (process.env.NODE_ENV === 'development' && lifecycle !== 'start');

// Store any externally provided PORT or HOST from environment
const rawCliPort = process.env.PORT;
const rawCliHost = process.env.HOST;

if (isDev && lifecycle !== 'start') {
  // Load dev environment variables (PORT=5000)
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.development'), override: true });
  // Fallback to .env for unspecified variables
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
} else {
  // Production / npm start mode (PORT=2222)
  dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });
}

// Port resolution:
// 1. Explicit CLI PORT (if passed e.g. PORT=8080 npm start)
// 2. process.env.PORT loaded from file
// 3. 5000 for dev, 2222 for start
const port = rawCliPort
  ? parseInt(rawCliPort, 10)
  : (process.env.PORT ? parseInt(process.env.PORT, 10) : (isDev && lifecycle !== 'start' ? 5000 : 2222));

// Live production domain constants
const LIVE_DOMAIN = process.env.LIVE_DOMAIN || 'wbs.itfuturz.in';
const LIVE_URL = process.env.LIVE_URL || `https://${LIVE_DOMAIN}`;

// Default host: In dev mode, use http://localhost:5000. In production mode, use process.env.HOST or fallback to LIVE_URL
const defaultHost = (isDev && lifecycle !== 'start')
  ? `http://localhost:${port}`
  : (process.env.HOST || LIVE_URL);

const host = rawCliHost || defaultHost;
const webhookUrl = process.env.WEBHOOK_URL || `${LIVE_URL}/webhook`;

module.exports = {
  NODE_ENV: (isDev && lifecycle !== 'start') ? 'development' : (process.env.NODE_ENV || 'production'),
  PORT: port,
  HOST: host,
  LIVE_DOMAIN,
  LIVE_URL,
  WEBHOOK_URL: webhookUrl,
  FRONTEND_URL: process.env.FRONTEND_URL || ((isDev && lifecycle !== 'start') ? 'http://localhost:5173' : host),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wbs_platform',
  JWT_SECRET: process.env.JWT_SECRET || 'wbs_default_jwt_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN || 'wbs_webhook_verify_token_2026',
  META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v25.0',
  META_GRAPH_URL: process.env.META_GRAPH_URL || 'https://graph.facebook.com/v25.0',
  META_APP_ID: process.env.META_APP_ID || '1075294524979498',
  META_APP_SECRET: process.env.META_APP_SECRET || '',
  META_CONFIG_ID: process.env.META_CONFIG_ID || '4546265418941622',
  META_BUSINESS_PORTFOLIO_ID: process.env.META_BUSINESS_PORTFOLIO_ID || '442667213703747',
  META_TEST_PHONE_NUMBER: process.env.META_TEST_PHONE_NUMBER || '+1 555 672 2362',
  META_TEST_PHONE_NUMBER_ID: process.env.META_TEST_PHONE_NUMBER_ID || '1281664778368035',
  META_TEST_WABA_ID: process.env.META_TEST_WABA_ID || '1098394529543443',
  ENABLE_MOCK_FALLBACK: process.env.ENABLE_MOCK_FALLBACK === 'true'
};
