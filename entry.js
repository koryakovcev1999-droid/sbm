(() => {
  window.addEventListener('pageshow', () => {
    window.sessionStorage.removeItem('sbm-return-from-profile');
  });
  const splash = document.querySelector('.holiday-splash');
  if (!splash) return;
  if (!document.body.classList.contains('is-loading')) {
    splash.remove();
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function showMainScreen() {
    document.body.classList.remove('is-loading');
    splash.remove();
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('resize'));
  }

  // Hidden stories and lower-page artwork must not keep the splash on screen.
  const selectedSim = new URLSearchParams(location.search).get('sim');
  const cardIndex = selectedSim === 'fourth' ? 3 : selectedSim === 'third' ? 2 : selectedSim === 'second' ? 1 : 0;
  const cardArt = document.querySelectorAll('.account-card .sim-art')[cardIndex];
  Promise.all([
    new Promise(resolve => window.setTimeout(resolve, reducedMotion.matches ? 100 : 1200)),
    document.fonts.ready,
    cardArt?.decode().catch(() => {})
  ]).then(showMainScreen);
})();

(() => {
  const header = document.querySelector('.header');
  if (!header) return;
  const updateShadow = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', updateShadow, { passive: true });
  window.addEventListener('pageshow', updateShadow);
  updateShadow();
})();

(() => {
  const stories = document.querySelector('.stories');
  const mini = document.querySelector('.stories-mini');
  const matchBanner = document.querySelector('.tariff-match-banner');
  if (!stories || !mini) return;
  const originalCards = [...stories.querySelectorAll('.story')];
  const compactCards = [...document.querySelector('#compact-stories').content.cloneNode(true).querySelectorAll('.story')];
  let cards = originalCards;
  let floatingCards = [...mini.querySelectorAll('.story-mini-trigger')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let currentProgress = 0;
  let targetProgress = 0;
  let previousTime = 0;
  let bannerActive = false;
  function render(amount) {
    const motion = amount;
    const floatingVisible = !bannerActive && amount > .001;
    const sourceBounds = cards.map((card) => card.getBoundingClientRect());
    stories.style.visibility = floatingVisible ? 'hidden' : 'visible';
    stories.inert = bannerActive || floatingVisible;
    const targetLeft = (window.innerWidth - (32 + (floatingCards.length - 1) * 24)) / 2;

    floatingCards.forEach((floatingCard, index) => {
      const bounds = sourceBounds[index];
      if (!bounds) return;
      const destinationX = targetLeft + index * 24;
      const x = bounds.left + (destinationX - bounds.left) * motion;
      const sourceY = bounds.top + window.scrollY;
      const y = sourceY + (22 - sourceY) * motion;
      const width = bounds.width + (32 - bounds.width) * motion;
      const height = bounds.height + (32 - bounds.height) * motion;
      floatingCard.style.left = `${x}px`;
      floatingCard.style.top = `${y}px`;
      floatingCard.style.width = `${width}px`;
      floatingCard.style.height = `${height}px`;
      floatingCard.style.borderRadius = `${24 + (16 - 24) * motion}px`;
      floatingCard.style.boxShadow = `0 0 0 ${2 * motion}px var(--background)`;
      floatingCard.style.visibility = floatingVisible ? 'visible' : 'hidden';
      floatingCard.style.pointerEvents = floatingVisible ? 'auto' : 'none';
      floatingCard.style.zIndex = String(floatingCards.length - index);
      floatingCard.tabIndex = floatingVisible ? 0 : -1;
    });
  }

  function update(time) {
    frame = 0;
    const elapsed = previousTime ? Math.min(64, time - previousTime) : 16;
    previousTime = time;
    currentProgress += (targetProgress - currentProgress) * (1 - Math.exp(-elapsed / 65));
    if (Math.abs(targetProgress - currentProgress) < .001) currentProgress = targetProgress;
    render(currentProgress);
    if (currentProgress !== targetProgress) frame = window.requestAnimationFrame(update);
    else previousTime = 0;
  }

  function scheduleUpdate() {
    targetProgress = bannerActive ? 0 : Math.min(1, Math.max(0, window.scrollY / 118));
    if (bannerActive) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      currentProgress = 0;
      previousTime = 0;
      render(0);
      return;
    }
    if (reducedMotion.matches) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      currentProgress = Number(targetProgress >= .5);
      render(currentProgress);
      return;
    }
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  function setStoryOrder(index) {
    bannerActive = index === 2 && !!matchBanner;
    stories.hidden = bannerActive;
    mini.inert = bannerActive;
    if (matchBanner) matchBanner.hidden = !bannerActive;
    const order = index === 1 ? [2, 0, 1] : [0, 1, 2];
    cards = index === 3 ? compactCards : order.map((position) => originalCards[position]);
    stories.replaceChildren(...cards);
    document.body.classList.toggle('has-compact-sim', index === 3);
    floatingCards = cards.map((source) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'story-mini-trigger story-trigger';
      card.append(source.querySelector('img').cloneNode());
      card.dataset.storyGroup = source.dataset.storyGroup;
      card.setAttribute('aria-label', source.getAttribute('aria-label').replace(/^Открыть сториз /, 'Прокрутить к сториз '));
      return card;
    });
    mini.replaceChildren(...floatingCards);
    stories.scrollLeft = 0;
    scheduleUpdate();
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('simchange', (event) => setStoryOrder(event.detail.index));
  stories.addEventListener('scroll', scheduleUpdate, { passive: true });
  reducedMotion.addEventListener('change', scheduleUpdate);
  setStoryOrder(new URLSearchParams(location.search).get('sim') === 'fourth' ? 3 : 0);
})();

(() => {
  document.addEventListener('pointerdown', () => document.body.classList.add('pointer-input'), { capture: true });
  document.addEventListener('keydown', () => document.body.classList.remove('pointer-input'), { capture: true });
})();

(() => {
  const triggers = [...document.querySelectorAll('.number-menu')];
  const control = document.querySelector('.number-control');
  const closeButton = control?.querySelector('.number-control-close');
  if (!triggers.length || !control || !closeButton) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let closeTimer;
  let activeTrigger = triggers[0];

  function closeControl() {
    if (!control.open || control.classList.contains('is-closing')) return;
    if (reducedMotion.matches) {
      control.close();
      return;
    }
    control.classList.add('is-closing');
    closeTimer = window.setTimeout(() => control.close(), 280);
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      if (control.open) return;
      activeTrigger = trigger;
      control.showModal();
      document.body.classList.add('control-open');
    });
  });

  closeButton.addEventListener('click', closeControl);
  control.querySelector('.number-control-tile:last-child')?.addEventListener('click', () => {
    window.location.href = `./topup.html?sim=${triggers.indexOf(activeTrigger)}`;
  });
  control.addEventListener('click', (event) => {
    const bounds = control.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      closeControl();
    }
  });
  control.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeControl();
  });
  control.addEventListener('close', () => {
    window.clearTimeout(closeTimer);
    control.classList.remove('is-closing');
    document.body.classList.remove('control-open');
    activeTrigger.focus();
  });
})();

(() => {
  const carouselFrame = document.querySelector('.account-carousel-frame');
  const carousel = document.querySelector('.account-carousel');
  if (!carousel || !carouselFrame) return;
  const cards = [...carousel.querySelectorAll('.account-card')];
  const blocks = [...document.querySelectorAll('.main > .tariff, .main > .quick-cards, .main > .security-card, .main > .service-row')];
  if (cards.length < 2 || !blocks.length) return;
  const tariff = document.querySelector('.tariff');
  const values = [...tariff.querySelectorAll('[data-count-to]')];
  const bars = [...tariff.querySelectorAll('.usage-bar > span')];
  const tariffByCard = [
    { gb: 10, minutes: 600 },
    { gb: 5, minutes: 200 },
    { gb: 10, minutes: 600 },
    { gb: 10, minutes: 600 }
  ];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = 0;
  const selectedSim = new URLSearchParams(window.location.search).get('sim');
  let initialCardIndex = selectedSim === 'fourth' ? 3 : selectedSim === 'third' ? 2 : selectedSim === 'second' ? 1 : null;
  let frame = 0;
  let naturalHeights;
  let measuredWidth = 0;
  const heightsByWidth = new Map();

  function rememberCardHeights(width) {
    const savedHeights = heightsByWidth.get(width);
    if (savedHeights) {
      naturalHeights = savedHeights;
    } else {
      carousel.style.height = '';
      cards.forEach((card) => { card.style.height = ''; });
      naturalHeights = cards.map((card) => card.offsetHeight);
      heightsByWidth.set(width, naturalHeights);
    }
    measuredWidth = width;
    carousel.style.height = `${Math.max(...naturalHeights)}px`;
  }

  function updateTariff(index) {
    const data = tariffByCard[index] || tariffByCard[0];
    values[0].textContent = data.gb;
    values[0].dataset.countTo = data.gb;
    values[1].textContent = data.minutes;
    values[1].dataset.countTo = data.minutes;
    tariff.setAttribute('aria-label', `Мой тариф: ${data.gb} Гб из 10, ${data.minutes} минут из 600`);
  }

  function render() {
    frame = 0;
    const width = carousel.clientWidth;
    if (!width) return;
    if (width !== measuredWidth) rememberCardHeights(width);
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    if (initialCardIndex !== null) {
      carousel.scrollLeft = maxScroll * initialCardIndex / (cards.length - 1);
      initialCardIndex = null;
    }
    const position = maxScroll ? Math.min(cards.length - 1, Math.max(0, carousel.scrollLeft / maxScroll * (cards.length - 1))) : 0;
    const fromIndex = Math.floor(position);
    const toIndex = Math.min(fromIndex + 1, cards.length - 1);
    const progress = position - fromIndex;
    const visibleHeight = naturalHeights[fromIndex] + (naturalHeights[toIndex] - naturalHeights[fromIndex]) * progress;
    carouselFrame.style.height = `${visibleHeight}px`;
    cards.forEach((card) => { card.style.height = `${visibleHeight}px`; });
    const nextIndex = Math.round(position);
    if (nextIndex !== activeIndex) {
      activeIndex = nextIndex;
      updateTariff(nextIndex);
      window.dispatchEvent(new CustomEvent('simchange', { detail: { index: nextIndex } }));
    }

    if (reducedMotion.matches) {
      bars[0].style.width = `${tariffByCard[nextIndex].gb * 10}%`;
      bars[1].style.width = `${tariffByCard[nextIndex].minutes / 6}%`;
      blocks.forEach((block) => {
        block.style.opacity = '';
        block.style.transform = '';
      });
      return;
    }

    const dip = 4 * progress * (1 - progress);
    blocks.forEach((block) => {
      block.style.opacity = `${1 - .75 * dip}`;
      block.style.transform = `translate3d(0, ${24 * dip}px, 0)`;
    });
    const fromTariff = tariffByCard[fromIndex];
    const toTariff = tariffByCard[toIndex];
    bars[0].style.width = `${(fromTariff.gb + (toTariff.gb - fromTariff.gb) * progress) * 10}%`;
    bars[1].style.width = `${(fromTariff.minutes + (toTariff.minutes - fromTariff.minutes) * progress) / 6}%`;
  }

  function scheduleRender() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  carousel.addEventListener('scroll', scheduleRender, { passive: true });
  carousel.addEventListener('scrollend', scheduleRender);
  window.addEventListener('resize', scheduleRender);
  window.addEventListener('pageshow', scheduleRender);
  reducedMotion.addEventListener('change', scheduleRender);
  scheduleRender();
})();
