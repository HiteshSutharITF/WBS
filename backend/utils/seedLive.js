const mongoose = require('mongoose');
const env = require('../config/env');
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

async function seedLive() {
  try {
    console.log('[Live Seed] Connecting to MongoDB database...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('[Live Seed] Database connected successfully.');

    const isCleanReset =
      process.argv.includes('--clean') ||
      process.argv.includes('--fresh') ||
      process.argv.includes('--reset');

    if (isCleanReset) {
      console.log('[Live Seed] --clean flag detected. Removing all test data (tenants, contacts, messages, waba, chatbots)...');
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
      console.log('[Live Seed] Clean reset complete. Database is empty.');
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'superadmin@itfuturz.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'SuperAdmin@123';
    const adminName = process.env.ADMIN_NAME || 'ITFuturz Super Admin';

    console.log(`[Live Seed] Verifying Super Administrator account (${adminEmail})...`);
    let superAdmin = await User.findOne({ email: adminEmail });

    if (!superAdmin) {
      superAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'super_admin',
        isActive: true
      });
      console.log(`[Live Seed] ✔ Super Administrator account provisioned successfully.`);

      // Log system initialization
      await AuditLog.create({
        userId: superAdmin._id,
        userEmail: superAdmin.email,
        role: 'super_admin',
        action: 'SYSTEM_INITIALIZED',
        details: {
          message: 'Live production environment initialized with Super Administrator account.',
          domain: env.LIVE_DOMAIN || 'wbs.itfuturz.in',
          liveUrl: env.LIVE_URL || 'https://wbs.itfuturz.in'
        },
        ipAddress: '127.0.0.1'
      });
    } else {
      let updated = false;
      if (superAdmin.role !== 'super_admin') {
        superAdmin.role = 'super_admin';
        updated = true;
      }
      if (!superAdmin.isActive) {
        superAdmin.isActive = true;
        updated = true;
      }
      if (updated) {
        await superAdmin.save();
        console.log(`[Live Seed] ✔ Existing Super Admin account updated to active status.`);
      } else {
        console.log(`[Live Seed] Super Admin account already exists and is active.`);
      }
    }

    // Optional: Support staff account
    if (process.env.SUPPORT_EMAIL && process.env.SUPPORT_PASSWORD) {
      const supportEmail = process.env.SUPPORT_EMAIL.toLowerCase().trim();
      let supportUser = await User.findOne({ email: supportEmail });
      if (!supportUser) {
        await User.create({
          name: process.env.SUPPORT_NAME || 'ITFuturz Support',
          email: supportEmail,
          password: process.env.SUPPORT_PASSWORD,
          role: 'support',
          isActive: true
        });
        console.log(`[Live Seed] ✔ Support staff account provisioned: ${supportEmail}`);
      }
    }

    console.log('\n============================================================');
    console.log('       WBS PLATFORM — LIVE PRODUCTION READY                 ');
    console.log('============================================================');
    console.log(`Live Domain:        ${env.LIVE_URL || 'https://wbs.itfuturz.in'}`);
    console.log(`Super Admin Console:${(env.LIVE_URL || 'https://wbs.itfuturz.in')}/admin/`);
    console.log(`Admin Login:        ${adminEmail}`);
    console.log(`Admin Password:     ${adminPassword}`);
    console.log('------------------------------------------------------------');
    console.log('Status: Clean Production Environment');
    console.log('- 0 Fake Tenants');
    console.log('- 0 Fake Contacts');
    console.log('- 0 Fake Chats');
    console.log('- 0 Mock WABA Tokens');
    console.log('\nYou can now log in to the Super Admin Console at /admin/');
    console.log('and click "+ Create Client Account" to provision real clients.');
    console.log('============================================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Live Seed] Error during live seeding:', error);
    process.exit(1);
  }
}

seedLive();
