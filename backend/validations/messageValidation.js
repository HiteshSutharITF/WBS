const validateTextMessage = (data) => {
  const errors = {};
  if (!data.conversationId) {
    errors.conversationId = 'Conversation ID is required.';
  }
  if (!data.content || data.content.trim().length === 0) {
    errors.content = 'Message content cannot be empty.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

const validateTemplateMessage = (data) => {
  const errors = {};
  if (!data.conversationId) {
    errors.conversationId = 'Conversation ID is required.';
  }
  if (!data.templateId) {
    errors.templateId = 'Template ID is required.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

module.exports = {
  validateTextMessage,
  validateTemplateMessage
};
