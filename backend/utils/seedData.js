const mongoose = require('mongoose');
const env = require('../config/env');
const cryptoUtils = require('./cryptoUtils');
const {
  Tenant,
  User,
  WabaAccount,
  Contact,
  Conversation,
  Message,
  Template,
  ChatbotRule,
  AuditLog
} = require('../models/zindex');

async function seed() {
  try {
    console.log('[Seed] Connecting to database...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('[Seed] Connected. Clearing existing collections...');

    await Promise.all([
      Tenant.deleteMany({}),
      User.deleteMany({}),
      WabaAccount.deleteMany({}),
      Contact.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Template.deleteMany({}),
      ChatbotRule.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    console.log('[Seed] Creating Super Admin...');
    const superAdmin = await User.create({
      name: 'ITFuturz Super Admin',
      email: 'superadmin@itfuturz.com',
      password: 'SuperAdmin@123',
      role: 'super_admin'
    });

    console.log('[Seed] Creating Client Business Tenant...');
    const tenant = await Tenant.create({
      name: 'Acme Retail Solutions',
      email: 'contact@acmeretail.com',
      status: 'active',
      plan: 'Growth',
      workingHours: {
        enabled: true,
        start: '09:00',
        end: '19:00',
        timezone: 'Asia/Kolkata',
        days: [1, 2, 3, 4, 5, 6]
      }
    });

    console.log('[Seed] Creating Client Admin and Agent...');
    const clientAdmin = await User.create({
      tenantId: tenant._id,
      name: 'Rahul Parmar (Owner)',
      email: 'admin@acmeretail.com',
      password: 'Admin@123',
      role: 'client_admin'
    });

    const clientAgent = await User.create({
      tenantId: tenant._id,
      name: 'Priya Sharma (Sales Agent)',
      email: 'agent@acmeretail.com',
      password: 'Agent@123',
      role: 'client_agent'
    });

    console.log('[Seed] Creating WABA Account...');
    const encryptedToken = cryptoUtils.encrypt('mock_business_access_token_itfuturz_waba');
    const encryptedPin = cryptoUtils.encrypt('123456');

    await WabaAccount.create({
      tenantId: tenant._id,
      wabaId: env.META_TEST_WABA_ID,
      phoneNumberId: env.META_TEST_PHONE_NUMBER_ID,
      displayPhoneNumber: env.META_TEST_PHONE_NUMBER,
      verifiedName: 'Acme Retail Support',
      businessId: env.META_BUSINESS_PORTFOLIO_ID,
      encryptedToken,
      encryptedPin,
      tokenExpiresAt: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000), // 55 days remaining
      qualityRating: 'GREEN',
      messagingLimit: 'TIER_10K',
      status: 'connected'
    });

    console.log('[Seed] Creating Sample WhatsApp Templates...');
    const welcomeTemplate = await Template.create({
      tenantId: tenant._id,
      name: 'seasonal_sale_alert',
      category: 'MARKETING',
      language: 'en_US',
      status: 'APPROVED',
      header: {
        format: 'TEXT',
        text: 'Exclusive 20% Discount Just For You!'
      },
      body: {
        text: 'Hi {{1}}, thank you for choosing Acme Retail. Use coupon code {{2}} at checkout to get 20% off your entire order today!',
        sampleVariables: ['John', 'SAVE20']
      },
      footer: { text: 'Reply STOP to opt out' },
      buttons: [
        { type: 'QUICK_REPLY', text: 'Shop Now' },
        { type: 'QUICK_REPLY', text: 'Talk to Agent' }
      ]
    });

    const orderTemplate = await Template.create({
      tenantId: tenant._id,
      name: 'order_status_update',
      category: 'UTILITY',
      language: 'en_US',
      status: 'APPROVED',
      header: { format: 'NONE' },
      body: {
        text: 'Hello {{1}}, your order #{{2}} has been confirmed and is now being packaged. Expected delivery is {{3}}.',
        sampleVariables: ['Sarah', 'ORD-9842', 'Tomorrow 4 PM']
      },
      footer: { text: 'Acme Retail Customer Care' },
      buttons: [
        { type: 'URL', text: 'Track Order', value: 'https://acmeretail.com/track' }
      ]
    });

    console.log('[Seed] Creating CRM Contacts / Leads...');
    const contact1 = await Contact.create({
      tenantId: tenant._id,
      phone: '+919876543210',
      name: 'Vikram Mehta',
      email: 'vikram@example.com',
      leadStage: 'qualified',
      source: 'instagram_ad',
      tags: ['vip', 'high-intent'],
      optInStatus: true,
      optInSource: 'instagram_ad_click',
      assignedAgentId: clientAgent._id,
      lastInboundAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago (inside 24h window)
    });

    const contact2 = await Contact.create({
      tenantId: tenant._id,
      phone: '+919823456789',
      name: 'Ananya Roy',
      email: 'ananya@example.com',
      leadStage: 'handed_off',
      source: 'google_ad',
      tags: ['pricing-query'],
      optInStatus: true,
      optInSource: 'google_click_to_chat',
      assignedAgentId: clientAgent._id,
      lastInboundAt: new Date(Date.now() - 30 * 60 * 1000) // 30 mins ago
    });

    const contact3 = await Contact.create({
      tenantId: tenant._id,
      phone: '+919811122233',
      name: 'Siddharth Rao',
      email: 'siddharth@example.com',
      leadStage: 'new',
      source: 'direct_inbound',
      tags: ['lead'],
      optInStatus: true,
      optInSource: 'direct_inbound',
      lastInboundAt: new Date(Date.now() - 26 * 60 * 60 * 1000) // 26 hours ago (window closed!)
    });

    console.log('[Seed] Creating Conversations and Messages...');
    const conv1 = await Conversation.create({
      tenantId: tenant._id,
      contactId: contact1._id,
      assignedAgentId: clientAgent._id,
      status: 'open',
      lastMessageText: 'Can you share the pricing catalog for bulk orders?',
      lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastCustomerMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      unreadCount: 1,
      labels: ['Urgent', 'Bulk Lead']
    });

    await Message.create({
      tenantId: tenant._id,
      conversationId: conv1._id,
      contactId: contact1._id,
      wamid: 'wamid.seed_inbound_1',
      direction: 'inbound',
      senderType: 'customer',
      messageType: 'text',
      content: 'Hi! I saw your Instagram ad for summer collections. Can you share the pricing catalog for bulk orders?',
      status: 'delivered',
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    });

    const conv2 = await Conversation.create({
      tenantId: tenant._id,
      contactId: contact2._id,
      assignedAgentId: clientAgent._id,
      status: 'open',
      isBotPaused: true,
      handedOffAt: new Date(Date.now() - 30 * 60 * 1000),
      lastMessageText: 'Connecting you with an agent right now.',
      lastMessageAt: new Date(Date.now() - 30 * 60 * 1000),
      lastCustomerMessageAt: new Date(Date.now() - 30 * 60 * 1000),
      unreadCount: 0,
      labels: ['Handed Off']
    });

    await Message.create({
      tenantId: tenant._id,
      conversationId: conv2._id,
      contactId: contact2._id,
      wamid: 'wamid.seed_inbound_2',
      direction: 'inbound',
      senderType: 'customer',
      messageType: 'text',
      content: 'I need to talk to human support regarding a quotation.',
      status: 'delivered',
      sentAt: new Date(Date.now() - 35 * 60 * 1000)
    });

    await Message.create({
      tenantId: tenant._id,
      conversationId: conv2._id,
      contactId: contact2._id,
      wamid: 'wamid.seed_bot_2',
      direction: 'outbound',
      senderType: 'bot',
      messageType: 'text',
      content: 'Connecting you with an agent right now. Sales rep Priya Sharma has been notified and will assist you shortly.',
      status: 'delivered',
      sentAt: new Date(Date.now() - 34 * 60 * 1000)
    });

    const conv3 = await Conversation.create({
      tenantId: tenant._id,
      contactId: contact3._id,
      status: 'pending',
      lastMessageText: 'Thanks for the info.',
      lastMessageAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      lastCustomerMessageAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      unreadCount: 0,
      labels: ['24h Closed']
    });

    await Message.create({
      tenantId: tenant._id,
      conversationId: conv3._id,
      contactId: contact3._id,
      wamid: 'wamid.seed_inbound_3',
      direction: 'inbound',
      senderType: 'customer',
      messageType: 'text',
      content: 'Thanks for the info.',
      status: 'read',
      sentAt: new Date(Date.now() - 26 * 60 * 60 * 1000)
    });

    console.log('[Seed] Creating Chatbot Rules...');
    await ChatbotRule.create({
      tenantId: tenant._id,
      name: 'Welcome Inbound Greeting',
      triggerType: 'welcome',
      matchType: 'any',
      responseType: 'text',
      responseText: 'Welcome to Acme Retail Solutions! How can our team help you today? Reply "PRICING" for pricing catalog, or "AGENT" to speak to a representative.',
      priority: 10
    });

    await ChatbotRule.create({
      tenantId: tenant._id,
      name: 'Human Agent Hand-off Rule',
      triggerType: 'keyword',
      matchType: 'contains',
      keywords: ['agent', 'human', 'representative', 'quote', 'support', 'callback'],
      responseType: 'hand_off',
      responseText: 'Sure! I am handing this conversation over to a sales representative right now.',
      actions: {
        updateLeadStage: 'handed_off',
        addTag: 'needs-agent',
        pauseBot: true,
        assignAgentId: clientAgent._id
      },
      priority: 20
    });

    await ChatbotRule.create({
      tenantId: tenant._id,
      name: 'Pricing Catalog Auto-Reply',
      triggerType: 'keyword',
      matchType: 'contains',
      keywords: ['price', 'pricing', 'catalog', 'rate'],
      responseType: 'text',
      responseText: 'Our complete retail and wholesale pricing catalog is available at: https://acmeretail.com/catalog. Let us know if you need a custom quote!',
      actions: {
        addTag: 'pricing-enquiry',
        updateLeadStage: 'engaged'
      },
      priority: 5
    });

    console.log('[Seed] Seeding completed successfully!');
    console.log('----------------------------------------------------');
    console.log('Super Admin Login: superadmin@itfuturz.com / SuperAdmin@123');
    console.log('Client Admin Login: admin@acmeretail.com   / Admin@123');
    console.log('Client Agent Login: agent@acmeretail.com   / Agent@123');
    console.log('----------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  }
}

seed();
