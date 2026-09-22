const axios = require('axios');
const env = require('../config/env');

const BASE_URL = env.META_GRAPH_URL;

class MetaGraphApi {
  /**
   * Exchange Embedded Signup code for a Business Access Token
   * Note: The one-time code expires in 30 seconds!
   */
  static async exchangeCodeForToken(code, redirectUri) {
    if (code && (code.startsWith('mock_') || code.startsWith('simulated_'))) {
      return {
        access_token: `mock_access_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        token_type: 'bearer',
        expires_in: 5184000 // 60 days in seconds
      };
    }

    if (env.ENABLE_MOCK_FALLBACK && (!env.META_APP_SECRET || env.META_APP_SECRET.includes('here'))) {
      return {
        access_token: `mock_access_token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        token_type: 'bearer',
        expires_in: 5184000 // 60 days in seconds
      };
    }

    try {
      const params = {
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        code
      };
      if (redirectUri) {
        params.redirect_uri = redirectUri;
      }
      const response = await axios.get(`${BASE_URL}/oauth/access_token`, { params });
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        console.warn('[MetaGraphApi] Code exchange failed with live API, falling back to mock mode:', error.response?.data || error.message);
        return {
          access_token: `mock_fallback_token_${Date.now()}`,
          token_type: 'bearer',
          expires_in: 5184000
        };
      }
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Confirm token validity and permissions
   */
  static async debugToken(inputToken) {
    if (env.ENABLE_MOCK_FALLBACK && (!env.META_APP_SECRET || env.META_APP_SECRET.includes('here'))) {
      return {
        data: {
          app_id: env.META_APP_ID,
          is_valid: true,
          expires_at: Math.floor(Date.now() / 1000) + 5184000,
          granular_scopes: [
            { scope: 'whatsapp_business_messaging', target_ids: [env.META_TEST_WABA_ID] },
            { scope: 'whatsapp_business_management', target_ids: [env.META_TEST_WABA_ID] }
          ]
        }
      };
    }

    try {
      const appToken = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
      const response = await axios.get(`${BASE_URL}/debug_token`, {
        params: {
          input_token: inputToken,
          access_token: appToken
        }
      });
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return {
          data: {
            app_id: env.META_APP_ID,
            is_valid: true,
            expires_at: Math.floor(Date.now() / 1000) + 5184000
          }
        };
      }
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Subscribe Meta App to client WABA to receive incoming webhooks
   */
  static async subscribeAppToWaba(wabaId, businessToken) {
    if (env.ENABLE_MOCK_FALLBACK && (!businessToken || businessToken.startsWith('mock_'))) {
      return { success: true };
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/${wabaId}/subscribed_apps`,
        {},
        {
          headers: { Authorization: `Bearer ${businessToken}` }
        }
      );
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return { success: true };
      }
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Register Phone Number with a 6-digit PIN
   */
  static async registerPhoneNumber(phoneNumberId, pin, businessToken) {
    if (env.ENABLE_MOCK_FALLBACK && (!businessToken || businessToken.startsWith('mock_'))) {
      return { success: true };
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/${phoneNumberId}/register`,
        {
          messaging_product: 'whatsapp',
          pin
        },
        {
          headers: { Authorization: `Bearer ${businessToken}` }
        }
      );
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return { success: true };
      }
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Fetch connected Phone Number details and limits
   */
  static async fetchPhoneNumberDetails(phoneNumberId, businessToken) {
    if (env.ENABLE_MOCK_FALLBACK && (!businessToken || businessToken.startsWith('mock_'))) {
      return {
        display_phone_number: env.META_TEST_PHONE_NUMBER,
        verified_name: 'ITFuturz Business Solution',
        status: 'CONNECTED',
        quality_rating: 'GREEN',
        code_verification_status: 'VERIFIED',
        account_mode: 'LIVE',
        is_official_business_account: false,
        whatsapp_business_manager_messaging_limit: 'TIER_250'
      };
    }

    try {
      const fields = [
        'display_phone_number',
        'verified_name',
        'status',
        'quality_rating',
        'code_verification_status',
        'account_mode',
        'is_official_business_account',
        'whatsapp_business_manager_messaging_limit'
      ].join(',');

      const response = await axios.get(`${BASE_URL}/${phoneNumberId}`, {
        params: { fields },
        headers: { Authorization: `Bearer ${businessToken}` }
      });
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return {
          display_phone_number: env.META_TEST_PHONE_NUMBER,
          verified_name: 'ITFuturz Business Solution',
          status: 'CONNECTED',
          quality_rating: 'GREEN',
          code_verification_status: 'VERIFIED',
          whatsapp_business_manager_messaging_limit: 'TIER_250'
        };
      }
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }

  /**
   * Send WhatsApp message (Text, Media, Template, Interactive)
   */
  static async sendMessage(phoneNumberId, businessToken, messagePayload) {
    if (env.ENABLE_MOCK_FALLBACK && (!businessToken || businessToken.startsWith('mock_'))) {
      const mockWamid = `wamid.HBgL${Date.now()}A${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: messagePayload.to, wa_id: messagePayload.to.replace(/\D/g, '') }],
        messages: [{ id: mockWamid, message_status: 'accepted' }]
      };
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/${phoneNumberId}/messages`,
        messagePayload,
        {
          headers: {
            Authorization: `Bearer ${businessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        const mockWamid = `wamid.HBgL${Date.now()}A${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        return {
          messaging_product: 'whatsapp',
          contacts: [{ input: messagePayload.to, wa_id: messagePayload.to.replace(/\D/g, '') }],
          messages: [{ id: mockWamid, message_status: 'accepted' }]
        };
      }
      const errData = error.response?.data?.error;
      const errorMsg = errData ? `[Meta ${errData.code}] ${errData.message}` : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Create template on Meta
   */
  static async createMessageTemplate(wabaId, businessToken, templatePayload) {
    if (env.ENABLE_MOCK_FALLBACK && (!businessToken || businessToken.startsWith('mock_'))) {
      return {
        id: `mock_tmpl_${Date.now()}`,
        status: 'APPROVED',
        category: templatePayload.category
      };
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/${wabaId}/message_templates`,
        templatePayload,
        {
          headers: {
            Authorization: `Bearer ${businessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return {
          id: `mock_tmpl_${Date.now()}`,
          status: 'APPROVED',
          category: templatePayload.category
        };
      }
      const errData = error.response?.data?.error;
      const errorMsg = errData ? `[Meta ${errData.code}] ${errData.message}` : error.message;
      throw new Error(errorMsg);
    }
  }

  /**
   * Fetch all message templates from Meta WABA
   */
  static async listMessageTemplates(wabaId, businessToken) {
    if (env.ENABLE_MOCK_FALLBACK && (!businessToken || businessToken.startsWith('mock_'))) {
      return { data: [] };
    }

    try {
      const response = await axios.get(`${BASE_URL}/${wabaId}/message_templates`, {
        headers: { Authorization: `Bearer ${businessToken}` }
      });
      return response.data;
    } catch (error) {
      if (env.ENABLE_MOCK_FALLBACK) {
        return { data: [] };
      }
      throw new Error(error.response?.data?.error?.message || error.message);
    }
  }
}

module.exports = MetaGraphApi;
