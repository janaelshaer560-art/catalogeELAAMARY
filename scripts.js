// Dynamic Gallery Data - Fetched from API
let galleryData = {};
let categoriesById = {};
let categoriesByKey = {};
let galleryReady = false;

// Keep category map for label matching
const categoryMap = {
  سرير: 'beds',
  دولاب: 'wardrobes',
  'تقسيمات دولاب': 'wardrobes',
  انتريه: 'salon',
  صالون: 'salon',
  'غرفة سفرة': 'dining',
  ركنة: 'sectional',
  'كوفي تيبل': 'coffee-table',
  مكتبة: 'library',
  جزامة: 'shoe-cabinet',
  بف: 'puff',
  'كرسي تسريحة': 'vanity-chair',
  تسريحة: 'vanity',
  شفونيرة: 'chiffonier',
  كومود: 'commode'
};

// Fetch categories and build the data structure
async function initializeGalleryData() {
  Object.entries(categoryMap).forEach(([label, key]) => {
    if (!galleryData[key]) {
      galleryData[key] = { id: null, title: label, images: [] };
    }
  });

  try {
    const response = await fetch('/api/public/categories');
    if (!response.ok) throw new Error('Failed to load categories');
    const categories = await response.json();
    await Promise.all(categories.map(async category => {
      const categoryId = category.id;
      const key = category.key;
      categoriesById[categoryId] = category;
      categoriesByKey[key] = category;
      galleryData[key] = { id: categoryId, title: category.name_ar || category.name, description: '', images: [] };
      await loadCategoryImages(categoryId);
    }));
    galleryReady = true;
    return true;
  } catch (error) {
    console.error('Error loading catalog data:', error);
    return false;
  }
}

// Fetch images for a specific category
async function loadCategoryImages(categoryId) {
  try {
    const response = await fetch(`/api/public/categories/${categoryId}/images`);
    if (!response.ok) throw new Error('Failed to load images');
    const images = await response.json();
    const category = categoriesById[categoryId];
    if (category && galleryData[category.key]) {
      galleryData[category.key].images = images.map(image => ({
        src: image.public_url || image.cloudinary_url,
        alt: image.alt_text || category.name_ar || category.name
      }));
    }
    return images;
  } catch (error) {
    console.error('Error loading category images:', error);
    return [];
  }
}

let currentGalleryCategory = null;
let currentGalleryIndex = 0;
let galleryImages = [];

function normalizeImageSource(src) {
  if (!src) return '';
  if (!src.includes('drive.google.com')) return src;

  const fileIdMatch = src.match(/\/d\/([^/]+)/) || src.match(/[?&]id=([^&]+)/);
  if (fileIdMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
  }

  return src;
}

function applySectionImages() {
  document.querySelectorAll('#catalog .group').forEach((card) => {
    const label = card.querySelector(':scope > span')?.textContent.trim();
    const category = categoryMap[label];
    const image = card.querySelector('img');
    if (!image || !category) return;

    const firstImage = galleryData[category]?.images?.[0];
    if (firstImage) {
      image.src = firstImage.src;
      image.alt = firstImage.alt;
    }
  });
}

async function refreshCatalog() {
  if (!galleryReady) return;
  if (!await initializeGalleryData()) return;
  applySectionImages();

  const modal = document.getElementById('galleryModal');
  const data = galleryData[currentGalleryCategory];
  if (modal && !modal.hidden && data?.images.length) {
    galleryImages = data.images.map((item) => ({
      ...item,
      src: normalizeImageSource(item.src)
    }));
    currentGalleryIndex = Math.min(currentGalleryIndex, galleryImages.length - 1);
    renderGalleryImage();
  }
}

window.addEventListener('storage', (event) => {
  if (event.key === 'catalog-updated') refreshCatalog();
});

window.addEventListener('focus', refreshCatalog);

function openGallery(category, fallbackImage) {
  const data = galleryData[category];
  if (!data) return;

  currentGalleryCategory = category;
  galleryImages = (data.images || []).map((item) => ({
    ...item,
    src: normalizeImageSource(item.src)
  }));
  if (!galleryImages.length && fallbackImage) {
    galleryImages = [{ src: normalizeImageSource(fallbackImage.src), alt: fallbackImage.alt }];
  }
  currentGalleryIndex = 0;

  const modal = document.getElementById('galleryModal');
  const title = document.getElementById('galleryModalTitle');
  const subtitle = document.getElementById('galleryModalSubtitle');
  const counter = document.getElementById('galleryModalCounter');

  title.textContent = data.title;
  subtitle.textContent = data.description || 'معرض الصور الخاص بهذه الفئة';
  renderGalleryImage();
  counter.textContent = `${currentGalleryIndex + 1} / ${galleryImages.length}`;

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function renderGalleryThumbnails() {
  const thumbs = document.getElementById('galleryModalThumbs');
  if (!thumbs) return;

  thumbs.innerHTML = '';
  galleryImages.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `gallery-modal__thumb${index === currentGalleryIndex ? ' is-active' : ''}`;
    button.setAttribute('aria-label', `صورة ${index + 1}`);
    button.innerHTML = `<img src="${item.src}" alt="${item.alt || ''}" loading="lazy" />`;
    button.addEventListener('click', () => {
      currentGalleryIndex = index;
      renderGalleryImage();
    });
    thumbs.appendChild(button);
  });
}

function renderGalleryImage() {
  const image = document.getElementById('galleryModalImage');
  const counter = document.getElementById('galleryModalCounter');
  const item = galleryImages[currentGalleryIndex];
  if (!item) return;

  image.classList.remove('is-flipping');
  image.classList.add('is-flipping');
  setTimeout(() => {
    image.src = item.src;
    image.alt = item.alt;
    image.classList.remove('is-flipping');
  }, 170);

  counter.textContent = `${currentGalleryIndex + 1} / ${galleryImages.length}`;
  renderGalleryThumbnails();
}

function closeGallery() {
  const modal = document.getElementById('galleryModal');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function showNextGalleryImage() {
  if (!galleryImages.length) return;
  currentGalleryIndex = (currentGalleryIndex + 1) % galleryImages.length;
  renderGalleryImage();
}

function showPrevGalleryImage() {
  if (!galleryImages.length) return;
  currentGalleryIndex = (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length;
  renderGalleryImage();
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

// Smooth anchor scrolling for internal links
document.addEventListener('click', (e) => {
  const el = e.target.closest('a[href^="#"]');
  if (!el) return;
  const href = el.getAttribute('href');
  if (!href || href === '#') return;
  const target = document.querySelector(href);
  if (target) {
    e.preventDefault();
    target.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
});

// Intersection Observer reveal (used for catalog items)
const observerOptions = { threshold: 0.1 };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.remove('reveal-init');
      entry.target.classList.add('reveal-show');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize gallery data from API
  await initializeGalleryData();

  document.querySelectorAll('#catalog .group').forEach((el, index) => {
    el.classList.add('reveal-init', 'catalog-card');
    el.style.transitionDelay = `${index * 50}ms`;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    const label = el.querySelector(':scope > span')?.textContent.trim();
    const category = categoryMap[label];
    if (!category) {
      console.error(`No catalog category is configured for "${label || 'unnamed card'}".`);
      return;
    }
    el.dataset.category = category;
    const cardImage = el.querySelector('img');
    const fallbackImage = cardImage ? {
      src: cardImage.src,
      alt: cardImage.alt || label
    } : null;

    el.addEventListener('click', async () => {
      // Load images for this category if not already cached
      const data = galleryData[category];
      if (data && data.images.length === 0 && data.id) {
        await loadCategoryImages(data.id);
      }
      openGallery(category, fallbackImage);
    });
    el.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        // Load images for this category if not already cached
        const data = galleryData[category];
        if (data && data.images.length === 0 && data.id) {
          await loadCategoryImages(data.id);
        }
        openGallery(category, fallbackImage);
      }
    });

    observer.observe(el);
  });

  applySectionImages();

  document.querySelectorAll('[data-close-modal]').forEach((element) => {
    element.addEventListener('click', closeGallery);
  });

  document.querySelectorAll('[data-nav]').forEach((element) => {
    element.addEventListener('click', () => {
      if (element.dataset.nav === 'next') showNextGalleryImage();
      if (element.dataset.nav === 'prev') showPrevGalleryImage();
    });
  });

  document.addEventListener('keydown', (event) => {
    const modal = document.getElementById('galleryModal');
    if (modal.hidden) return;
    if (event.key === 'Escape') closeGallery();
    if (event.key === 'ArrowRight') showNextGalleryImage();
    if (event.key === 'ArrowLeft') showPrevGalleryImage();
  });

  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  if (category && galleryData[category]) {
    if (galleryData[category].images.length === 0 && galleryData[category].id) {
      await loadCategoryImages(galleryData[category].id);
    }
    openGallery(category);
  }
});
