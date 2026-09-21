const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  HOST: process.env.HOST || 'http://localhost:5000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
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
  ENABLE_MOCK_FALLBACK: process.env.ENABLE_MOCK_FALLBACK === 'true' || process.env.NODE_ENV !== 'production'
};
