(function () {
  const form = document.getElementById('loginForm');
  const branchSelect = document.getElementById('branch');
  const pinBoxes = document.getElementById('pinBoxes');
  const pinInputs = pinBoxes ? pinBoxes.querySelectorAll('.pin-box') : [];
  const branchError = document.getElementById('branchError');
  const pinError = document.getElementById('pinError');
  const submitBtn = document.getElementById('submitBtn');

  function getPinValue() {
    var s = '';
    for (var i = 0; i < pinInputs.length; i++) s += (pinInputs[i].value || '');
    return s;
  }

  function showError(el, message) {
    el.textContent = message || '';
  }

  function setInputError(inputOrContainer, hasError) {
    if (!inputOrContainer) return;
    if (inputOrContainer.classList) {
      inputOrContainer.classList.toggle('field__input--error', !!hasError);
      if (hasError && inputOrContainer.querySelectorAll) {
        var boxes = inputOrContainer.querySelectorAll('.pin-box');
        for (var j = 0; j < boxes.length; j++) boxes[j].classList.toggle('pin-box--error', !!hasError);
      } else if (inputOrContainer.classList.contains('pin-box')) {
        inputOrContainer.classList.toggle('pin-box--error', !!hasError);
      }
    }
  }

  function validateBranch(value) {
    if (!value || !value.trim()) return 'Please select a branch';
    return '';
  }

  var branchPins = {
    admin: '99999999',
    panadura: '11111111',
    nugegoda: '22222222',
    piliyandala: '33333333'
  };

  function validatePin(value, branchValue) {
    if (!value) return 'PIN is required';
    if (!/^\d{8}$/.test(value)) return 'Enter all 8 digits';
    if (branchValue && branchPins[branchValue] && value !== branchPins[branchValue]) {
      return 'Invalid PIN for this branch';
    }
    return '';
  }

  // PIN boxes: one digit each, auto-advance, backspace to previous
  for (var i = 0; i < pinInputs.length; i++) {
    (function (idx) {
      var box = pinInputs[idx];

      box.addEventListener('input', function () {
        var v = this.value.replace(/\D/g, '');
        this.value = v ? v.slice(-1) : '';
        pinBoxes.classList.remove('field__input--error');
        pinError.textContent = '';
        for (var k = 0; k < pinInputs.length; k++) pinInputs[k].classList.remove('pin-box--error');
        if (this.value && idx < pinInputs.length - 1) pinInputs[idx + 1].focus();
      });

      box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !this.value && idx > 0) {
          pinInputs[idx - 1].focus();
          pinInputs[idx - 1].value = '';
        }
      });

      box.addEventListener('paste', function (e) {
        e.preventDefault();
        var pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 8);
        for (var p = 0; p < pinInputs.length; p++) {
          pinInputs[p].value = pasted[p] || '';
        }
        if (pasted.length > 0) pinInputs[Math.min(pasted.length, pinInputs.length) - 1].focus();
      });
    })(i);
  }

  branchSelect.addEventListener('change', function () {
    branchSelect.classList.remove('field__input--error');
    branchError.textContent = '';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var pinValue = getPinValue();
    var branchMsg = validateBranch(branchSelect.value);
    var pinMsg = validatePin(pinValue, branchSelect.value);

    branchError.textContent = branchMsg;
    pinError.textContent = pinMsg;
    setInputError(branchSelect, !!branchMsg);
    if (pinBoxes) {
      pinBoxes.classList.toggle('field__input--error', !!pinMsg);
      for (var b = 0; b < pinInputs.length; b++) pinInputs[b].classList.toggle('pin-box--error', !!pinMsg);
    }

    if (branchMsg || pinMsg) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    setTimeout(function () {
      try {
        sessionStorage.setItem('abba_branch', branchSelect.value);
        sessionStorage.setItem('abba_branchName', branchSelect.options[branchSelect.selectedIndex].text);
        if (branchSelect.value === 'admin') sessionStorage.setItem('abba_admin', 'true');
        else sessionStorage.removeItem('abba_admin');
      } catch (err) {}
      window.location.href = 'home.html';
    }, 500);
  });
})();
