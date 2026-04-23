
const CONTENT_URL = 'content/posts.json';
let posts = [];
let stories = [];

function normalizeComment(comment) {
  if (Array.isArray(comment)) return comment;
  if (comment && typeof comment === 'object') return [comment.username || '', comment.text || ''];
  return ['', ''];
}

function normalizeMedia(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    type: item.type === 'video' ? 'video' : 'image',
    src: item.src || '',
    thumb: item.thumb || '',
    poster: item.poster || ''
  };
}

function normalizePost(post) {
  return {
    media: Array.isArray(post?.media) ? post.media.map(normalizeMedia).filter(Boolean) : [],
    caption: post?.caption || '',
    location: post?.location || '',
    likes: Number(post?.likes || 0),
    comments: Array.isArray(post?.comments) ? post.comments.map(normalizeComment) : [],
    date: post?.date || ''
  };
}

async function loadContent() {
  const response = await fetch(CONTENT_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load content: ${response.status}`);
  const data = await response.json();
  posts = Array.isArray(data.posts) ? data.posts.map(normalizePost) : [];
  stories = Array.isArray(data.stories) ? data.stories.map((item) => typeof item === 'string' ? item : (item?.label || '')).filter(Boolean) : [];
}


const postGrid = document.getElementById('postGrid');
const postsCount = document.getElementById('postsCount');
const storiesRoot = document.getElementById('stories');

const postModal = document.getElementById('postModal');
const modalMedia = document.getElementById('modalMedia');
const modalLocation = document.getElementById('modalLocation');
const modalCaption = document.getElementById('modalCaption');
const modalComments = document.getElementById('modalComments');
const modalLikes = document.getElementById('modalLikes');
const modalDate = document.getElementById('modalDate');

const closePostModal = document.getElementById('closePostModal');
const closePostModalMobile = document.getElementById('closePostModalMobile');
const mobilePostFeed = document.getElementById('mobilePostFeed');
const prevPostBtn = document.getElementById('prevPost');
const nextPostBtn = document.getElementById('nextPost');

const reelsViewer = document.getElementById('reelsViewer');
const reelsFeed = document.getElementById('reelsFeed');
const closeReels = document.getElementById('closeReels');
const openReelsTriggers = [
  document.getElementById('openReelsDesktopNav'),
  document.getElementById('openReelsTab'),
  document.getElementById('openReelsBottom')
].filter(Boolean);

let currentIndex = 0;
let currentMediaIndex = 0;
let lastFocusedCard = null;
let reelsObserver = null;
let mobileHeaderObserver = null;

function formatNumber(value) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function getMediaItems(post) {
  return Array.isArray(post.media) ? post.media : [];
}

function getCoverMedia(post) {
  return getMediaItems(post)[0];
}

function isMultiMedia(post) {
  return getMediaItems(post).length > 1;
}

function renderStories() {
  storiesRoot.innerHTML = stories.map((label) => `
    <button class="story" type="button" aria-label="История ${label}">
      <span class="story__ring"><span class="story__inner">${label.slice(0, 2)}</span></span>
      <span class="story__label">${label}</span>
    </button>
  `).join('');
}

function createGridCard(post, index) {
  const cover = getCoverMedia(post);
  const media = cover.type === 'video'
    ? `<video class="post-card__media" muted playsinline preload="metadata" poster="${cover.poster || ''}"><source src="${cover.src}" type="${cover.src.endsWith('.webm') ? 'video/webm' : 'video/mp4'}"></video>`
    : `<img class="post-card__media" src="${cover.thumb || cover.src}" alt="" loading="lazy" decoding="async">`;

  return `
    <article class="post-card" tabindex="0" data-index="${index}">
      ${media}
      <div class="post-card__skeleton"></div>
      ${isMultiMedia(post) ? `<div class="post-card__multi" aria-label="Несколько фото или видео"><span></span><span></span></div>` : ''}
      <div class="post-card__metrics">
        <span>♡ ${Math.round(post.likes / 1000)}k</span>
        <span>◌ ${post.comments.length}</span>
      </div>
    </article>
  `;
}

function renderGrid() {
  postGrid.innerHTML = posts.map(createGridCard).join('');
  postsCount.textContent = posts.length;
  if (!posts.length) return;

  [...postGrid.querySelectorAll('.post-card')].forEach((card, index) => {
    const media = card.querySelector('.post-card__media');
    const loaded = () => card.classList.add('is-loaded');

    if (media.tagName === 'IMG') {
      if (media.complete) loaded();
      media.addEventListener('load', loaded, { once: true });
    } else {
      media.addEventListener('loadeddata', loaded, { once: true });
      card.addEventListener('mouseenter', () => { media.currentTime = 0; media.play().catch(() => {}); });
      card.addEventListener('mouseleave', () => { media.pause(); media.currentTime = 0; });
    }

    card.addEventListener('click', () => openPost(index, card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPost(index, card);
      }
    });
  });
}

function slideMarkup(item, eager = false) {
  if (item.type === 'video') {
    return `<video playsinline preload="metadata" ${eager ? 'autoplay' : ''} poster="${item.poster || ''}"><source src="${item.src}" type="${item.src.endsWith('.webm') ? 'video/webm' : 'video/mp4'}"></video>`;
  }
  return `<img src="${item.src}" alt="" ${eager ? 'loading="eager"' : 'loading="lazy"'} decoding="async">`;
}

function createCarousel(postIndex, activeIndex = 0, scope = 'desktop') {
  const items = getMediaItems(posts[postIndex]);
  const safeIndex = ((activeIndex % items.length) + items.length) % items.length;
  const nav = items.length > 1 ? `
    <button class="carousel__nav carousel__nav--prev" type="button" data-step="-1" aria-label="Предыдущее медиа"><svg><use href="#i-chevron-left"></use></svg></button>
    <button class="carousel__nav carousel__nav--next" type="button" data-step="1" aria-label="Следующее медиа"><svg><use href="#i-chevron-right"></use></svg></button>
    <div class="carousel__dots">${items.map((_, i) => `<span class="carousel__dot ${i === safeIndex ? 'is-active' : ''}"></span>`).join('')}</div>
  ` : '';

  return `
    <div class="carousel" data-scope="${scope}" data-post-index="${postIndex}" data-index="${safeIndex}" data-count="${items.length}">
      <div class="carousel__track" style="transform: translate3d(-${safeIndex * 100}%,0,0)">
        ${items.map((item, i) => `<div class="carousel__slide" data-slide-index="${i}">${slideMarkup(item, i === safeIndex)}</div>`).join('')}
      </div>
      ${nav}
    </div>
  `;
}

function syncCarouselMedia(carousel) {
  if (!carousel) return;
  const active = Number(carousel.dataset.index || 0);
  carousel.querySelectorAll('video').forEach((video, idx) => {
    if (idx === active) {
      video.controls = false;
      video.muted = false;
      video.loop = true;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else {
      video.pause();
      video.currentTime = 0;
    }
  });
}

function updateCarousel(carousel, nextIndex, animate = true) {
  if (!carousel) return;
  const count = Number(carousel.dataset.count || 1);
  const safe = ((nextIndex % count) + count) % count;
  const track = carousel.querySelector('.carousel__track');
  if (!track) return;
  track.style.transition = animate ? 'transform 380ms cubic-bezier(.22,.61,.36,1)' : 'none';
  track.style.transform = `translate3d(-${safe * 100}%,0,0)`;
  carousel.dataset.index = String(safe);
  carousel.querySelectorAll('.carousel__dot').forEach((dot, idx) => dot.classList.toggle('is-active', idx === safe));
  if (carousel.dataset.scope === 'desktop' && Number(carousel.dataset.postIndex) === currentIndex) {
    currentMediaIndex = safe;
  }
  syncCarouselMedia(carousel);
}

function bindCarouselInteractions(root) {
  root.querySelectorAll('.carousel').forEach((carousel) => {
    if (carousel.dataset.bound === 'true') return;
    carousel.dataset.bound = 'true';
    const count = Number(carousel.dataset.count || 1);
    if (count <= 1) {
      syncCarouselMedia(carousel);
      return;
    }

    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let deltaY = 0;
    let dragging = false;
    let isHorizontalGesture = false;
    let gestureLocked = false;
    const track = carousel.querySelector('.carousel__track');
    const mobileFeed = carousel.closest('.mobile-post-feed');

    const lockFeed = (locked) => {
      if (!mobileFeed) return;
      const mobileViewer = mobileFeed.closest('.mobile-viewer');
      mobileFeed.classList.toggle('is-swipe-lock', locked);
      if (mobileViewer) mobileViewer.classList.toggle('is-swipe-lock', locked);
      mobileFeed.style.overflowY = locked ? 'hidden' : '';
    };

    carousel.addEventListener('click', (e) => {
      const nav = e.target.closest('.carousel__nav');
      if (!nav) return;
      e.preventDefault();
      e.stopPropagation();
      updateCarousel(carousel, Number(carousel.dataset.index || 0) + Number(nav.dataset.step || 0));
    });

    carousel.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      startX = t.clientX;
      startY = t.clientY;
      deltaX = 0;
      deltaY = 0;
      dragging = true;
      isHorizontalGesture = false;
      gestureLocked = false;
      track.style.transition = 'none';
    }, { passive: true });

    carousel.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.changedTouches[0];
      deltaX = t.clientX - startX;
      deltaY = t.clientY - startY;

      if (!gestureLocked) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX < 6 && absY < 6) return;
        isHorizontalGesture = absX > absY;
        gestureLocked = true;
        lockFeed(isHorizontalGesture);
      }

      if (!isHorizontalGesture) return;

      e.preventDefault();
      e.stopPropagation();
      const active = Number(carousel.dataset.index || 0);
      const atStart = active === 0 && deltaX > 0;
      const atEnd = active === count - 1 && deltaX < 0;
      const resistedDelta = (atStart || atEnd) ? deltaX * 0.35 : deltaX;
      track.style.transform = `translate3d(calc(${-active * 100}% + ${resistedDelta}px),0,0)`;
    }, { passive: false });

    const finishGesture = () => {
      if (!dragging) return;
      dragging = false;
      lockFeed(false);
      const active = Number(carousel.dataset.index || 0);
      if (Math.abs(deltaX) > Math.max(28, carousel.clientWidth * 0.08) && Math.abs(deltaX) > Math.abs(deltaY)) {
        updateCarousel(carousel, active + (deltaX < 0 ? 1 : -1));
      } else {
        updateCarousel(carousel, active);
      }
    };

    carousel.addEventListener('touchend', finishGesture, { passive: true });
    carousel.addEventListener('touchcancel', finishGesture, { passive: true });

    syncCarouselMedia(carousel);
    updateCarousel(carousel, Number(carousel.dataset.index || 0), false);
  });
}

function populateDesktopModal(postIndex, mediaIndex = 0) {
  const post = posts[postIndex];
  modalMedia.innerHTML = createCarousel(postIndex, mediaIndex, 'desktop');
  modalLocation.textContent = post.location;
  modalCaption.innerHTML = `<strong>instaclean.demo</strong>${post.caption}`;
  modalComments.innerHTML = post.comments.map(([name, text], i) => `
    <div class="comment">
      <div class="comment__avatar">${name.slice(0, 2).toUpperCase()}</div>
      <div class="comment__body">
        <div><strong>${name}</strong>${text}</div>
        <div class="comment__meta">${i + 1} дн. · Нравится · Ответить</div>
      </div>
    </div>
  `).join('');
  modalLikes.textContent = `${formatNumber(post.likes)} отметок \"Нравится\"`;
  modalDate.textContent = post.date;
  bindCarouselInteractions(modalMedia);
}

function orderedPostIndexes(startIndex) {
  return posts.map((_, offset) => (startIndex + offset) % posts.length);
}

function createMobilePost(postIndex, activeMediaIndex = 0) {
  const post = posts[postIndex];
  return `
    <article class="mobile-post" data-post-index="${postIndex}">
      <div class="mobile-post__header">
        <div class="mini-profile">
          <div class="mini-profile__avatar">IC</div>
          <div class="mini-profile__text">
            <strong>instaclean.demo</strong>
            <span>${post.location}</span>
          </div>
        </div>
        <button class="icon-btn icon-btn--ghost" type="button" aria-label="Ещё"><svg><use href="#i-more"></use></svg></button>
      </div>
      ${createCarousel(postIndex, activeMediaIndex, 'mobile')}
      <div class="mobile-post__body">
        <div class="mobile-post__actions">
          <div class="mobile-post__actions-left">
            <button class="icon-btn icon-btn--ghost" type="button"><svg><use href="#i-heart"></use></svg></button>
            <button class="icon-btn icon-btn--ghost" type="button"><svg><use href="#i-comment"></use></svg></button>
            <button class="icon-btn icon-btn--ghost" type="button"><svg><use href="#i-share"></use></svg></button>
          </div>
          <button class="icon-btn icon-btn--ghost" type="button"><svg><use href="#i-save"></use></svg></button>
        </div>
        <div class="mobile-post__likes">${formatNumber(post.likes)} отметок "Нравится"</div>
        <div class="mobile-post__caption"><strong>instaclean.demo</strong>${post.caption}</div>
        <div class="mobile-post__comments-link">Посмотреть все комментарии (${post.comments.length})</div>
        <div class="mobile-post__meta">${post.location}</div>
        <div class="mobile-post__date">${post.date}</div>
      </div>
    </article>
  `;
}

function updateMobileStickyBar() {}

function observeMobileFeedHeaders() {}


function renderMobileFeed(startIndex) {
  const order = orderedPostIndexes(startIndex);
  mobilePostFeed.innerHTML = order.map((postIndex, orderIndex) => createMobilePost(postIndex, orderIndex === 0 ? currentMediaIndex : 0)).join('');
  mobilePostFeed.scrollTop = 0;
  bindCarouselInteractions(mobilePostFeed);
  updateMobileStickyBar(startIndex);
  observeMobileFeedHeaders();
}

function renderPost(index, mediaIndex = 0) {
  if (!posts.length) return;
  currentIndex = ((index % posts.length) + posts.length) % posts.length;
  const items = getMediaItems(posts[currentIndex]);
  currentMediaIndex = ((mediaIndex % items.length) + items.length) % items.length;

  if (isMobileViewport()) {
    renderMobileFeed(currentIndex);
  } else {
    populateDesktopModal(currentIndex, currentMediaIndex);
  }
}

function openPost(index, sourceCard = null) {
  lastFocusedCard = sourceCard || document.activeElement;
  renderPost(index, 0);
  postModal.classList.add('is-open');
  postModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
}

function closePostViewer() {
  postModal.classList.remove('is-open');
  postModal.setAttribute('aria-hidden', 'true');
  postModal.querySelectorAll('video').forEach((video) => { video.pause(); video.currentTime = 0; });
  document.body.classList.remove('is-locked');
  if (lastFocusedCard && typeof lastFocusedCard.focus === 'function') lastFocusedCard.focus();
}

function stepPost(delta) {
  renderPost(currentIndex + delta, 0);
}

function renderReels() {
  if (!posts.length) {
    reelsFeed.innerHTML = '';
    if (reelsObserver) reelsObserver.disconnect();
    return;
  }
  reelsFeed.innerHTML = posts.map((post, index) => {
    const mediaItem = getMediaItems(post).find((item) => item.type === 'video') || getCoverMedia(post);
    const media = mediaItem.type === 'video'
      ? `<video class="reel-card__media" playsinline loop preload="metadata" poster="${mediaItem.poster || ''}"><source src="${mediaItem.src}" type="${mediaItem.src.endsWith('.webm') ? 'video/webm' : 'video/mp4'}"></video>`
      : `<img class="reel-card__media" src="${mediaItem.src}" alt="" loading="lazy" decoding="async">`;

    return `
      <article class="reel-card" data-index="${index}">
        <div class="reel-card__inner">
          ${media}
          <div class="reel-card__shade"></div>
          <div class="reel-card__ui">
            <div class="reel-card__info">
              <div class="reel-card__profile">
                <div class="mini-profile__avatar">IC</div>
                <strong>instaclean.demo</strong>
                <button class="reel-card__follow" type="button">Подписаться</button>
              </div>
              <div class="reel-card__caption">${post.caption}</div>
              <div class="reel-card__meta">${post.location} · ${post.date}</div>
            </div>
            <div class="reel-card__actions">
              <div class="reel-card__action"><button class="icon-btn" type="button"><svg><use href="#i-heart"></use></svg></button><span>${Math.round(post.likes / 1000)}k</span></div>
              <div class="reel-card__action"><button class="icon-btn" type="button"><svg><use href="#i-comment"></use></svg></button><span>${post.comments.length}</span></div>
              <div class="reel-card__action"><button class="icon-btn" type="button"><svg><use href="#i-share"></use></svg></button><span>share</span></div>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  if (reelsObserver) reelsObserver.disconnect();
  reelsObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target.querySelector('video');
      if (!video) return;
      if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
        video.muted = false;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: [0.2, 0.6, 1] });
  reelsFeed.querySelectorAll('.reel-card').forEach((card) => reelsObserver.observe(card));
}

function openReels(index = 0) {
  reelsViewer.classList.add('is-open');
  reelsViewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
  const target = reelsFeed.querySelector(`.reel-card[data-index="${index}"]`);
  if (target) target.scrollIntoView({ block: 'start' });
}

function closeReelsViewer() {
  reelsViewer.classList.remove('is-open');
  reelsViewer.setAttribute('aria-hidden', 'true');
  reelsFeed.querySelectorAll('video').forEach((video) => video.pause());
  document.body.classList.remove('is-locked');
}

function bindEvents() {
  closePostModal.addEventListener('click', closePostViewer);
  if (closePostModalMobile) closePostModalMobile.addEventListener('click', closePostViewer);
  if (prevPostBtn) prevPostBtn.addEventListener('click', () => stepPost(-1));
  if (nextPostBtn) nextPostBtn.addEventListener('click', () => stepPost(1));

  postModal.addEventListener('click', (e) => {
    if (e.target === postModal) closePostViewer();
  });

  closeReels.addEventListener('click', closeReelsViewer);
  openReelsTriggers.forEach((button) => button.addEventListener('click', () => openReels(0)));

  document.addEventListener('keydown', (e) => {
    if (postModal.classList.contains('is-open') && !isMobileViewport()) {
      if (e.key === 'Escape') closePostViewer();
      const desktopCarousel = modalMedia.querySelector('.carousel');
      if (e.key === 'ArrowRight' && desktopCarousel) updateCarousel(desktopCarousel, Number(desktopCarousel.dataset.index || 0) + 1);
      if (e.key === 'ArrowLeft' && desktopCarousel) updateCarousel(desktopCarousel, Number(desktopCarousel.dataset.index || 0) - 1);
      if (e.key === 'ArrowDown') stepPost(1);
      if (e.key === 'ArrowUp') stepPost(-1);
    } else if (postModal.classList.contains('is-open') && e.key === 'Escape') {
      closePostViewer();
    }

    if (reelsViewer.classList.contains('is-open') && e.key === 'Escape') closeReelsViewer();
  });

  reelsFeed.addEventListener('click', (e) => {
    const reelCard = e.target.closest('.reel-card');
    const action = e.target.closest('.reel-card__actions');
    if (!reelCard || action) return;
    openPost(Number(reelCard.dataset.index));
  });
}

async function initApp() {
  try {
    await loadContent();
  } catch (error) {
    console.error('Unable to load CMS content.', error);
    postGrid.innerHTML = '<div style="padding:24px;color:#a8a8a8;grid-column:1 / -1;">Не удалось загрузить контент. Проверь файл content/posts.json.</div>';
  }

  renderStories();
  renderGrid();
  renderReels();
  bindEvents();
}

initApp();

window.addEventListener('resize', () => {
  if (postModal.classList.contains('is-open')) renderPost(currentIndex, currentMediaIndex);
});
