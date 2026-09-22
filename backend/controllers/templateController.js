const ApiResponse = require('../utils/apiResponse');
const { Template, WabaAccount, AuditLog } = require('../models/zindex');
const cryptoUtils = require('../utils/cryptoUtils');
const MetaGraphApi = require('../utils/metaGraphApi');
const env = require('../config/env');

const listTemplates = async (req, res, next) => {
  try {
    const { category, status } = req.query;
    const filter = { tenantId: req.tenantId };

    if (category && category !== 'all') filter.category = category;
    if (status && status !== 'all') filter.status = status;

    const templates = await Template.find(filter).sort({ createdAt: -1 });
    return ApiResponse.success(res, 'Templates retrieved successfully.', templates);
  } catch (error) {
    next(error);
  }
};

const createTemplate = async (req, res, next) => {
  try {
    const { name, category, language, header, body, footer, buttons } = req.body;

    // Check if template with this name already exists for tenant
    const existing = await Template.findOne({ tenantId: req.tenantId, name: name.toLowerCase() });
    if (existing) {
      return ApiResponse.badRequest(res, `A template named "${name}" already exists.`);
    }

    const waba = await WabaAccount.findOne({ tenantId: req.tenantId });
    if (!waba && !env.ENABLE_MOCK_FALLBACK) {
      return ApiResponse.badRequest(res, 'Please connect your WhatsApp Business Account first.');
    }

    const token = waba ? cryptoUtils.decrypt(waba.encryptedToken) : 'mock_token';
    const wabaId = waba?.wabaId || env.META_TEST_WABA_ID;

    // Build Meta Cloud API component format
    const metaComponents = [];

    // Header
    if (header && header.format && header.format !== 'NONE') {
      if (header.format === 'TEXT' && header.text) {
        metaComponents.push({
          type: 'HEADER',
          format: 'TEXT',
          text: header.text
        });
      } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(header.format)) {
        metaComponents.push({
          type: 'HEADER',
          format: header.format
        });
      }
    }

    // Body
    metaComponents.push({
      type: 'BODY',
      text: body.text
    });

    // Footer
    if (footer && footer.text) {
      metaComponents.push({
        type: 'FOOTER',
        text: footer.text
      });
    }

    // Buttons
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      const metaButtons = buttons.map((btn) => {
        if (btn.type === 'QUICK_REPLY') {
          return { type: 'QUICK_REPLY', text: btn.text };
        } else if (btn.type === 'URL') {
          return { type: 'URL', text: btn.text, url: btn.value };
        } else if (btn.type === 'PHONE_NUMBER') {
          return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.value };
        }
        return { type: 'QUICK_REPLY', text: btn.text };
      });

      metaComponents.push({
        type: 'BUTTONS',
        buttons: metaButtons
      });
    }

    const metaPayload = {
      name: name.toLowerCase(),
      category,
      language: language || 'en_US',
      components: metaComponents
    };

    let metaRes;
    try {
      metaRes = await MetaGraphApi.createMessageTemplate(wabaId, token, metaPayload);
    } catch (metaErr) {
      return ApiResponse.badRequest(res, `Meta template creation error: ${metaErr.message}`);
    }

    const template = await Template.create({
      tenantId: req.tenantId,
      metaTemplateId: metaRes?.id || null,
      name: name.toLowerCase(),
      category,
      language: language || 'en_US',
      status: metaRes?.status || 'PENDING', // Live Meta templates start in PENDING review
      header: header || { format: 'NONE' },
      body,
      footer: footer || { text: '' },
      buttons: buttons || []
    });

    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      userEmail: req.user.email,
      role: req.user.role,
      action: 'TEMPLATE_CREATED',
      details: { templateName: template.name, category: template.category },
      ipAddress: req.ip
    });

    return ApiResponse.success(res, 'Template created and submitted to Meta for approval.', template, 201);
  } catch (error) {
    next(error);
  }
};

const syncTemplates = async (req, res, next) => {
  try {
    const waba = await WabaAccount.findOne({ tenantId: req.tenantId });
    if (!waba) {
      return ApiResponse.badRequest(res, 'No WhatsApp Business Account connected.');
    }

    const token = cryptoUtils.decrypt(waba.encryptedToken);
    const metaTemplates = await MetaGraphApi.listMessageTemplates(waba.wabaId, token);

    let syncedCount = 0;
    if (metaTemplates && Array.isArray(metaTemplates.data)) {
      for (const item of metaTemplates.data) {
        const { header, body, footer, buttons } = MetaGraphApi.parseMetaTemplateComponents(item.components);

        // Upsert so both existing AND previously approved Meta templates are fetched/imported!
        await Template.findOneAndUpdate(
          { tenantId: req.tenantId, name: item.name.toLowerCase() },
          {
            tenantId: req.tenantId,
            metaTemplateId: item.id,
            name: item.name.toLowerCase(),
            category: item.category || 'MARKETING',
            language: item.language || 'en_US',
            status: item.status || 'APPROVED',
            rejectionReason: item.rejected_reason || '',
            header,
            body: body?.text ? body : { text: item.name },
            footer,
            buttons
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        syncedCount++;
      }
    }

    const all = await Template.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
    return ApiResponse.success(res, `Templates synchronized (${syncedCount} templates fetched/updated from Meta).`, all);
  } catch (error) {
    next(error);
  }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const template = await Template.findOne({ _id: templateId, tenantId: req.tenantId });

    if (!template) {
      return ApiResponse.notFound(res, 'Template not found.');
    }

    // Also attempt deletion on Meta Cloud API
    const waba = await WabaAccount.findOne({ tenantId: req.tenantId });
    if (waba && waba.encryptedToken && waba.wabaId) {
      try {
        const token = cryptoUtils.decrypt(waba.encryptedToken);
        await MetaGraphApi.deleteMessageTemplate(waba.wabaId, token, template.name);
      } catch (metaErr) {
        console.warn('[Meta Template Delete] Could not delete from Meta directly:', metaErr.message);
      }
    }

    await Template.findByIdAndDelete(templateId);

    return ApiResponse.success(res, 'Template deleted successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTemplates,
  createTemplate,
  syncTemplates,
  deleteTemplate
};
