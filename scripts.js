const driveConfig = window.CATALOG_DRIVE_CONFIG || {};
const driveApiUrl = 'https://www.googleapis.com/drive/v3/files';
const cacheDuration = 5 * 60 * 1000;
const folderCache = new Map();
const pendingFolders = new Map();
let currentPath = [];
let currentFiles = [];
let currentImageIndex = 0;
let routeRequestId = 0;
let isRefreshing = false;
let lastFocusedImage = null;

function setStatus(message, isError = false) {
  const status = document.getElementById('driveStatus');
  status.textContent = message;
  status.classList.toggle('text-red-400', isError);
  status.classList.toggle('text-on-surface-variant', !isError);
}

function makeRoute(path) {
  return path.length ? `#catalog/${path.map(folder => encodeURIComponent(folder.id)).join('/')}` : '#catalog';
}

function routeFromHash() {
  if (!window.location.hash.startsWith('#catalog')) return null;
  const parts = window.location.hash.slice('#catalog'.length).split('/').filter(Boolean);
  try {
    return parts.map(id => ({ id: decodeURIComponent(id), name: '' }));
  } catch (error) {
    console.error('Invalid catalog link:', error);
    return [];
  }
}

function navigateTo(path, replace = false) {
  const hash = makeRoute(path);
  if (replace) window.history.replaceState(null, '', hash);
  else window.history.pushState(null, '', hash);
  renderRoute(path);
}

async function fetchFolderFiles(folderId) {
  const files = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' in parents and trashed = false`,
      key: driveConfig.apiKey,
      pageSize: '1000',
      orderBy: 'name',
      fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,modifiedTime)'
    });
    params.set('supportsAllDrives', 'true');
    params.set('includeItemsFromAllDrives', 'true');
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`${driveApiUrl}?${params}`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `Google Drive returned ${response.status}`);
    }

    files.push(...(result.files || []));
    pageToken = result.nextPageToken || '';
  } while (pageToken);

  return files;
}

async function loadFolderContents(folderId, force = false) {
  const cached = folderCache.get(folderId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.files;
  if (!force && pendingFolders.has(folderId)) return pendingFolders.get(folderId);

  const request = fetchFolderFiles(folderId)
    .then(files => {
      folderCache.set(folderId, { files, expiresAt: Date.now() + cacheDuration });
      return files;
    })
    .finally(() => pendingFolders.delete(folderId));
  pendingFolders.set(folderId, request);
  return request;
}

function folderItems(files) {
  return files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
}

function imageItems(files) {
  return files.filter(file => file.mimeType?.startsWith('image/'));
}

function imageUrl(file, size = 900) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w${size}`;
}

function setPageHeader(title, description) {
  document.getElementById('catalogTitle').textContent = title;
  document.getElementById('catalogDescription').textContent = description;
}

function renderBreadcrumbs(path) {
  const breadcrumbs = document.getElementById('catalogBreadcrumbs');
  breadcrumbs.replaceChildren();

  const home = document.createElement('button');
  home.type = 'button';
  home.textContent = 'الأقسام';
  home.addEventListener('click', () => navigateTo([]));
  breadcrumbs.appendChild(home);

  path.forEach((folder, index) => {
    const separator = document.createElement('span');
    separator.className = 'catalog-breadcrumbs__separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '‹';
    breadcrumbs.appendChild(separator);

    const crumb = document.createElement('button');
    crumb.type = 'button';
    crumb.textContent = folder.name || '...';
    crumb.setAttribute('aria-current', index === path.length - 1 ? 'page' : 'false');
    if (index !== path.length - 1) {
      crumb.addEventListener('click', () => navigateTo(path.slice(0, index + 1)));
    } else {
      crumb.disabled = true;
    }
    breadcrumbs.appendChild(crumb);
  });
}

function setLoading(isLoading) {
  const grid = document.getElementById('catalogGrid');
  const gallery = document.getElementById('galleryGrid');
  grid.hidden = true;
  gallery.hidden = true;
  grid.replaceChildren();
  gallery.replaceChildren();
  setStatus(isLoading ? 'جاري تحميل الأقسام والتصميمات...' : '');
}

function makePlaceholder() {
  const placeholder = document.createElement('div');
  placeholder.className = 'catalog-card__placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.textContent = 'chair';
  placeholder.appendChild(icon);
  return placeholder;
}

function addCover(container, file, altText) {
  if (!file) {
    container.appendChild(makePlaceholder());
    return;
  }

  const placeholder = makePlaceholder();
  container.appendChild(placeholder);
  const image = document.createElement('img');
  image.className = 'catalog-card__image';
  image.src = imageUrl(file, 700);
  image.alt = altText;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('load', () => placeholder.remove(), { once: true });
  image.addEventListener('error', () => image.remove(), { once: true });
  container.appendChild(image);
}

async function findCoverImage(folderId, files, depth = 2) {
  const directImage = imageItems(files)[0];
  if (directImage || depth === 0) return directImage || null;

  for (const folder of folderItems(files)) {
    try {
      const childFiles = await loadFolderContents(folder.id);
      const cover = await findCoverImage(folder.id, childFiles, depth - 1);
      if (cover) return cover;
    } catch (error) {
      console.warn(`Could not load a preview for Drive folder "${folder.name}":`, error);
    }
  }
  return null;
}

async function makeFolderCard(folder, requestId) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'catalog-card';
  card.setAttribute('aria-label', `فتح قسم ${folder.name}`);

  const media = document.createElement('span');
  media.className = 'catalog-card__media';
  const coverPromise = findCoverImage(folder.id, []);
  const title = document.createElement('span');
  title.className = 'catalog-card__title';
  title.textContent = folder.name;
  const description = document.createElement('span');
  description.className = 'catalog-card__description text-on-surface-variant';
  description.textContent = 'عرض التصميمات';
  card.append(media, title, description);
  card.addEventListener('click', () => navigateTo([...currentPath, { id: folder.id, name: folder.name }]));

  try {
    const files = await loadFolderContents(folder.id);
    if (requestId !== routeRequestId) return card;
    const cover = await coverPromise;
    if (requestId !== routeRequestId) return card;
    addCover(media, cover, `صورة توضيحية لقسم ${folder.name}`);
    const count = imageItems(files).length;
    const subfolderCount = folderItems(files).length;
    description.textContent = count
      ? `${count} تصميم`
      : subfolderCount ? `${subfolderCount} أقسام فرعية` : 'استعراض القسم';
  } catch (error) {
    console.warn(`Could not load Drive folder "${folder.name}":`, error);
    addCover(media, null);
    description.textContent = 'تعذر تحميل معاينة القسم';
  }
  return card;
}

function makeImageCard(file, index, imageFiles) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'gallery-card';
  card.setAttribute('aria-label', `عرض التصميم رقم ${index + 1}`);

  const media = document.createElement('span');
  media.className = 'gallery-card__media';
  const placeholder = makePlaceholder();
  media.appendChild(placeholder);

  const image = document.createElement('img');
  image.className = 'gallery-card__image';
  image.src = imageUrl(file);
  image.alt = `تصميم أثاث رقم ${index + 1}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('load', () => placeholder.remove(), { once: true });
  image.addEventListener('error', () => {
    image.remove();
    placeholder.classList.add('catalog-card__placeholder--error');
    placeholder.setAttribute('aria-label', 'تعذر تحميل هذه الصورة');
  }, { once: true });
  media.appendChild(image);

  card.append(media);
  card.addEventListener('click', () => openImageViewer(imageFiles, index, card));
  return card;
}

function renderImageViewer() {
  const file = currentFiles[currentImageIndex];
  if (!file) return;

  const image = document.getElementById('imageViewerImage');
  const error = document.getElementById('imageViewerError');
  const viewer = document.getElementById('imageViewer');
  image.hidden = false;
  error.hidden = true;
  image.alt = `تصميم أثاث رقم ${currentImageIndex + 1}`;
  image.src = imageUrl(file, 2000);
  document.getElementById('imageViewerTitle').textContent = `التصميم رقم ${currentImageIndex + 1}`;
  document.getElementById('imageViewerCounter').textContent = `${currentImageIndex + 1} / ${currentFiles.length}`;
  viewer.querySelectorAll('[data-viewer-nav]').forEach(button => {
    button.hidden = currentFiles.length < 2;
  });
}

function openImageViewer(files, index, opener) {
  currentFiles = files;
  currentImageIndex = index;
  lastFocusedImage = opener;
  renderImageViewer();
  const viewer = document.getElementById('imageViewer');
  viewer.hidden = false;
  viewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  viewer.querySelector('.image-viewer__close').focus();
}

function closeImageViewer() {
  const viewer = document.getElementById('imageViewer');
  viewer.hidden = true;
  viewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (lastFocusedImage?.isConnected) lastFocusedImage.focus();
}

function showViewerImage(direction) {
  if (currentFiles.length < 2) return;
  currentImageIndex = (currentImageIndex + direction + currentFiles.length) % currentFiles.length;
  renderImageViewer();
}

async function renderRoute(path, force = false) {
  const requestId = ++routeRequestId;
  const grid = document.getElementById('catalogGrid');
  const gallery = document.getElementById('galleryGrid');
  const backButton = document.getElementById('catalogBack');
  document.getElementById('imageViewer').hidden = true;
  document.body.classList.remove('modal-open');
  setLoading(true);
  backButton.hidden = path.length === 0;
  backButton.onclick = () => navigateTo(path.slice(0, -1));
  renderBreadcrumbs(path);

  try {
    if (!driveConfig.apiKey || !driveConfig.rootFolderId) {
      throw new Error('إعداد Google Drive غير مكتمل. راجعي ملف drive-config.js.');
    }

    let activePath = [];
    let files = await loadFolderContents(driveConfig.rootFolderId, force);
    if (requestId !== routeRequestId) return;

    for (const segment of path) {
      const folder = folderItems(files).find(item => item.id === segment.id);
      if (!folder) {
        throw new Error('هذا القسم لم يعد موجودًا في Google Drive. حدّثي قائمة الأقسام.');
      }
      activePath = [...activePath, { id: folder.id, name: folder.name }];
      files = await loadFolderContents(folder.id, force);
      if (requestId !== routeRequestId) return;
    }

    currentPath = activePath;
    renderBreadcrumbs(currentPath);
    const folders = folderItems(files);
    const images = imageItems(files);
    const isRoot = currentPath.length === 0;
    const title = isRoot ? 'أقسام الأثاث' : currentPath[currentPath.length - 1].name;
    setPageHeader(
      title,
      isRoot ? 'اختاري قسمًا لاستعراض التصميمات المتاحة.' : 'اختاري تصميمًا لعرضه بحجم أكبر.'
    );

    if (folders.length) {
      const cards = await Promise.all(folders.map(folder => makeFolderCard(folder, requestId)));
      if (requestId !== routeRequestId) return;
      grid.replaceChildren(...cards);
      grid.hidden = false;
    }

    if (images.length) {
      const heading = document.createElement('h3');
      heading.className = 'gallery-grid__heading';
      heading.textContent = folders.length ? 'تصميمات هذا القسم' : title;
      gallery.appendChild(heading);
      images.forEach((file, index) => gallery.appendChild(makeImageCard(file, index, images)));
      gallery.hidden = false;
    }

    if (!folders.length && !images.length) {
      const empty = document.createElement('p');
      empty.className = 'catalog-message';
      empty.textContent = isRoot
        ? 'لا توجد أقسام متاحة حاليًا.'
        : 'لا توجد صور في هذا القسم حتى الآن.';
      (isRoot ? grid : gallery).appendChild(empty);
      (isRoot ? grid : gallery).hidden = false;
    }

    setStatus(
      images.length
        ? `تم العثور على ${images.length} تصميم${folders.length ? '، وأقسام فرعية' : ''}.`
        : folders.length ? `تم العثور على ${folders.length} أقسام.` : ''
    );
    if (window.location.hash.startsWith('#catalog')) {
      document.getElementById('catalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    if (requestId !== routeRequestId) return;
    console.error('Could not load the Google Drive catalog:', error);
    setStatus(`تعذر تحميل الكتالوج: ${error.message}`, true);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'catalog-retry';
    retry.textContent = 'إعادة المحاولة';
    retry.addEventListener('click', () => renderRoute(path, true));
    grid.appendChild(retry);
    grid.hidden = false;
  }
}

async function refreshCurrentRoute() {
  if (isRefreshing || !window.location.hash.startsWith('#catalog')) return;
  isRefreshing = true;
  folderCache.clear();
  try {
    await renderRoute(routeFromHash() || [], true);
  } finally {
    isRefreshing = false;
  }
}

window.addEventListener('scroll', () => {
  const nav = document.querySelector('nav');
  if (!nav) return;
  if (window.scrollY > 80) {
    nav.classList.add('bg-surface/95', 'shadow-[0_15px_40px_rgba(252,207,62,0.15)]', 'h-16');
    nav.classList.remove('h-20');
  } else {
    nav.classList.remove('bg-surface/95', 'shadow-[0_15px_40px_rgba(252,207,62,0.15)]', 'h-16');
    nav.classList.add('h-20');
  }
});

document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href === '#') return;
  if (href === '#catalog') {
    if (window.location.hash === '#catalog') renderRoute([]);
    return;
  }
  const target = document.querySelector(href);
  if (target) {
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

window.addEventListener('hashchange', () => {
  if (window.location.hash.startsWith('#catalog')) {
    renderRoute(routeFromHash() || []);
  }
});

window.addEventListener('focus', refreshCurrentRoute);
window.setInterval(refreshCurrentRoute, cacheDuration);

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('catalogRefresh').addEventListener('click', refreshCurrentRoute);
  document.querySelectorAll('[data-close-viewer]').forEach(element => {
    element.addEventListener('click', closeImageViewer);
  });
  document.querySelectorAll('[data-viewer-nav]').forEach(button => {
    button.addEventListener('click', () => {
      showViewerImage(button.dataset.viewerNav === 'next' ? 1 : -1);
    });
  });
  document.getElementById('imageViewerImage').addEventListener('error', () => {
    document.getElementById('imageViewerImage').hidden = true;
    document.getElementById('imageViewerError').hidden = false;
  });
  document.addEventListener('keydown', event => {
    if (document.getElementById('imageViewer').hidden) return;
    if (event.key === 'Escape') closeImageViewer();
    if (event.key === 'ArrowRight') showViewerImage(1);
    if (event.key === 'ArrowLeft') showViewerImage(-1);
  });

  const path = routeFromHash();
  if (path) renderRoute(path, true);
});
