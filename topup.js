(() => {
  const screen = document.querySelector('.topup-screen');
  if (!screen) return;
  const accounts = [
    { title: 'Главный номер', phone: '+7 (999) 252-61-05', balance: '300 ₽', returnQuery: '' },
    { title: 'Второй номер', phone: '+7 (914) 680-40-60', balance: '2 ₽', returnQuery: '?sim=second' },
    { title: 'Главный номер', phone: '+7 (914) 680-40-61', balance: '300 ₽', returnQuery: '?sim=third' },
    { title: 'Четвёртый номер', phone: '+7 (999) 252-61-05', balance: '300 ₽', returnQuery: '?sim=fourth' }
  ];
  const requested = Number(new URLSearchParams(location.search).get('sim'));
  const account = accounts[Number.isInteger(requested) && requested >= 0 && requested < accounts.length ? requested : 0];
  screen.querySelector('.topup-account-caption').textContent = `${account.title} · ${account.balance}`;
  screen.querySelector('.topup-account-phone').textContent = account.phone;

  const amountValue = screen.querySelector('.topup-amount-value');
  const digitsBefore = screen.querySelector('.topup-digits-before');
  const digitsAfter = screen.querySelector('.topup-digits-after');
  const caret = screen.querySelector('.topup-caret');
  const keyboard = screen.querySelector('.topup-keyboard');
  const rotary = screen.querySelector('.topup-rotary');
  const wheel = screen.querySelector('.topup-rotary-wheel');
  const target = screen.querySelector('.topup-rotary-slot');
  const alternate = screen.querySelector('.topup-alternate');
  const switchImage = alternate.querySelector('img');
  const pay = screen.querySelector('.topup-pay');
  const toast = screen.querySelector('.topup-toast');
  let amount = '5';
  let caretIndex = 1;
  let toastTimer;
  let dialGesture = null;
  let returnAnimation = null;

  function digitNodes(value, startIndex, fullLength) {
    return [...value].map((digit, index) => {
      const span = document.createElement('span');
      span.className = 'topup-digit';
      const position = startIndex + index;
      span.dataset.index = String(position);
      if (position < fullLength - 1 && (fullLength - position - 1) % 3 === 0) span.classList.add('has-group-space');
      span.textContent = digit;
      return span;
    });
  }

  function renderValue(value, index) {
    digitsBefore.replaceChildren(...digitNodes(value.slice(0, index), 0, value.length));
    digitsAfter.replaceChildren(...digitNodes(value.slice(index), index, value.length));
    amountValue.setAttribute('aria-label', `Сумма пополнения: ${value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`);
    const length = Math.max(1, value.length);
    screen.style.setProperty('--amount-size', length <= 4 ? '72px' : length === 5 ? 'min(72px, calc((100vw - 32px) * .245))' : length === 6 ? 'min(72px, calc((100vw - 32px) * .215))' : 'min(72px, calc((100vw - 32px) * .187))');
    screen.style.setProperty('--rotary-amount-size', `${length <= 3 ? 64 : length === 4 ? 52 : length === 5 ? 44 : length === 6 ? 36 : 30}px`);
  }

  function restartCaret() {
    caret.classList.remove('is-blinking');
    void caret.offsetWidth;
    caret.classList.add('is-blinking');
  }

  function renderAmount() {
    renderValue(amount, caretIndex);
    pay.disabled = amount === '0';
    screen.querySelectorAll('[data-digit="0"]').forEach(button => { button.disabled = amount === '0'; });
  }

  function commit(value, index) {
    const normalized = value.replace(/^0+(?=\d)/, '') || '0';
    amount = normalized;
    caretIndex = normalized === '0' ? 1 : Math.max(0, index - (value.length - normalized.length));
    renderAmount();
    restartCaret();
  }

  function inserted(digit) {
    if (digit === '0' && (amount === '0' || caretIndex === 0)) return null;
    if (amount === '0') return { value: digit, index: 1 };
    if (amount.length >= 7) return null;
    return { value: amount.slice(0, caretIndex) + digit + amount.slice(caretIndex), index: caretIndex + 1 };
  }

  function appendDigit(digit) {
    const next = inserted(digit);
    if (next) commit(next.value, next.index);
  }

  function backspace() {
    if (amount === '0' || caretIndex === 0) return;
    const next = amount.slice(0, caretIndex - 1) + amount.slice(caretIndex);
    commit(next || '0', next ? caretIndex - 1 : 1);
  }

  function deleteForward() {
    if (amount === '0' || caretIndex === amount.length) return;
    const next = amount.slice(0, caretIndex) + amount.slice(caretIndex + 1);
    commit(next || '0', next ? caretIndex : 1);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  screen.querySelectorAll('.topup-keyboard [data-digit]').forEach(button => button.addEventListener('click', () => appendDigit(button.dataset.digit)));
  screen.querySelector('.topup-delete').addEventListener('click', backspace);
  screen.querySelector('.topup-rotary-delete').addEventListener('click', backspace);
  amountValue.addEventListener('pointerdown', event => {
    const digit = event.target.closest('.topup-digit');
    if (digit) {
      const bounds = digit.getBoundingClientRect();
      caretIndex = Number(digit.dataset.index) + Number(event.clientX >= bounds.left + bounds.width / 2);
    } else {
      const bounds = amountValue.getBoundingClientRect();
      caretIndex = event.clientX < bounds.left + bounds.width / 2 ? 0 : amount.length;
    }
    renderAmount();
    restartCaret();
    amountValue.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^\d$/.test(event.key)) { event.preventDefault(); appendDigit(event.key); }
    if (event.key === 'Backspace') { event.preventDefault(); backspace(); }
    if (event.key === 'Delete') { event.preventDefault(); deleteForward(); }
    if (document.activeElement !== amountValue) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      caretIndex = event.key === 'Home' ? 0 : event.key === 'End' ? amount.length : Math.max(0, Math.min(amount.length, caretIndex + (event.key === 'ArrowLeft' ? -1 : 1)));
      renderAmount();
      restartCaret();
    }
  });

  function angleAt(event) {
    const bounds = wheel.getBoundingClientRect();
    return Math.atan2(event.clientY - bounds.top - bounds.height / 2, event.clientX - bounds.left - bounds.width / 2) * 180 / Math.PI;
  }

  function resetWheel() {
    if (returnAnimation) returnAnimation.cancel();
    returnAnimation = null;
    wheel.classList.remove('is-dragging', 'is-returning');
    target.classList.remove('is-near-target', 'is-pulsing');
    wheel.style.setProperty('--dial-rotation', '0deg');
    renderAmount();
  }

  function returnWheel(rotation) {
    wheel.classList.remove('is-dragging');
    target.classList.remove('is-near-target');
    wheel.style.setProperty('--dial-rotation', '0deg');
    if (rotation < 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    wheel.classList.add('is-returning');
    const animation = wheel.animate([
      { offset: 0, transform: `rotate(${rotation}deg)` },
      { offset: .27, transform: `rotate(${rotation * .7}deg)` },
      { offset: .31, transform: `rotate(${rotation * .698}deg)` },
      { offset: .56, transform: `rotate(${rotation * .37}deg)` },
      { offset: .6, transform: `rotate(${rotation * .368}deg)` },
      { offset: .81, transform: `rotate(${rotation * .12}deg)` },
      { offset: .85, transform: `rotate(${rotation * .118}deg)` },
      { offset: 1, transform: 'rotate(0deg)' }
    ], { duration: Math.min(600, 400 + rotation * .65), easing: 'linear' });
    returnAnimation = animation;
    animation.onfinish = () => {
      if (returnAnimation !== animation) return;
      returnAnimation = null;
      wheel.classList.remove('is-returning');
    };
  }

  function pulseTarget() {
    target.classList.remove('is-pulsing');
    void target.offsetWidth;
    target.classList.add('is-pulsing');
  }

  target.addEventListener('animationend', event => {
    if (event.animationName === 'topup-target-pulse') target.classList.remove('is-pulsing');
  });

  rotary.querySelectorAll('[data-digit]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || returnAnimation) return;
      button.setPointerCapture(event.pointerId);
      wheel.classList.add('is-dragging');
      dialGesture = { id: event.pointerId, button, previous: angleAt(event), rawRotation: 0, rotation: 0, max: Number(button.style.getPropertyValue('--turn')) };
    });
    button.addEventListener('pointermove', event => {
      if (!dialGesture || dialGesture.id !== event.pointerId) return;
      const angle = angleAt(event);
      const delta = (angle - dialGesture.previous + 540) % 360 - 180;
      dialGesture.previous = angle;
      dialGesture.rawRotation = Math.max(0, Math.min(dialGesture.max, dialGesture.rawRotation + delta));
      const distance = dialGesture.max - dialGesture.rawRotation;
      const nearTarget = distance <= 18;
      target.classList.toggle('is-near-target', nearTarget);
      dialGesture.rotation = distance <= 4 ? dialGesture.max : nearTarget ? dialGesture.max - distance * distance / 18 : dialGesture.rawRotation;
      wheel.style.setProperty('--dial-rotation', `${dialGesture.rotation}deg`);
    });
    button.addEventListener('pointerup', event => {
      if (!dialGesture || dialGesture.id !== event.pointerId) return;
      const { rotation, max } = dialGesture;
      dialGesture = null;
      if (rotation === max) {
        appendDigit(button.dataset.digit);
        pulseTarget();
      }
      returnWheel(rotation);
    });
    button.addEventListener('pointercancel', event => {
      if (!dialGesture || dialGesture.id !== event.pointerId) return;
      const { rotation } = dialGesture;
      dialGesture = null;
      returnWheel(rotation);
    });
  });
  alternate.addEventListener('click', () => {
    const rotaryMode = alternate.getAttribute('aria-checked') !== 'true';
    alternate.setAttribute('aria-checked', String(rotaryMode));
    switchImage.src = rotaryMode ? './assets/topup-switch-on.svg' : './assets/topup-switch-off.svg';
    keyboard.hidden = rotaryMode;
    rotary.hidden = !rotaryMode;
    screen.classList.toggle('is-rotary', rotaryMode);
    dialGesture = null;
    resetWheel();
  });
  screen.querySelector('.topup-back').addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.href = `./index.html${account.returnQuery}`;
  });
  screen.querySelector('.topup-history').addEventListener('click', () => showToast('История пополнений пока недоступна'));
  screen.querySelector('.topup-card').addEventListener('click', () => showToast('Выбор карты пока недоступен'));
  pay.addEventListener('click', () => showToast('Оплата в прототипе пока не подключена'));
  renderAmount();
})();
