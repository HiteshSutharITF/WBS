const validateRegister = (data) => {
  const errors = {};
  if (!data.businessName || data.businessName.trim().length < 2) {
    errors.businessName = 'Business name must be at least 2 characters.';
  }
  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Full name must be at least 2 characters.';
  }
  if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.email = 'Please provide a valid email address.';
  }
  if (!data.password || data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters long.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

const validateLogin = (data) => {
  const errors = {};
  if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.email = 'Please provide a valid email address.';
  }
  if (!data.password || data.password.length < 1) {
    errors.password = 'Password is required.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    message: isValid ? '' : Object.values(errors)[0]
  };
};

module.exports = {
  validateRegister,
  validateLogin
};
