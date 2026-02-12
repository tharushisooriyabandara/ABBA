(function () {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const submitBtn = document.getElementById('submitBtn');

  function showError(el, message) {
    el.textContent = message || '';
    var input = el.previousElementSibling;
    if (input && input.classList) input.classList.toggle('field__input--error', !!message);
  }

  function validateEmail(value) {
    if (!value.trim()) return 'Email is required';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(value)) return 'Please enter a valid email address';
    return '';
  }

  function validatePassword(value) {
    if (!value) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const emailMsg = validateEmail(emailInput.value);
    const passwordMsg = validatePassword(passwordInput.value);

    showError(emailError, emailMsg);
    showError(passwordError, passwordMsg);
    emailInput.classList.toggle('field__input--error', !!emailMsg);
    passwordInput.classList.toggle('field__input--error', !!passwordMsg);

    if (emailMsg || passwordMsg) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    // Placeholder: replace with real auth (e.g. fetch to your API)
    setTimeout(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
      alert('Login is not connected to a backend yet. Add your API when ready.');
    }, 800);
  });

  emailInput.addEventListener('input', function () {
    emailInput.classList.remove('field__input--error');
    emailError.textContent = '';
  });

  passwordInput.addEventListener('input', function () {
    passwordInput.classList.remove('field__input--error');
    passwordError.textContent = '';
  });
})();
