(() => {
  const viewer = document.querySelector('.story-viewer');
  if (!viewer) return;
  const stage = viewer.querySelector('.story-stage');
  const slidesRoot = viewer.querySelector('.story-slides');
  const card = viewer.querySelector('.story-card');
  const progress = viewer.querySelector('.story-progress');
  const closeButton = viewer.querySelector('.story-close');
  const action = viewer.querySelector('.story-subscribe');
  const share = viewer.querySelector('.story-share');
  const loading = viewer.querySelector('.story-loading');
  const toast = viewer.querySelector('.story-toast');
  const duration = 5000;
  const assetPromises = new WeakMap();
  let groups = [];
  let contentPromise;
  let groupIndex = 0;
  let slideIndex = 0;
  let elapsed = 0;
  let lastTick = 0;
  let animation = 0;
  let generation = 0;
  let ready = false;
  let failed = false;
  let sharing = false;
  let gesture = null;
  let trigger = null;
  let historyOwned = false;
  let toastTimeout;
  let transitioning = false;
  let transitionVersion = 0;
  let transitionCube;
  let transitionAnimations = [];

  function safeUrl(value) {
    const url = new URL(value, document.baseURI);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported story URL');
    return url.href;
  }

  function image(src, className, alt = '') {
    const element = document.createElement('img');
    element.dataset.src = safeUrl(src);
    element.className = className;
    element.alt = alt;
    element.draggable = false;
    return element;
  }

  function createSlide(data) {
    if (!data.title || !data.subtitle || !data.image || !data.background || !data.action?.label) {
      throw new Error('Incomplete story content');
    }
    const slide = document.createElement('section');
    slide.className = 'story-slide';
    slide.hidden = true;
    slide.dataset.layout = data.layout === 'protection' ? 'protection' : 'standard';
    slide.setAttribute('aria-label', data.title);
    const visual = document.createElement('div');
    visual.className = 'story-visual';
    visual.setAttribute('aria-hidden', 'true');
    const illustration = image(data.image, 'story-illustration');
    const size = data.imageLayout;
    if (size && Number.isFinite(size.width) && size.width > 0 && Number.isFinite(size.height) && size.height > 0) {
      illustration.style.width = size.width + 'px';
      illustration.style.height = size.height + 'px';
      illustration.style.marginLeft = (Number.isFinite(size.offsetX) ? size.offsetX : 0) + 'px';
    }
    visual.append(illustration);
    const copy = document.createElement('div');
    copy.className = 'story-copy';
    copy.tabIndex = 0;
    const title = document.createElement('h2');
    title.className = 'story-heading';
    if (data.titleBadge === 'assistant-plus') {
      const split = data.title.lastIndexOf(' ', data.title.lastIndexOf(' ') - 1);
      title.append(document.createTextNode(split < 0 ? '' : data.title.slice(0, split + 1)));
      const ending = document.createElement('span');
      ending.className = 'story-title-ending';
      ending.append(document.createTextNode(data.title.slice(split + 1)));
      const badge = document.createElement('span');
      badge.className = 'story-plus-label';
      badge.append(image('./assets/assistant-2f0a6.svg', '', 'плюс'));
      ending.append(badge);
      title.append(ending);
    } else title.textContent = data.title;
    const subtitle = document.createElement('p');
    subtitle.className = 'story-description';
    subtitle.textContent = data.subtitle;
    copy.append(title, subtitle);
    slide.append(visual, copy);
    return { ...data, href: data.action.href ? safeUrl(data.action.href) : null, element: slide };
  }

  function loadContent() {
    if (contentPromise) return contentPromise;
    contentPromise = fetch('./stories-content.json', { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Story content is unavailable');
        return response.json();
      }).then(data => {
        if (!Array.isArray(data.groups) || !data.groups.length) throw new Error('No story groups');
        const nextGroups = data.groups.map(group => {
          if (!Array.isArray(group.slides) || !group.slides.length) throw new Error('Empty story group');
          return { ...group, slides: group.slides.map(createSlide) };
        });
        groups = nextGroups;
        slidesRoot.replaceChildren(...groups.flatMap(group => group.slides.map(slide => slide.element)));
        return groups;
      }).catch(error => { contentPromise = null; throw error; });
    return contentPromise;
  }

  function loadImage(element) {
    if (assetPromises.has(element)) return assetPromises.get(element);
    const pending = new Promise((resolve, reject) => {
      const decoded = () => {
        if (element.classList.contains('story-illustration') && !element.style.width) {
          element.style.width = element.naturalWidth / 2 + 'px';
          element.style.height = element.naturalHeight / 2 + 'px';
        }
        element.decode().then(resolve, reject);
      };
      element.onload = decoded;
      element.onerror = () => reject(new Error('Story image is unavailable'));
      element.src = element.dataset.src;
      if (element.complete && element.naturalWidth) decoded();
    }).catch(error => { assetPromises.delete(element); throw error; });
    assetPromises.set(element, pending);
    return pending;
  }

  function loadSlide(slide) {
    return Promise.all([...slide.element.querySelectorAll('img[data-src]'), ...viewer.querySelectorAll('.story-card > .story-background,.story-close img,.story-share img')].map(loadImage));
  }

  function renderProgress() {
    [...progress.children].forEach((bar, index) => {
      const amount = index < slideIndex ? 1 : index === slideIndex ? elapsed / duration : 0;
      bar.firstElementChild.style.transform = 'scaleX(' + Math.min(1, amount) + ')';
    });
  }

  function tick(now) {
    animation = 0;
    if (!viewer.open) return;
    const reading = document.activeElement?.matches('.story-slide:not([hidden]) .story-copy:focus-visible');
    if (ready && !transitioning && !gesture && !sharing && !reading && !document.hidden) elapsed += lastTick ? now - lastTick : 0;
    lastTick = now;
    renderProgress();
    if (ready && !transitioning && elapsed >= duration) { nextSlide(); return; }
    animation = requestAnimationFrame(tick);
  }

  async function showSlide(index) {
    const request = ++generation;
    slideIndex = index;
    elapsed = 0;
    lastTick = 0;
    ready = false;
    failed = false;
    toast.hidden = true;
    const group = groups[groupIndex];
    const slide = group.slides[index];
    card.dataset.theme = ['purple', 'orange', 'blue'].includes(slide.background.theme) ? slide.background.theme : '';
    card.style.backgroundColor = /^#[\da-f]{6}$/i.test(slide.background.color) ? slide.background.color : '#7767bc';
    card.querySelector('.story-background')?.remove();
    if (slide.background.image) card.prepend(image(slide.background.image, 'story-background'));
    [...slidesRoot.children].forEach(element => { element.hidden = element !== slide.element; });
    stage.dataset.slide = String(index);
    viewer.setAttribute('aria-label', 'Сториз ' + group.title);
    progress.replaceChildren(...group.slides.map(() => {
      const bar = document.createElement('span');
      bar.append(document.createElement('i'));
      return bar;
    }));
    progress.setAttribute('aria-label', 'Сториз ' + (index + 1) + ' из ' + group.slides.length);
    action.textContent = slide.action.label;
    action.disabled = true;
    share.disabled = true;
    loading.textContent = 'Загрузка…';
    loading.hidden = false;
    renderProgress();
    if (animation) cancelAnimationFrame(animation);
    animation = requestAnimationFrame(tick);
    try {
      await Promise.all([loadSlide(slide), document.fonts.ready]);
      if (request !== generation || !viewer.open) return;
      loading.hidden = true;
      ready = true;
      action.disabled = !slide.href;
      share.disabled = false;
      lastTick = 0;
      const upcoming = group.slides[index + 1];
      const next = upcoming || groups[groupIndex + 1]?.slides[0];
      if (next) loadSlide(next).catch(() => {});
      const previous = group.slides[index - 1] || groups[groupIndex - 1]?.slides.at(-1);
      if (previous) loadSlide(previous).catch(() => {});
    } catch {
      if (request !== generation || !viewer.open) return;
      failed = true;
      loading.textContent = 'Не удалось загрузить сториз. Нажмите, чтобы повторить.';
    }
  }

  function closeViewer(fromHistory = false) {
    if (!viewer.open) return;
    ++generation;
    cancelTransition();
    cancelAnimationFrame(animation);
    ready = false;
    gesture = null;
    viewer.close();
    document.body.classList.remove('stories-open');
    trigger?.focus({ preventScroll: true });
    if (historyOwned && !fromHistory) history.back();
    historyOwned = false;
  }

  function cancelTransition() {
    ++transitionVersion;
    transitionAnimations.forEach(item => item.cancel());
    transitionAnimations = [];
    transitionCube?.remove();
    transitionCube = null;
    card.style.visibility = '';
    transitioning = false;
    lastTick = 0;
  }

  function adjacentStory(direction) {
    if (direction > 0) {
      if (slideIndex + 1 < groups[groupIndex].slides.length) return { group: groupIndex, slide: slideIndex + 1 };
      if (groupIndex + 1 < groups.length) return { group: groupIndex + 1, slide: 0 };
    } else {
      if (slideIndex > 0) return { group: groupIndex, slide: slideIndex - 1 };
      if (groupIndex > 0) return { group: groupIndex - 1, slide: groups[groupIndex - 1].slides.length - 1 };
    }
    return null;
  }

  function previewCard(index, targetSlide) {
    const group = groups[index];
    const slide = group.slides[targetSlide];
    loadSlide(slide).catch(() => {});
    const preview = card.cloneNode(true);
    preview.classList.add('story-transition-side');
    preview.setAttribute('aria-hidden', 'true');
    preview.inert = true;
    preview.dataset.theme = ['purple', 'orange', 'blue'].includes(slide.background.theme) ? slide.background.theme : '';
    preview.style.backgroundColor = /^#[\da-f]{6}$/i.test(slide.background.color) ? slide.background.color : '#7767bc';
    preview.querySelector('.story-background')?.remove();
    if (slide.background.image) {
      const background = image(slide.background.image, 'story-background');
      preview.prepend(background);
      loadImage(background).catch(() => {});
    }
    const sourceSlides = [...slidesRoot.children];
    [...preview.querySelector('.story-slides').children].forEach((element, position) => {
      element.hidden = sourceSlides[position] !== slide.element;
    });
    const previewProgress = preview.querySelector('.story-progress');
    previewProgress.replaceChildren(...group.slides.map((_, position) => {
      const bar = document.createElement('span');
      const fill = document.createElement('i');
      fill.style.transform = `scaleX(${position < targetSlide ? 1 : 0})`;
      bar.append(fill);
      return bar;
    }));
    preview.querySelector('.story-subscribe').textContent = slide.action.label;
    preview.querySelector('.story-loading').hidden = true;
    preview.querySelector('.story-toast').hidden = true;
    return preview;
  }

  function createCube(index, targetSlide, direction) {
    const bounds = card.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const cube = document.createElement('div');
    cube.className = 'story-transition-cube';
    Object.assign(cube.style, {
      left: bounds.left - stageBounds.left + 'px',
      top: bounds.top - stageBounds.top + 'px',
      width: bounds.width + 'px',
      height: bounds.height + 'px'
    });
    const width = bounds.width;
    cube.style.perspective = width * 15 + 'px';
    cube.style.setProperty('--story-front-pivot', direction > 0 ? 'right center' : 'left center');
    cube.style.setProperty('--story-side-pivot', direction > 0 ? 'left center' : 'right center');
    const front = card.cloneNode(true);
    front.classList.add('story-transition-front');
    front.setAttribute('aria-hidden', 'true');
    front.inert = true;
    const side = previewCard(index, targetSlide);
    const frontBacking = document.createElement('div');
    frontBacking.className = 'story-cube-backing story-cube-backing-front';
    const sideBacking = document.createElement('div');
    sideBacking.className = 'story-cube-backing story-cube-backing-side';
    cube.append(frontBacking, sideBacking, front, side);
    stage.append(cube);
    transitionCube = cube;
    card.style.visibility = 'hidden';
    const state = { cube, front, side, frontBacking, sideBacking, width, direction, group: index, slide: targetSlide, progress: 0 };
    renderCube(state, 0);
    return state;
  }

  function cubeFaceTransform(position, backing = false) {
    return `translateX(${position * 100}%) rotateY(${position * 90}deg)${backing ? ' translateZ(-1px)' : ''}`;
  }

  function renderCube(state, progressValue) {
    const amount = Math.min(1, Math.max(0, progressValue));
    state.progress = amount;
    const frontPosition = -state.direction * amount;
    const sidePosition = state.direction * (1 - amount);
    state.front.style.transform = cubeFaceTransform(frontPosition);
    state.frontBacking.style.transform = cubeFaceTransform(frontPosition, true);
    state.side.style.transform = cubeFaceTransform(sidePosition);
    state.sideBacking.style.transform = cubeFaceTransform(sidePosition, true);
  }

  async function settleCube(state, complete, dragged = false) {
    const request = transitionVersion;
    const end = complete ? 1 : 0;
    const options = {
      duration: dragged ? Math.max(120, 260 * Math.abs(end - state.progress)) : 320,
      easing: 'ease-out', fill: 'both'
    };
    const faces = [
      [state.front, -state.direction * end, false],
      [state.frontBacking, -state.direction * end, true],
      [state.side, state.direction * (1 - end), false],
      [state.sideBacking, state.direction * (1 - end), true]
    ];
    transitionAnimations = faces.map(([element, position, backing]) => element.animate([
      { transform: element.style.transform },
      { transform: cubeFaceTransform(position, backing) }
    ], options));
    await Promise.all(transitionAnimations.map(item => item.finished.catch(() => {})));
    if (request !== transitionVersion || !viewer.open) return;
    if (complete) {
      groupIndex = state.group;
      await showSlide(state.slide);
      if (request !== transitionVersion || !viewer.open) return;
    }
    cancelTransition();
  }

  async function changeStory(index, targetSlide, direction) {
    if (transitioning || sharing || !ready) return;
    if (index === groupIndex) {
      await showSlide(targetSlide);
      return;
    }
    transitioning = true;
    const request = ++transitionVersion;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const bounds = card.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      const outgoing = card.cloneNode(true);
      outgoing.classList.add('story-transition-ghost');
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.inert = true;
      Object.assign(outgoing.style, {
        left: bounds.left - stageBounds.left + 'px', top: bounds.top - stageBounds.top + 'px',
        width: bounds.width + 'px', height: bounds.height + 'px'
      });
      transitionCube = outgoing;
      stage.append(outgoing);
      groupIndex = index;
      await showSlide(targetSlide);
      if (request !== transitionVersion || !viewer.open) return;
      transitionAnimations = [outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'both' })];
      await transitionAnimations[0].finished.catch(() => {});
      if (request === transitionVersion) cancelTransition();
      return;
    }
    const cube = createCube(index, targetSlide, direction);
    await settleCube(cube, true);
  }

  function nextGroup() {
    if (transitioning || sharing || !ready) return;
    if (groupIndex + 1 >= groups.length) return closeViewer();
    changeStory(groupIndex + 1, 0, 1);
  }
  function nextSlide() {
    if (transitioning) return;
    if (failed) return groups.length ? showSlide(slideIndex) : openGroup(trigger);
    if (!ready || sharing) return;
    if (slideIndex + 1 < groups[groupIndex].slides.length) changeStory(groupIndex, slideIndex + 1, 1);
    else nextGroup();
  }
  function previousSlide() {
    if (transitioning) return;
    if (failed) return nextSlide();
    if (!ready || sharing) return;
    if (slideIndex > 0) changeStory(groupIndex, slideIndex - 1, -1);
    else if (groupIndex > 0) {
      changeStory(groupIndex - 1, groups[groupIndex - 1].slides.length - 1, -1);
    } else showSlide(0);
  }

  async function openGroup(button, initialSlide = 0) {
    trigger = button;
    if (!viewer.open) {
      viewer.showModal();
      document.body.classList.add('stories-open');
      history.pushState({ ...history.state, storyViewer: true }, '');
      historyOwned = true;
      viewer.focus({ preventScroll: true });
    }
    const request = ++generation;
    ready = false;
    failed = false;
    loading.hidden = false;
    loading.textContent = 'Загрузка…';
    try {
      const availableGroups = await loadContent();
      if (request !== generation || !viewer.open) return;
      // Capture this SIM's visible order for the entire viewing session.
      const orderedIds = [...document.querySelectorAll('.stories [data-story-group]')]
        .map(item => item.dataset.storyGroup);
      const byId = new Map(availableGroups.map(group => [group.id, group]));
      const orderedGroups = [...new Set(orderedIds)].map(id => byId.get(id)).filter(Boolean);
      groups = orderedGroups;
      groupIndex = groups.findIndex(group => group.id === button.dataset.storyGroup);
      if (groupIndex < 0) return closeViewer();
      showSlide(Math.min(initialSlide, groups[groupIndex].slides.length - 1));
    } catch {
      if (request !== generation || !viewer.open) return;
      failed = true;
      loading.textContent = 'Не удалось загрузить сториз. Нажмите, чтобы повторить.';
    }
  }

  document.addEventListener('pointerover', (event) => {
    const button = event.target.closest('.stories [data-story-group]');
    if (!button || button.dataset.preloaded) return;
    button.dataset.preloaded = 'true';
    loadContent().then(items => {
      const group = items.find(item => item.id === button.dataset.storyGroup);
      if (group) return loadSlide(group.slides[0]);
    }).catch(() => {});
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-story-group]');
    if (!button) return;
    if (button.classList.contains('story-mini-trigger')) {
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      return;
    }
    if (!viewer.open) openGroup(button);
  });
  closeButton.addEventListener('click', () => closeViewer());
  action.addEventListener('click', () => {
    if (!ready || transitioning || !groups[groupIndex].slides[slideIndex].href) return;
    const href = groups[groupIndex].slides[slideIndex].href;
    ++generation;
    cancelAnimationFrame(animation);
    ready = false;
    gesture = null;
    viewer.close();
    document.body.classList.remove('stories-open');
    history.replaceState({ ...history.state, storyViewer: false }, '');
    historyOwned = false;
    location.assign(href);
  });
  function showToast(message) {
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.hidden = false;
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 2500);
  }
  share.addEventListener('click', async () => {
    if (!ready || transitioning || sharing) return;
    sharing = true;
    lastTick = 0;
    const url = new URL('./', location.href);
    url.searchParams.set('story', groups[groupIndex].id);
    if (groups[groupIndex].id.startsWith('compact-')) url.searchParams.set('sim', 'fourth');
    url.searchParams.set('slide', String(slideIndex + 1));
    try {
      if (navigator.share) await navigator.share({ title: groups[groupIndex].slides[slideIndex].title, url: url.href });
      else {
        await navigator.clipboard.writeText(url.href);
        showToast('Ссылка скопирована');
      }
    } catch (error) {
      if (error.name !== 'AbortError') showToast('Не удалось поделиться. Попробуйте через меню браузера.');
    } finally { sharing = false; lastTick = 0; }
  });
  viewer.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
  window.addEventListener('popstate', () => { if (viewer.open) closeViewer(true); });
  document.addEventListener('visibilitychange', () => { lastTick = 0; });
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); nextSlide(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); previousSlide(); }
  });
  viewer.querySelector('.story-previous').addEventListener('click', event => { if (event.detail === 0) previousSlide(); });
  viewer.querySelector('.story-next').addEventListener('click', event => { if (event.detail === 0) nextSlide(); });
  stage.addEventListener('pointerdown', event => {
    if (transitioning || !event.isPrimary || event.button !== 0 || event.target.closest('.story-close,.story-actions')) return;
    const copy = event.target.closest('.story-copy');
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), scrollable: copy && copy.scrollHeight > copy.clientHeight + 1, horizontal: false, drag: null };
    // Native vertical scrolling needs the original target to keep pointer capture.
    if (!gesture.scrollable) stage.setPointerCapture(event.pointerId);
    lastTick = 0;
  });
  stage.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId || !ready || sharing) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.horizontal && (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy))) return;
    gesture.horizontal = true;
    if (!stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
    event.preventDefault();
    if (Math.abs(dx) < 5) {
      if (gesture.drag) renderCube(gesture.drag, 0);
      return;
    }
    const direction = dx < 0 ? 1 : -1;
    if (gesture.drag && gesture.drag.direction !== direction) {
      cancelTransition();
      gesture.drag = null;
    }
    if (!gesture.drag && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const target = adjacentStory(direction);
      if (target && target.group !== groupIndex) {
        transitioning = true;
        ++transitionVersion;
        gesture.drag = createCube(target.group, target.slide, direction);
      }
    }
    if (gesture.drag) renderCube(gesture.drag, Math.abs(dx) / gesture.drag.width);
    lastTick = 0;
  });
  stage.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const start = gesture;
    gesture = null;
    lastTick = 0;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (start.drag) {
      const fast = Math.abs(dx) > 24 && Math.abs(dx) / Math.max(1, performance.now() - start.at) > .5;
      settleCube(start.drag, start.drag.progress >= .28 || fast, true);
      return;
    }
    if (start.horizontal) {
      if (Math.abs(dx) >= 48) {
        const direction = dx < 0 ? 1 : -1;
        const target = adjacentStory(direction);
        if (target) changeStory(target.group, target.slide, direction);
        else if (direction > 0) closeViewer();
      }
    } else if (!start.scrollable && dy >= 64 && Math.abs(dy) > Math.abs(dx)) closeViewer();
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && performance.now() - start.at < 250) {
      const bounds = stage.getBoundingClientRect();
      if (event.clientX - bounds.left < bounds.width * .3) previousSlide();
      else nextSlide();
    }
  });
  stage.addEventListener('pointercancel', () => {
    if (gesture?.drag) settleCube(gesture.drag, false, true);
    gesture = null;
    lastTick = 0;
  });
  loadContent().catch(() => {});
  const parameters = new URLSearchParams(location.search);
  const requestedGroup = parameters.get('story');
  const requestedSlide = Number(parameters.get('slide'));
  const linkedTrigger = [...document.querySelectorAll('[data-story-group]')].find(button => button.dataset.storyGroup === requestedGroup);
  if (linkedTrigger) {
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete('story');
    cleanUrl.searchParams.delete('slide');
    history.replaceState(history.state, '', cleanUrl);
    openGroup(linkedTrigger, Number.isInteger(requestedSlide) && requestedSlide > 0 ? requestedSlide - 1 : 0);
  }
})();
