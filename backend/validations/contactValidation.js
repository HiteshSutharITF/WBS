const validateContactCreate = (data) => {
  const errors = {};
  if (!data.phone && !data.bsuid) {
    errors.phone = 'Phone number or BSUID is required to identify the contact.';
  }
  if (!data.name || data.name.trim().length < 1) {
    errors.name = 'Contact name is required.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

const validateNoteCreate = (data) => {
  const errors = {};
  if (!data.text || data.text.trim().length < 1) {
    errors.text = 'Note content cannot be empty.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

module.exports = {
  validateContactCreate,
  validateNoteCreate
};
