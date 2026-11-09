(() => {
  const page = document.querySelector('.network-page');
  if (!page) return;

  const panels = Object.fromEntries([...page.querySelectorAll('[data-network-panel]')].map((panel) => [panel.dataset.networkPanel, panel]));
  const tabs = [...page.querySelectorAll('[data-network-tab]')];
  const options = [...page.querySelectorAll('[data-network]')];
  const recommended = page.querySelector('.network-recommended');
  const bestOption = options.filter((option) => Number.isFinite(Number(option.dataset.downloadMbps)))
    .reduce((best, option) => !best || Number(option.dataset.downloadMbps) > Number(best.dataset.downloadMbps) ? option : best, null);
  bestOption?.querySelector('.network-option-end')?.prepend(recommended);
  const warning = page.querySelector('.network-warning');
  const info = page.querySelector('.network-info');
  const choiceScroll = page.querySelector('.network-choice-scroll');
  const actions = page.querySelector('.network-actions');
  const save = page.querySelector('.network-save');
  const targetName = page.querySelector('.network-target-name');
  const gauge = page.querySelector('.network-speed-gauge');
  const ring = page.querySelector('.network-speed-ring-progress');
  const ringRight = page.querySelector('.network-speed-ring-progress-right');
  const ringCap = page.querySelector('.network-speed-ring-cap');
  const play = page.querySelector('.network-speed-play');
  const privacy = page.querySelector('.network-speed-privacy');
  const spinner = page.querySelector('.network-speed-spinner');
  const value = page.querySelector('.network-speed-value');
  const speedNumber = value.querySelector('strong');
  const stop = page.querySelector('.network-speed-stop');
  const stopProgress = stop.querySelector('.network-stop-progress');
  const direction = page.querySelector('.network-speed-direction');
  const directionIcon = direction.querySelector('img');
  const directionLabel = direction.querySelector('span');
  const picker = page.querySelector('.network-phone-picker');
  const phoneTrigger = page.querySelector('.network-phone-trigger');
  const phoneNumber = page.querySelector('.network-phone-number');
  const accountName = page.querySelector('.network-account-name');
  const phones = { main: { number: '+7 (999) 252-61-05', name: 'Главная' }, second: { number: '+7 (914) 680-40-60', name: 'Вторая SIM' }, third: { number: '+7 (914) 680-40-61', name: 'Главная' } };
  const names = { auto: 'Мультисеть', t2: 'Т2', megafon: 'МегаФон' };
  const speedMaxMbps = 60;
  let current = 'auto';
  let phone = 'main';
  let pendingReconnect = null;
  try {
    const storedNetwork = localStorage.getItem('sbm-selected-network');
    const storedPhone = localStorage.getItem('sbm-selected-phone');
    if (storedNetwork in names) current = storedNetwork;
    if (storedPhone in phones) phone = storedPhone;
    const storedPending = localStorage.getItem('sbm-pending-network');
    if (storedPending) {
      const pending = JSON.parse(storedPending);
      if (pending && pending.network in names && Number.isFinite(pending.deadline)) {
        if (Date.now() >= pending.deadline) {
          current = pending.network;
          localStorage.setItem('sbm-selected-network', current);
          localStorage.removeItem('sbm-pending-network');
        } else pendingReconnect = pending;
      } else localStorage.removeItem('sbm-pending-network');
    }
  } catch (_) { /* Storage can be unavailable in private browsing. */ }
  let selected = pendingReconnect?.network || current;
  let stage = 'choice';
  let reconnectTimer = 0;
  let infoShiftAnimation = null;
  let speedFrame = 0;
  let speedStarted = 0;
  let pickerOpenedHere = false;

  function renderPhone() {
    phoneNumber.textContent = phones[phone].number;
    accountName.textContent = phones[phone].name;
  }

  function setPanel(next) {
    stage = next;
    Object.entries(panels).forEach(([name, panel]) => { panel.hidden = name !== next; });
    const activeTab = next === 'speed' || next === 'result' ? 'speed' : 'choice';
    tabs.forEach((tab) => {
      const active = tab.dataset.networkTab === activeTab;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
      tab.disabled = next === 'reconnect';
    });
    phoneTrigger.disabled = next === 'reconnect';
  }

  function renderChoice() {
    options.forEach((option) => option.setAttribute('aria-checked', String(option.dataset.network === selected)));
    recommended.hidden = !bestOption || current === bestOption.dataset.network;
    const changed = selected !== current;
    const animateChange = stage === 'choice' && warning.hidden !== !changed && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousInfoTop = animateChange ? info.getBoundingClientRect().top : 0;
    if (animateChange) infoShiftAnimation?.cancel();
    warning.hidden = !changed;
    if (animateChange) {
      const shift = previousInfoTop - info.getBoundingClientRect().top;
      if (shift) infoShiftAnimation = info.animate(
        [{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }],
        { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' }
      );
    }
    save.disabled = !changed;
    if (changed && stage === 'choice') requestAnimationFrame(() => {
      const overlap = warning.getBoundingClientRect().bottom - actions.getBoundingClientRect().top;
      if (overlap > -12) choiceScroll.scrollBy({ top: overlap + 12, behavior: 'smooth' });
    });
  }

  function finishReconnect() {
    if (!pendingReconnect) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
    current = pendingReconnect.network;
    selected = current;
    pendingReconnect = null;
    try {
      localStorage.setItem('sbm-selected-network', current);
      localStorage.removeItem('sbm-pending-network');
    } catch (_) { /* The selection still works for this visit. */ }
    choiceScroll.scrollTop = 0;
    renderChoice();
    setPanel('choice');
  }

  function showReconnect() {
    if (!pendingReconnect) return;
    targetName.textContent = names[pendingReconnect.network];
    setPanel('reconnect');
    clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(finishReconnect, Math.max(0, pendingReconnect.deadline - Date.now()));
  }

  function startReconnect() {
    if (save.disabled || stage !== 'choice') return;
    pendingReconnect = { network: selected, deadline: Date.now() + 10000 };
    try { localStorage.setItem('sbm-pending-network', JSON.stringify(pendingReconnect)); } catch (_) { /* The timer still works for this visit. */ }
    showReconnect();
  }

  function drawSpeedRing(fraction) {
    const portion = Math.min(1, Math.max(0, fraction));
    let remaining = portion * (2 * Math.PI * 155 + 264);
    if (remaining <= 0) {
      ring.removeAttribute('d');
      ringRight.removeAttribute('d');
      ringCap.style.opacity = '0';
      return;
    }
    const quarter = Math.PI * 155 / 2;
    let path = 'M164 451';
    let endX = 164;
    let endY = 451;
    const showCap = (gradient) => {
      ringCap.setAttribute('cx', endX.toFixed(3));
      ringCap.setAttribute('cy', endY.toFixed(3));
      ringCap.style.fill = `url(#network-speed-gradient${gradient})`;
      ringCap.style.opacity = portion >= .005 && portion < 1 ? '1' : '0';
    };
    const arc = (cx, cy, start) => {
      const length = Math.min(remaining, quarter);
      if (length <= 0) return;
      const angle = start + length / 155;
      endX = cx + 155 * Math.cos(angle);
      endY = cy + 155 * Math.sin(angle);
      path += ` A155 155 0 0 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`;
      remaining -= length;
    };
    const line = (x, y, dx, dy) => {
      const length = Math.min(remaining, 132);
      if (length <= 0) return;
      endX = x + dx * length;
      endY = y + dy * length;
      path += ` L${endX.toFixed(3)} ${endY.toFixed(3)}`;
      remaining -= length;
    };
    arc(164, 296, Math.PI / 2);
    line(9, 296, 0, -1);
    arc(164, 164, Math.PI);
    ring.setAttribute('d', path);
    if (remaining <= 0) { ringRight.removeAttribute('d'); showCap(''); return; }
    path = 'M164 9';
    arc(164, 164, 3 * Math.PI / 2);
    line(319, 164, 0, 1);
    arc(164, 296, 0);
    ringRight.setAttribute('d', path);
    showCap('-right');
  }

  function resetSpeed() {
    if (speedFrame) cancelAnimationFrame(speedFrame);
    speedFrame = 0;
    speedStarted = 0;
    gauge.dataset.speedStage = 'ready';
    drawSpeedRing(0);
    stopProgress.style.strokeDashoffset = '100';
    play.hidden = false;
    privacy.classList.remove('is-hidden');
    spinner.hidden = true;
    value.hidden = true;
    stop.hidden = true;
    direction.hidden = true;
    speedNumber.textContent = '0,00';
  }

  function showSpeedReading(phase, progress, peak) {
    const ramp = peak * (1 - Math.exp(-progress * 6));
    const wobble = peak * .075 * Math.sin(Math.PI * progress) * (Math.sin(progress * 18) + .35 * Math.sin(progress * 42));
    const reading = Math.max(0, ramp + wobble);
    gauge.dataset.speedStage = phase;
    spinner.hidden = true;
    value.hidden = false;
    stop.hidden = false;
    direction.hidden = false;
    directionIcon.src = phase === 'download' ? './assets/network-speed-down.svg' : './assets/network-speed-up.svg';
    directionLabel.textContent = phase === 'download' ? 'Входящая' : 'Исходящая';
    speedNumber.textContent = reading.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    drawSpeedRing(reading / speedMaxMbps);
    stopProgress.style.strokeDashoffset = String(100 - progress * 100);
  }

  function speedTick(now) {
    if (stage !== 'speed') return;
    const elapsed = now - speedStarted;
    if (elapsed < 1200 || (elapsed >= 9860 && elapsed < 10360)) {
      gauge.dataset.speedStage = 'loading';
      spinner.hidden = false;
      value.hidden = true;
      stop.hidden = true;
      direction.hidden = true;
      drawSpeedRing(0);
      stopProgress.style.strokeDashoffset = '100';
    } else if (elapsed < 5980) {
      showSpeedReading('download', Math.min(1, (elapsed - 1200) / 4600), 51.63);
    } else if (elapsed < 9860) {
      showSpeedReading('upload', Math.min(1, (elapsed - 5980) / 3700), 22.32);
    } else {
      resetSpeed();
      setPanel('result');
      return;
    }
    speedFrame = requestAnimationFrame(speedTick);
  }

  function startSpeed() {
    resetSpeed();
    setPanel('speed');
    play.hidden = true;
    privacy.classList.add('is-hidden');
    speedStarted = performance.now();
    speedFrame = requestAnimationFrame(speedTick);
  }

  function syncPicker(restoreFocus = true) {
    const open = location.hash === '#phones';
    picker.hidden = !open;
    page.classList.toggle('is-choosing-phone', open);
    page.querySelector('.network-header').inert = open;
    page.querySelector('.network-tabs').inert = open;
    Object.values(panels).forEach((panel) => { panel.inert = open; });
    if (restoreFocus) {
      if (open) page.querySelector('.network-picker-back').focus({ preventScroll: true });
      else phoneTrigger.focus({ preventScroll: true });
    }
  }

  function closePicker() {
    if (pickerOpenedHere) {
      pickerOpenedHere = false;
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      syncPicker();
    }
  }

  options.forEach((option, index) => {
    option.addEventListener('click', () => { selected = option.dataset.network; renderChoice(); });
    option.addEventListener('keydown', (event) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + options.length) % options.length;
      options[next].click();
      options[next].focus();
    });
  });
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    if (stage === 'reconnect') return;
    resetSpeed();
    if (tab.dataset.networkTab === 'speed') setPanel('speed');
    else { setPanel('choice'); renderChoice(); }
  }));
  save.addEventListener('click', startReconnect);
  play.addEventListener('click', startSpeed);
  stop.addEventListener('click', resetSpeed);
  page.querySelector('.network-speed-again').addEventListener('click', startSpeed);
  phoneTrigger.addEventListener('click', () => { if (stage !== 'reconnect') { pickerOpenedHere = true; location.hash = 'phones'; } });
  page.querySelector('.network-picker-back').addEventListener('click', closePicker);
  page.querySelectorAll('[data-phone]').forEach((option) => option.addEventListener('click', () => {
    phone = option.dataset.phone;
    try { localStorage.setItem('sbm-selected-phone', phone); } catch (_) { /* The selection still works for this visit. */ }
    renderPhone();
    closePicker();
  }));
  window.addEventListener('hashchange', syncPicker);
  window.addEventListener('pageshow', () => {
    if (!pendingReconnect) return;
    if (Date.now() >= pendingReconnect.deadline) finishReconnect();
    else showReconnect();
  });
  renderPhone();
  renderChoice();
  syncPicker(false);
  if (pendingReconnect) showReconnect();
})();
