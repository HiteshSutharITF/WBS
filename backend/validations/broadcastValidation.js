const validateBroadcastCreate = (data) => {
  const errors = {};
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Broadcast campaign name is required.';
  }
  if (!data.templateId) {
    errors.templateId = 'An approved template must be selected.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

module.exports = {
  validateBroadcastCreate
};
