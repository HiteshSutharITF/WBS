const ApiResponse = require('../utils/apiResponse');
const { Template, WabaAccount, AuditLog } = require('../models/zindex');
const cryptoUtils = require('../utils/cryptoUtils');
const MetaGraphApi = require('../utils/metaGraphApi');
const env = require('../config/env');
const { validateTemplateCreate } = require('../validations/templateValidation');

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

    // 1. Strict Meta Guidelines Validation
    const validation = validateTemplateCreate(req.body);
    if (!validation.isValid) {
      return ApiResponse.badRequest(res, validation.message, validation.errors);
    }

    // Check if template with this name already exists for tenant
    const existing = await Template.findOne({ tenantId: req.tenantId, name: name.toLowerCase().trim() });
    if (existing) {
      return ApiResponse.badRequest(res, `A template named "${name}" already exists.`);
    }

    const waba = await WabaAccount.findOne({ tenantId: req.tenantId });
    if (!waba && !env.ENABLE_MOCK_FALLBACK) {
      return ApiResponse.badRequest(res, 'Please connect your WhatsApp Business Account first.');
    }

    const token = waba ? cryptoUtils.decrypt(waba.encryptedToken) : 'mock_token';
    const wabaId = waba?.wabaId || env.META_TEST_WABA_ID;

    // 2. Build Meta Cloud API component format with required example objects
    const metaComponents = [];

    // Header
    if (header && header.format && header.format !== 'NONE') {
      if (header.format === 'TEXT' && header.text) {
        const headerComp = {
          type: 'HEADER',
          format: 'TEXT',
          text: header.text.trim()
        };
        const headerVars = header.text.match(/\{\{(\d+)\}\}/g);
        if (headerVars && headerVars.length > 0) {
          headerComp.example = {
            header_text: [header.sampleVariable || 'Sample Header']
          };
        }
        metaComponents.push(headerComp);
      } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(header.format)) {
        metaComponents.push({
          type: 'HEADER',
          format: header.format
        });
      }
    }

    // Body (with Meta required example object for variables)
    const bodyComp = {
      type: 'BODY',
      text: body.text.trim()
    };
    const bodyVars = body.text.match(/\{\{(\d+)\}\}/g);
    if (bodyVars && bodyVars.length > 0) {
      const rawSamples = (body.sampleVariables && Array.isArray(body.sampleVariables) && body.sampleVariables.length > 0)
        ? body.sampleVariables
        : (req.body.sampleVariables && Array.isArray(req.body.sampleVariables) && req.body.sampleVariables.length > 0)
        ? req.body.sampleVariables
        : [];
      const sampleList = bodyVars.map((_, idx) => (rawSamples[idx] && String(rawSamples[idx]).trim()) ? String(rawSamples[idx]).trim() : `Sample ${idx + 1}`);
      bodyComp.example = {
        body_text: [sampleList]
      };
    }
    metaComponents.push(bodyComp);

    // Footer (Meta forbids variables in footer)
    if (footer && footer.text && footer.text.trim()) {
      metaComponents.push({
        type: 'FOOTER',
        text: footer.text.trim()
      });
    }

    // Buttons
    if (buttons && Array.isArray(buttons) && buttons.length > 0) {
      const metaButtons = buttons.map((btn) => {
        if (btn.type === 'QUICK_REPLY') {
          return { type: 'QUICK_REPLY', text: btn.text.trim() };
        } else if (btn.type === 'URL') {
          const btnObj = { type: 'URL', text: btn.text.trim(), url: btn.value.trim() };
          if (btn.value.includes('{{1}}')) {
            btnObj.example = [btn.sampleUrl || btn.value.replace('{{1}}', '12345')];
          }
          return btnObj;
        } else if (btn.type === 'PHONE_NUMBER') {
          return { type: 'PHONE_NUMBER', text: btn.text.trim(), phone_number: btn.value.trim() };
        }
        return { type: 'QUICK_REPLY', text: btn.text.trim() };
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
      name: name.toLowerCase().trim(),
      category,
      language: language || 'en_US',
      status: metaRes?.status || 'PENDING', // Live Meta templates start in PENDING review
      header: header || { format: 'NONE' },
      body: {
        text: body.text.trim(),
        sampleVariables: (body.sampleVariables && body.sampleVariables.length > 0) ? body.sampleVariables : (req.body.sampleVariables || [])
      },
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
