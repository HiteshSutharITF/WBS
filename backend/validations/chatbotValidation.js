const validateChatbotRule = (data) => {
  const errors = {};
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Rule name is required.';
  }
  if (!data.triggerType) {
    errors.triggerType = 'Trigger type is required.';
  }
  if (data.triggerType === 'keyword' && (!data.keywords || data.keywords.length === 0)) {
    errors.keywords = 'At least one trigger keyword is required.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

module.exports = {
  validateChatbotRule
};
