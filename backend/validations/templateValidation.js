const validateTemplateCreate = (data) => {
  const errors = {};
  if (!data.name || !/^[a-z0-9_]+$/.test(data.name)) {
    errors.name = 'Template name must contain only lowercase alphanumeric characters and underscores.';
  }
  if (!data.category || !['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(data.category)) {
    errors.category = 'Template category must be MARKETING, UTILITY, or AUTHENTICATION.';
  }
  if (!data.body || !data.body.text || data.body.text.trim().length === 0) {
    errors.body = 'Template body text is required.';
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
