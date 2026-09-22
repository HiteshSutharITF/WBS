const validateTemplateCreate = (data) => {
  const errors = {};

  // 1. Template Name: lowercase letters, numbers, and underscores only, max 512 chars
  if (!data.name || !/^[a-z0-9_]+$/.test(data.name.trim())) {
    errors.name = 'Template name must contain only lowercase letters, numbers, and underscores (e.g. order_update_v1).';
  } else if (data.name.trim().length > 512) {
    errors.name = 'Template name cannot exceed 512 characters.';
  }

  // 2. Category: MARKETING, UTILITY, AUTHENTICATION
  if (!data.category || !['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(data.category)) {
    errors.category = 'Template category must be MARKETING, UTILITY, or AUTHENTICATION.';
  }

  // 3. Header Validation
  if (data.header && data.header.format && data.header.format !== 'NONE') {
    if (!['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'].includes(data.header.format)) {
      errors.header = 'Header format must be NONE, TEXT, IMAGE, DOCUMENT, or VIDEO.';
    }
    if (data.header.format === 'TEXT') {
      if (!data.header.text || !data.header.text.trim()) {
        errors.header = 'Header text is required when Header format is TEXT.';
      } else if (data.header.text.length > 60) {
        errors.header = 'Header text cannot exceed 60 characters.';
      } else {
        const headerVars = data.header.text.match(/\{\{(\d+)\}\}/g) || [];
        if (headerVars.length > 1) {
          errors.header = 'Header text can contain at most one variable {{1}}.';
        } else if (headerVars.length === 1 && headerVars[0] !== '{{1}}') {
          errors.header = 'Header variable must be {{1}}.';
        }
      }
    } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(data.header.format)) {
      if (!data.header.headerHandle && !data.header.mediaUrl) {
        errors.header = `Meta guidelines require a sample ${data.header.format.toLowerCase()} file for ${data.header.format} headers. Please upload a sample file before submitting.`;
      }
    }
  }

  // 4. Body Validation & Variable Rules
  if (!data.body || !data.body.text || !data.body.text.trim()) {
    errors.body = 'Template body text is required.';
  } else {
    const text = data.body.text.trim();
    if (text.length > 1024) {
      errors.body = 'Template body text cannot exceed 1,024 characters.';
    }

    // Extract all variables: {{1}}, {{2}}, etc.
    const varMatches = text.match(/\{\{(\d+)\}\}/g) || [];
    const varNumbers = varMatches.map((m) => parseInt(m.replace(/[\{\}]/g, ''), 10));

    if (varNumbers.length > 0) {
      // Check sequential starting at 1
      const sorted = [...varNumbers].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i + 1) {
          errors.body = `Variables must be sequential starting at {{1}}. Missing {{${i + 1}}}.`;
          break;
        }
      }

      // Check unique variable numbers
      if (!errors.body) {
        const uniqueVars = new Set(varNumbers);
        if (uniqueVars.size !== varNumbers.length) {
          errors.body = 'Duplicate variable numbers found. Each variable must have a unique index (e.g. {{1}}, {{2}}).';
        }
      }

      // Check no consecutive variables without words: {{1}}{{2}} or {{1}} {{2}}
      if (!errors.body && /\{\{\d+\}\}\s*\{\{\d+\}\}/.test(text)) {
        errors.body = 'Variables cannot be placed directly next to each other. Meta requires words between variables.';
      }

      // Check variable-to-text ratio:
      // Meta guideline: "This template has too many variables for its length"
      if (!errors.body) {
        const staticText = text.replace(/\{\{\d+\}\}/g, '').trim();
        const staticWords = staticText.split(/\s+/).filter(Boolean);

        if (staticText.length < varNumbers.length * 15 || staticWords.length < varNumbers.length * 3) {
          errors.body = `This template has too many variables for its length (${staticWords.length} words for ${varNumbers.length} variable(s)). Meta requires more fixed context words around variables (e.g. "Hello {{1}}, thank you for contacting us! Your order {{2}} has been confirmed.").`;
        }
      }

      // Check sample variables
      if (!errors.body) {
        const sampleVars = (data.body && Array.isArray(data.body.sampleVariables))
          ? data.body.sampleVariables
          : (Array.isArray(data.sampleVariables) ? data.sampleVariables : []);
        if (sampleVars.length < varNumbers.length || sampleVars.some((s) => !s || !String(s).trim())) {
          errors.body = `Please provide sample values for all ${varNumbers.length} variable(s) ({{1}} to {{${varNumbers.length}}}) so Meta can review your template.`;
        }
      }
    }
  }

  // 5. Footer Validation
  if (data.footer && data.footer.text && data.footer.text.trim()) {
    if (data.footer.text.length > 60) {
      errors.footer = 'Footer text cannot exceed 60 characters.';
    }
    if (/\{\{\d+\}\}/.test(data.footer.text)) {
      errors.footer = 'Meta guidelines forbid variables in footers.';
    }
  }

  // 6. Buttons Validation
  if (data.buttons && Array.isArray(data.buttons) && data.buttons.length > 0) {
    if (data.buttons.length > 10) {
      errors.buttons = 'Cannot have more than 10 buttons in a template.';
    }

    let quickReplyCount = 0;
    let urlCount = 0;
    let phoneCount = 0;

    for (let i = 0; i < data.buttons.length; i++) {
      const btn = data.buttons[i];
      if (!btn.text || !btn.text.trim()) {
        errors.buttons = `Button #${i + 1} text is required.`;
        break;
      }
      if (btn.text.length > 25) {
        errors.buttons = `Button #${i + 1} text cannot exceed 25 characters.`;
        break;
      }

      if (btn.type === 'QUICK_REPLY') {
        quickReplyCount++;
      } else if (btn.type === 'URL') {
        urlCount++;
        if (!btn.value || !btn.value.trim()) {
          errors.buttons = `Button #${i + 1} website URL is required.`;
          break;
        }
      } else if (btn.type === 'PHONE_NUMBER') {
        phoneCount++;
        if (!btn.value || !btn.value.trim()) {
          errors.buttons = `Button #${i + 1} phone number is required.`;
          break;
        }
      }
    }

    if (!errors.buttons) {
      if (phoneCount > 1) {
        errors.buttons = 'Only 1 phone number button is allowed.';
      }
      if (urlCount > 2) {
        errors.buttons = 'Only 2 website URL buttons are allowed.';
      }
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

module.exports = {
  validateTemplateCreate
};
