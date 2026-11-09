(() => {
  const content = document.querySelector('#match-content');
  if (!content) return;
  const smile = './assets/tariff-match-smile.webp';
  const home = './index.html?sim=third';
  const profileFields = {
    gender: { title: 'Ваш пол', options: [{ value: 'male', label: 'Мужчина' }, { value: 'female', label: 'Женщина' }] },
    age: { title: 'Ваш возраст', options: [{ value: 'under18', label: 'До 18' }, { value: '18-24', label: '18–24' }, { value: '25-34', label: '25–34' }, { value: '35-44', label: '35–44' }, { value: '45-54', label: '45–54' }, { value: '55plus', label: '55+' }] }
  };
  const questions = [
    { key: 'internet', title: 'Какой у вас ритм?', caption: 'Расскажите, как проводите время в телефоне', options: [
      { value: 'light', icon: 'chat', title: 'На связи с близкими', caption: 'Чаты, соцсети и иногда карты' },
      { value: 'video', icon: 'video', title: 'Ещё одно видео', caption: 'Музыка, ролики и сериалы по дороге' },
      { value: 'unlimited', icon: 'unlimited', title: 'Всё и сразу', caption: 'Смотрю, играю, раздаю интернет' }
    ] },
    { key: 'calls', title: 'Любите поговорить?', caption: 'У каждого свой язык общения', options: [
      { value: 'few', icon: 'write', title: 'Лучше напишу', caption: 'Звоню редко и по делу' },
      { value: 'regular', icon: 'mixed', title: 'Всего понемногу', caption: 'Переписываюсь и созваниваюсь' },
      { value: 'many', icon: 'calls', title: 'Могу часами', caption: 'Долгие разговоры — это моё' }
    ] },
    { key: 'budget', title: 'А что по бюджету?', caption: 'Чтобы совпали и привычки, и цена', options: [
      { value: '300', icon: 'budget-small', title: 'До 300 ₽ в месяц', caption: 'Люблю разумную экономию' },
      { value: '400', icon: 'budget-medium', title: 'До 400 ₽ в месяц', caption: 'Хочу хороший баланс' },
      { value: 'any', icon: 'comfort', title: 'Главное — подходит', caption: 'Готов платить за комфорт' }
    ] }
  ];
  const tariffs = [
    { id: 'rational', title: 'Для рациональных', subtitle: 'Ценим простые вещи', gb: '10 Гб', minutes: '300 мин', price: 250, regular: 500, promo: 'С 4-го месяца — 500 ₽ в месяц', discount: '−50%', apps: 'Мессенджеры и соцсети', unlimited: false },
    { id: 'everyone', title: 'Для всех', subtitle: 'За любой движ — вместе', gb: '50 Гб', minutes: '300 мин', price: 390, regular: 630, promo: 'С 4-го месяца — 630 ₽ в месяц', discount: '−38%', apps: 'Мессенджеры и соцсети', unlimited: false },
    { id: 'open', title: 'Для открытых', subtitle: 'Никаких границ между нами', gb: '∞ Гб', minutes: '∞ мин', price: 450, regular: 900, promo: '450 ₽ первые 30 дней · далее 900 ₽ без скидки', discount: '−50%', apps: 'Интернет, звонки и СМС без ограничений', unlimited: true, availableForExisting: false }
  ];
  const warmedImages = new Map();
  const choiceImage = option => `./assets/match-choice-${option.icon}-wool.webp`;
  function warmImages(sources) {
    for (const source of sources) {
      if (warmedImages.has(source)) continue;
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'low';
      image.onload = () => image.decode().catch(() => {});
      warmedImages.set(source, image);
      image.src = source;
    }
  }
  function warmNextStep(route, questionIndex) {
    const nextQuestion = route === 'profile' ? questions[0] : Number.isInteger(questionIndex) ? questions[questionIndex + 1] : undefined;
    if (nextQuestion) warmImages(nextQuestion.options.map(choiceImage));
    if (questionIndex === 0) warmImages([smile]);
    if (questionIndex === questions.length - 1 || route === 'search') {
      warmImages([smile, ...['tariff-match-heart.webp', 'match-skip-secondary-64.svg', 'match-like-primary-64.svg', 'match-social-fc543.svg',
        'match-social-b2164.svg', 'match-social-b2182.svg', 'match-social-5e1b2.svg',
        'match-social-9153b.svg', 'match-social-babd2.svg', 'match-social-c0776.svg',
        'match-social-0c074.svg', 'match-social-43bf4.svg', 'match-social-7c2cb.svg',
        'match-social-6f7d3.svg', 'match-social-d8c45.svg', 'match-social-samokat.webp',
        'match-social-2gis.webp', 'match-social-7b5c2.svg'].map(name => `./assets/${name}`)]);
    }
  }
  let answers = {};
  let candidates = [];
  let candidateIndex = 0;
  let selected = null;
  let savedMatch = null;
  let searchTimer = 0;
  let busy = false;
  let gesture = null;
  let swipeTimer = 0;
  let matchScrollY = null;
  try {
    const entryRoute = location.hash.slice(1);
    if (['search', 'deck', 'no-match', 'result', 'details', 'saved'].includes(entryRoute)) answers = JSON.parse(sessionStorage.getItem('sbm-match-answers') || '{}');
    for (const question of questions) {
      if (!question.options.some(option => option.value === answers[question.key])) delete answers[question.key];
    }
    for (const [key, field] of Object.entries(profileFields)) {
      if (!field.options.some(option => option.value === answers[key])) delete answers[key];
    }
  } catch (_) { answers = {}; }
  try {
    const saved = JSON.parse(localStorage.getItem('sbm-tariff-match') || 'null');
    if (saved && tariffs.some(tariff => tariff.id === saved.tariffId && tariff.availableForExisting !== false) && questions.every(question => question.options.some(option => option.value === saved.answers?.[question.key]))) savedMatch = saved;
  } catch (_) { /* Saved choices are optional. */ }

  function rememberAnswers() {
    try { sessionStorage.setItem('sbm-match-answers', JSON.stringify(answers)); } catch (_) { /* Selection works without storage. */ }
  }
  function startNewFlow() {
    answers = {};
    candidates = [];
    candidateIndex = 0;
    selected = null;
    try {
      sessionStorage.removeItem('sbm-match-answers');
      sessionStorage.removeItem('sbm-match-selected');
    } catch (_) { /* New choices still start empty without storage. */ }
    go('profile');
  }
  function button(label, action, secondary = false, disabled = false) {
    return `<button type="button" class="match-button${secondary ? ' match-button-secondary' : ''}" data-action="${action}"${disabled ? ' disabled' : ''}>${label}</button>`;
  }
  function profileComplete() {
    return Object.entries(profileFields).every(([key, field]) => field.options.some(option => option.value === answers[key]));
  }
  function progress(step) {
    const total = questions.length + 1;
    return `<div class="match-progress" aria-label="Шаг ${step + 1} из ${total}">${Array.from({ length: total }, (_, index) => `<span class="${index <= step ? 'is-filled' : ''}"></span>`).join('')}</div>`;
  }
  function go(route, replace = false) {
    if (replace) { history.replaceState(null, '', `#${route}`); render(); }
    else if (location.hash.slice(1) === route) render();
    else location.hash = route;
  }
  function chooseCandidates() {
    const budget = answers.budget === 'any' ? Infinity : Number(answers.budget);
    const scores = { rational: 0, everyone: 0, open: 0 };
    if (answers.internet === 'light') scores.rational += 6;
    if (answers.internet === 'video') scores.everyone += 6;
    if (answers.internet === 'unlimited') scores.open += 7;
    if (answers.calls === 'many') scores.open += 7;
    if (answers.calls === 'regular') scores.everyone += 1;
    if (answers.budget === '300') scores.rational += 5;
    if (answers.budget === '400') scores.everyone += 2;
    tariffs.forEach(tariff => { if (tariff.price > budget) scores[tariff.id] -= 8; });
    return tariffs.filter(tariff => tariff.availableForExisting !== false).sort((a, b) => scores[b.id] - scores[a.id] || a.price - b.price).slice(0, 2);
  }
  function reasons(tariff) {
    const result = [];
    if (tariff.id === 'rational') result.push('10 Гб для чатов, карт и повседневных дел');
    if (tariff.id === 'everyone') result.push('50 Гб — больше места для видео и музыки');
    if (tariff.id === 'open') result.push(answers.calls === 'many' ? 'Безлимитные минуты для долгих разговоров' : 'Безлимитный интернет под ваш активный ритм');
    if (answers.budget !== 'any') {
      result.push(tariff.price <= Number(answers.budget) ? 'Стартовая цена укладывается в ваш бюджет' : `На ${tariff.price - Number(answers.budget)} ₽ выше вашего бюджета на старте`);
    } else result.push(tariff.unlimited ? 'Интернет, звонки и СМС без ограничений' : 'Безлимитный трафик в популярных приложениях');
    return result;
  }
  function price(tariff, largePeriod = false) {
    return `<div class="match-price${largePeriod ? ' is-large-period' : ''}"><div class="match-price-line"><span class="match-price-amount">${tariff.price} ₽${largePeriod ? ' в месяц' : ''}</span>${largePeriod ? '' : '<small>в месяц</small>'}<span class="match-badge">${tariff.discount}</span></div><span class="match-price-caption">${tariff.promo}</span></div>`;
  }
  function intro() {
    return `<div class="match-welcome-copy" data-node-id="25441:37928"><h1><span>Идеальный</span> <span>тариф</span> <span>какой он?</span></h1><p data-node-id="25441:37929">Расскажите немного о себе и своих привычках — мы подберём подходящие тарифы</p></div>
      <div class="match-welcome-art" aria-hidden="true" data-node-id="25441:37924">
        <img class="match-welcome-face" src="./assets/tariff-match-face.webp" width="230" height="230" fetchpriority="high" decoding="async" alt="">
        <span class="match-welcome-heart match-welcome-heart-top"><img src="./assets/tariff-match-heart.webp" width="98" height="98" decoding="async" alt=""></span>
        <span class="match-welcome-heart match-welcome-heart-left"><img src="./assets/tariff-match-heart.webp" width="86" height="86" decoding="async" alt=""></span>
        <span class="match-welcome-heart match-welcome-heart-right"><img src="./assets/tariff-match-heart.webp" width="100" height="100" decoding="async" alt=""></span>
      </div>
      <div class="match-welcome-actions" data-node-id="25441:37867">${savedMatch ? '<button type="button" class="match-text-button" data-action="restore">Мой сохранённый мэтч</button>' : ''}${button('Продолжить', 'start', true)}</div>`;
  }
  function questionScreen(index) {
    const question = questions[index];
    return `${progress(index + 1)}
      <div class="match-heading match-question-heading"><h1>${question.title}</h1><p>${question.caption}</p></div>
      <div class="match-options" aria-label="${question.title}">${question.options.map(option => `<button type="button" class="match-option" data-answer="${option.value}" data-question="${index}" aria-pressed="${answers[question.key] === option.value}"><span class="match-option-icon" aria-hidden="true"><img src="${choiceImage(option)}" width="48" height="48" decoding="async" alt=""></span><span class="match-option-copy"><strong>${option.title}</strong><small>${option.caption}</small></span><span class="match-option-radio" aria-hidden="true"><img class="match-option-radio-on" src="./assets/network-radio-on.svg" width="24" height="24" alt=""><img class="match-option-radio-off" src="./assets/network-radio-off.svg" width="24" height="24" alt=""></span></button>`).join('')}</div>
      <div class="match-footer">${button('Следующий шаг', 'next', false, !answers[question.key])}</div>`;
  }
  function profileScreen() {
    return `${progress(0)}<div class="match-heading match-question-heading"><h1>Рады знакомству!</h1><p>Давайте найдём ваш идеальный тариф</p></div>
      <div class="match-profile-fields">${Object.entries(profileFields).map(([key, field]) => `<section class="match-profile-card card" aria-labelledby="match-profile-${key}"><h2 id="match-profile-${key}">${field.title}</h2><div class="match-profile-chips">${field.options.map(option => `<button class="match-profile-chip" type="button" data-profile-field="${key}" data-profile-value="${option.value}" aria-pressed="${answers[key] === option.value}">${option.label}</button>`).join('')}</div></section>`).join('')}</div>
      <div class="match-footer">${button('Следующий шаг', 'profile-next', false, !profileComplete())}</div>`;
  }
  function socialIcons() {
    return `<div class="match-social-icons" data-node-id="25453:38342" role="img" aria-label="MAX, RUTUBE, Яндекс Музыка, Сбер, Самокат, 2ГИС, imo и ещё два сервиса">
      <div class="match-social-icon" data-node-id="25453:38343"><img src="./assets/match-social-fc543.svg" alt=""></div>
      <div class="match-social-icon is-bordered" data-node-id="25453:38344"><img class="match-social-base" src="./assets/match-social-b2164.svg" alt=""><div class="match-social-rutube-art"><img src="./assets/match-social-b2182.svg" alt=""></div></div>
      <div class="match-social-icon is-bordered" data-node-id="25453:38345"><img class="match-social-base" src="./assets/match-social-c0776.svg" alt=""><img class="match-social-music-ring" src="./assets/match-social-0c074.svg" alt=""><div class="match-social-music-art"><img src="./assets/match-social-43bf4.svg" alt=""></div></div>
      <div class="match-social-icon" data-node-id="25453:38346"><img src="./assets/match-social-6f7d3.svg" alt=""></div>
      <div class="match-social-icon is-bordered" data-node-id="25453:38347"><img class="match-social-full" src="./assets/match-social-d8c45.svg" alt=""><img class="match-social-samokat" src="./assets/match-social-samokat.webp" width="32" height="32" alt=""></div>
      <div class="match-social-icon is-bordered" data-node-id="25453:38348"><img class="match-social-full match-social-2gis" src="./assets/match-social-2gis.webp" width="36" height="36" alt=""></div>
      <div class="match-social-icon" data-node-id="25453:38349"><img src="./assets/match-social-7b5c2.svg" alt=""></div>
      <div class="match-social-icon match-social-more" data-node-id="25453:38350">+2</div>
    </div>`;
  }
  function candidateCard(tariff, matched = false) {
    return `<article class="match-candidate${matched ? ' is-matched' : ''}" aria-label="Тариф ${tariff.title}">${matched ? '' : '<span class="match-swipe-stamp" data-choice="like" aria-hidden="true">Нравится</span>'}
      <div class="match-candidate-top"><div class="match-candidate-title"><h2>${tariff.title}</h2>${tariff.unlimited ? `<p>${tariff.subtitle}</p>` : ''}</div>${tariff.unlimited ? `<span class="match-badge">${candidateIndex === 0 ? 'Ваш кандидат' : 'Ещё вариант'}</span>` : ''}</div>
      <div class="match-pack${tariff.unlimited ? ' is-unlimited' : ''}"><div class="match-pack-values"><span>${tariff.gb}</span><span>${tariff.minutes}</span></div><p>${tariff.unlimited ? tariff.apps : 'Безлимитный трафик'}</p>${tariff.unlimited ? '<img src="./assets/d841e.webp" width="126" height="126" alt="">' : socialIcons()}</div>
      ${tariff.unlimited ? `<p class="match-reason">${reasons(tariff)[0]}</p>` : ''}${price(tariff, !tariff.unlimited)}${matched ? `<div class="match-card-actions">${button('Перейти к тарифу', 'details', false, true)}</div>` : ''}</article>`;
  }
  function constructorInvite() {
    return `<div class="match-empty match-constructor-invite"><img src="./assets/tariff-match-face-sad.webp" width="200" height="200" decoding="async" draggable="false" alt=""><div class="match-heading match-question-heading"><h1>Мэтч не случился</h1><p>Возможно, вам подойдёт конструктор тарифов — выберите интернет и минуты под себя</p></div></div><div class="match-footer match-constructor-footer">${button('Перейти в конструктор', 'constructor', false, true)}</div>`;
  }
  function deck() {
    const tariff = candidates[candidateIndex];
    if (!tariff) return constructorInvite();
    return `<h1 class="match-deck-title">С кем случится мэтч?</h1><div class="match-deck">${candidateCard(tariff)}</div>
      <div class="match-swipe-actions"><button class="match-swipe-choice" type="button" data-action="skip" aria-label="Тариф не нравится" data-node-id="25453:38713"><img src="./assets/match-skip-secondary-64.svg" width="64" height="64" alt=""></button><button class="match-swipe-choice is-like" type="button" data-action="like" aria-label="Тариф нравится" data-node-id="25453:38714"><img src="./assets/match-like-primary-64.svg" width="64" height="64" alt=""></button></div>`;
  }
  function result() {
    return `<h1 class="match-deck-title">Это мэтч!</h1><div class="match-deck">${candidateCard(selected, true)}</div>`;
  }
  function details() {
    return `<div class="match-heading"><span class="match-eyebrow">Знакомимся поближе</span><h1>${selected.title}</h1><p>${selected.subtitle}</p></div>
      <section class="match-details"><div class="match-pack${selected.unlimited ? ' is-unlimited' : ''}"><div class="match-pack-values"><span>${selected.gb}</span><span>${selected.minutes}</span></div><p>${selected.apps}</p></div>${price(selected)}
      <dl><div><dt>Ваш номер</dt><dd>+7 (914) 680-40-61</dd></div><div><dt>Интернет</dt><dd>${selected.unlimited ? 'Безлимитный' : selected.gb}</dd></div><div><dt>Звонки</dt><dd>${selected.unlimited ? 'Безлимитные' : selected.minutes}</dd></div>${selected.unlimited ? '<div><dt>СМС</dt><dd>Без ограничений</dd></div>' : ''}</dl>
      <p class="match-details-description">${selected.unlimited ? '450 ₽ в месяц со скидкой 50%. Перед подключением проверьте срок скидки и полные условия тарифа.' : `Цена ${selected.price} ₽ действует первые 3 месяца. С 4-го месяца — ${selected.regular} ₽ в месяц. Состав безлимитных приложений уточняется в полных условиях.`}</p></section>
      <div class="match-footer">${button('Сохранить мой мэтч', 'save')}<p class="match-note">Сохраним выбор. Текущий тариф продолжит действовать.</p></div>`;
  }
  function complete() {
    return `<img class="match-save-art" src="${smile}" width="180" height="181.46" alt=""><div class="match-heading" style="text-align:center"><span class="match-eyebrow">♥ Вместе — в избранном</span><h1>Ваш мэтч сохранён</h1><p>«${selected.title}» для номера +7 (914) 680-40-61. Можно вернуться к выбору в любое время.</p></div><div class="match-summary"><div class="match-summary-values">${selected.gb} · ${selected.minutes}</div>${price(selected)}</div><div class="match-footer"><a class="match-button" href="${home}">На главную</a>${button('Посмотреть мой мэтч', 'result', true)}</div>`;
  }
  function render() {
    clearTimeout(searchTimer);
    clearTimeout(swipeTimer);
    document.querySelector('.match-background-reveal')?.remove();
    document.body.classList.remove('is-match-celebrating');
    gesture = null;
    busy = false;
    const route = location.hash.slice(1) || 'intro';
    const questionMatch = route.match(/^about\/([0-2])$/);
    const needsAnswers = ['search', 'deck', 'result', 'details', 'saved'].includes(route);
    if ((questionMatch || ['search', 'deck'].includes(route)) && !profileComplete()) { go('profile', true); return; }
    if (needsAnswers && questions.some(question => !answers[question.key])) { go('about/0'); return; }
    if (!candidates.length && needsAnswers) candidates = chooseCandidates();
    if (['result', 'details', 'saved'].includes(route) && !selected) {
      try { selected = tariffs.find(tariff => tariff.id === sessionStorage.getItem('sbm-match-selected') && tariff.availableForExisting !== false); } catch (_) { /* Storage optional. */ }
      if (!selected) { go('deck'); return; }
    }
    const isIntro = route !== 'profile' && route !== 'no-match' && !questionMatch && !needsAnswers;
    const isDeck = route === 'deck' || route === 'result';
    const isResult = route === 'result';
    document.body.classList.toggle('is-match-intro', isIntro);
    document.body.classList.toggle('is-match-deck', isDeck);
    document.body.classList.toggle('is-match-result', isResult);
    document.querySelector('.match-nav-button img').src = isIntro || isResult ? './assets/match-intro-back.svg' : './assets/network-back.svg';
    document.querySelector('meta[name="theme-color"]').content = isIntro ? '#ff5255' : isResult ? '#fa5f05' : '#e9ebeb';
    content.className = `match-content${isIntro ? ' match-intro-content' : route === 'result' ? ' match-result-content' : ''}`;
    if (route === 'profile') content.innerHTML = profileScreen();
    else if (questionMatch) content.innerHTML = questionScreen(Number(questionMatch[1]));
    else if (route === 'search') {
      content.innerHTML = `<div class="match-searching" role="status"><div class="match-searching-art"><img src="${smile}" width="140" height="141.14" alt=""></div><div class="match-heading"><h1>Ищем вашу пару</h1><p>Уже знаем, что вам нравится. Осталось познакомить.</p></div></div>`;
      searchTimer = window.setTimeout(() => { candidates = chooseCandidates(); candidateIndex = 0; history.replaceState(null, '', '#deck'); render(); }, 1100);
    } else if (route === 'deck') content.innerHTML = deck();
    else if (route === 'no-match') content.innerHTML = constructorInvite();
    else if (route === 'result') content.innerHTML = result();
    else if (route === 'details') content.innerHTML = details();
    else if (route === 'saved') content.innerHTML = complete();
    else content.innerHTML = intro();
    content.querySelectorAll('img').forEach(image => {
      image.decoding = 'async';
      if (image.closest('.match-candidate')) image.draggable = false;
    });
    if (route === 'profile' || questionMatch || route === 'search') warmNextStep(route, questionMatch ? Number(questionMatch[1]) : undefined);
    if (route === 'deck') warmImages(['./assets/tariff-match-heart.webp']);
    if (route === 'deck' && candidateIndex === candidates.length - 1) warmImages(['./assets/tariff-match-face-sad.webp']);
    document.title = `СберМобайл — ${route === 'profile' ? 'Немного о вас' : questionMatch ? 'Знакомимся' : route === 'deck' ? 'Выбираем тариф' : route === 'result' ? 'Это мэтч!' : route === 'no-match' ? 'Индивидуальный тариф' : 'Тарифный мэтч'}`;
    if (route === 'result') syncMatchedLayout();
    window.scrollTo(0, route === 'result' && matchScrollY !== null ? matchScrollY : 0);
    matchScrollY = null;
    const heading = content.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function selectCandidate() {
    selected = candidates[candidateIndex];
    try { sessionStorage.setItem('sbm-match-selected', selected.id); } catch (_) { /* Storage optional. */ }
    go('result');
  }
  function syncMatchedLayout() {
    if (location.hash !== '#result') return;
    const heading = content.querySelector('.match-deck-title');
    if (!heading) return;
    heading.style.minHeight = '';
    heading.textContent = 'С кем случится мэтч?';
    const selectionHeight = heading.offsetHeight;
    heading.textContent = 'Это мэтч!';
    heading.style.minHeight = `${selectionHeight}px`;
    document.querySelector('.match-screen').style.setProperty('--match-selection-title-height', `${selectionHeight}px`);
  }
  function showNextCandidate() {
    candidateIndex++;
    if (!candidates[candidateIndex]) { go('no-match'); return; }
    render();
    content.querySelector('.match-candidate')?.classList.add('is-new');
  }
  function revealMatchBackground() {
    const origin = content.querySelector('[data-action="like"]').getBoundingClientRect();
    const x = origin.left + origin.width / 2;
    const y = origin.top + origin.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 4;
    const reveal = document.createElement('div');
    reveal.className = 'match-background-reveal';
    reveal.setAttribute('aria-hidden', 'true');
    reveal.style.setProperty('--reveal-x', `${x}px`);
    reveal.style.setProperty('--reveal-y', `${y}px`);
    reveal.style.setProperty('--reveal-radius', `${radius}px`);
    document.body.prepend(reveal);
    document.body.classList.add('is-match-celebrating');
  }
  function celebrateMatch(card) {
    setSwipeFeedback(0);
    revealMatchBackground();
    const heading = content.querySelector('.match-deck-title');
    heading.style.minHeight = `${heading.offsetHeight}px`;
    heading.textContent = 'Это мэтч!';
    card.style.transition = 'transform 180ms ease-out';
    card.style.transform = '';
    content.classList.add('is-matching');
    content.querySelector('.match-deck').insertAdjacentHTML('beforeend', `<div class="match-celebration" aria-hidden="true"><img class="match-celebration-heart is-left" src="./assets/tariff-match-heart.webp" width="104" height="104" alt=""><img class="match-celebration-heart is-right" src="./assets/tariff-match-heart.webp" width="104" height="104" alt=""><div class="match-celebration-sparkles">${Array.from({length:8}, (_, index) => `<span style="--angle:${index * 45}deg;--distance:${index % 2 ? 104 : 88}px"></span>`).join('')}</div></div>`);
    swipeTimer = window.setTimeout(selectCandidate, 900);
  }
  function swipe(like) {
    if (busy || !candidates[candidateIndex]) return;
    busy = true;
    const card = content.querySelector('.match-candidate');
    if (card) card.style.animation = 'none';
    setSwipeFeedback(like ? 1 : -1, 1);
    content.querySelectorAll('.match-swipe-choice').forEach(button => { button.disabled = true; });
    if (like) {
      matchScrollY = scrollY;
      if (card && !matchMedia('(prefers-reduced-motion: reduce)').matches) celebrateMatch(card);
      else selectCandidate();
      return;
    }
    if (card && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const direction = like ? 1 : -1;
      card.style.transition = 'transform 220ms ease-in, opacity 220ms ease-in';
      card.style.transform = `translate3d(${direction * innerWidth}px,0,0) rotate(${direction * 18}deg)`;
      card.style.opacity = '0';
      swipeTimer = window.setTimeout(showNextCandidate, 230);
    } else showNextCandidate();
  }
  document.addEventListener('click', event => {
    const profileOption = event.target.closest('[data-profile-field]');
    if (profileOption) {
      const key = profileOption.dataset.profileField;
      const value = profileOption.dataset.profileValue;
      if (!profileFields[key]?.options.some(option => option.value === value)) return;
      answers[key] = value;
      rememberAnswers();
      content.querySelectorAll(`[data-profile-field="${key}"]`).forEach(option => option.setAttribute('aria-pressed', String(option === profileOption)));
      content.querySelector('[data-action="profile-next"]').disabled = !profileComplete();
      return;
    }
    const option = event.target.closest('[data-answer]');
    if (option) {
      const index = Number(option.dataset.question);
      answers[questions[index].key] = option.dataset.answer;
      rememberAnswers();
      content.querySelectorAll('[data-answer]').forEach(item => item.setAttribute('aria-pressed', String(item === option)));
      content.querySelector('[data-action="next"]').disabled = false;
      return;
    }
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget?.disabled) return;
    const action = actionTarget?.dataset.action;
    if (!action || busy) return;
    const route = location.hash.slice(1) || 'intro';
    if (action === 'start' || action === 'edit') startNewFlow();
    if (action === 'profile-next' && profileComplete()) go('about/0');
    if (action === 'next') {
      const index = Number(route.split('/')[1]);
      if (!answers[questions[index]?.key]) return;
      if (index === 2) { candidates = []; selected = null; go('search'); }
      else go(`about/${index + 1}`);
    }
    if (action === 'back') {
      if (route.startsWith('about/')) { const index = Number(route.split('/')[1]); go(index ? `about/${index - 1}` : 'profile'); }
      else if (route === 'profile') go('intro');
      else if (route === 'intro') location.href = home;
      else if (route === 'details' || route === 'saved') go('result');
      else if (route === 'result') go('deck');
      else if (route === 'no-match') { candidateIndex = Math.max(0, candidates.length - 1); go('deck'); }
      else go('about/2');
    }
    if (action === 'skip') swipe(false);
    if (action === 'like') swipe(true);
    if (action === 'again') { candidateIndex = 0; render(); }
    if (action === 'other') { candidateIndex++; go('deck'); }
    if (action === 'details') go('details');
    if (action === 'result') go('result');
    if (action === 'restore' && savedMatch) {
      answers = { ...savedMatch.answers };
      rememberAnswers();
      candidates = chooseCandidates();
      selected = tariffs.find(tariff => tariff.id === savedMatch.tariffId);
      candidateIndex = Math.max(0, candidates.findIndex(tariff => tariff.id === selected.id));
      try { sessionStorage.setItem('sbm-match-selected', selected.id); } catch (_) { /* Storage optional. */ }
      go('result');
    }
    if (action === 'save') {
      try { savedMatch = { tariffId: selected.id, answers: { ...answers }, phone: '+7 (914) 680-40-61' }; localStorage.setItem('sbm-tariff-match', JSON.stringify(savedMatch)); }
      catch (_) { content.querySelector('.match-note').textContent = 'Не удалось сохранить выбор в этом браузере. Вы можете продолжить просмотр тарифа.'; return; }
      go('saved');
    }
  });
  function swipeThreshold() {
    return 65;
  }
  function setSwipeFeedback(direction, progress = 0) {
    const stamp = content.querySelector('.match-swipe-stamp');
    if (!stamp) return;
    stamp.dataset.choice = direction > 0 ? 'like' : 'skip';
    stamp.textContent = direction > 0 ? 'Нравится' : 'Не нравится';
    stamp.style.opacity = progress;
  }
  content.addEventListener('pointerdown', event => {
    const card = event.target.closest('.match-candidate');
    if (!card || card.classList.contains('is-matched') || busy || !event.isPrimary || event.button !== 0) return;
    gesture = { x: event.clientX, y: event.clientY, id: event.pointerId, card, horizontal: false };
    card.style.animation = 'none';
    card.style.transition = 'none';
    card.setPointerCapture(event.pointerId);
  });
  content.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.horizontal && Math.abs(dx) > 10) gesture.horizontal = true;
    if (!gesture.horizontal) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    gesture.card.style.transform = `translate3d(${dx}px,0,0) rotate(${reducedMotion ? 0 : dx / 22}deg)`;
    setSwipeFeedback(dx, Math.min(1, Math.abs(dx) / 85));
  });
  function release(event, cancelled = false) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const { card, horizontal, id } = gesture;
    gesture = null;
    if (card.hasPointerCapture(id)) card.releasePointerCapture(id);
    if (!cancelled && horizontal && Math.abs(dx) > swipeThreshold()) swipe(dx > 0);
    else {
      card.style.transition = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'transform 180ms ease-out';
      card.style.transform = '';
      setSwipeFeedback(0);
    }
  }
  content.addEventListener('pointerup', event => release(event));
  content.addEventListener('pointercancel', event => release(event, true));
  content.addEventListener('lostpointercapture', event => release(event, true));
  document.addEventListener('keydown', event => {
    if (location.hash !== '#deck') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); swipe(event.key === 'ArrowRight'); }
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('resize', syncMatchedLayout);
  document.fonts.ready.then(syncMatchedLayout);
  render();
})();
