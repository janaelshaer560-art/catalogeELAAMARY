// Consolidated interactive behaviors extracted from original index.html
const galleryData = {
  beds: {
    title: 'الأسرّة',
    images: [
      { src: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80', alt: 'سرير فاخر' },
      { src: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80', alt: 'تصميم سرير فاخر' }
    ]
  },
  wardrobes: {
    title: 'الأدولاب',
    images: [
      { src: 'images/wardrobes/1.jpg', alt: 'دولاب عصري' },
      { src: 'images/wardrobes/2.jpg', alt: 'دولاب فاخر' }
    ]
  },
  dining: {
    title: 'غرف السفرة',
    images: [
      { src: 'images/dining/1.jpg', alt: 'غرفة سفرة راقية' },
      { src: 'images/dining/2.jpg', alt: 'طاولة سفرة فاخرة' }
    ]
  },
  salon: {
    title: 'الصالون',
    images: [
      { src: 'images/salon/1.jpg', alt: 'صالون كلاسيكي' },
      { src: 'images/salon/2.jpg', alt: 'صالون أنيق' }
    ]
  },
  library: {
    title: 'المكتبات',
    images: [
      { src: 'images/library/1.jpg', alt: 'مكتبة فاخرة' },
      { src: 'images/library/2.jpg', alt: 'تصميم مكتبة راقي' }
    ]
  },
  sectional: {
    title: 'الركائن',
    images: [
      { src: 'images/sectional/1.jpg', alt: 'ركنة مريحة' },
      { src: 'images/sectional/2.jpg', alt: 'ركنة فاخرة' }
    ]
  },
  'coffee-table': {
    title: 'الطاولات',
    images: [
      { src: 'images/coffee-table/1.jpg', alt: 'طاولة قهوة راقية' },
      { src: 'images/coffee-table/2.jpg', alt: 'طاولة قهوة حديثة' }
    ]
  },
  'shoe-cabinet': {
    title: 'الجزامة',
    images: [
      { src: 'images/shoe-cabinet/1.jpg', alt: 'جزامة أنيقة' },
      { src: 'images/shoe-cabinet/2.jpg', alt: 'جزامة فاخرة' }
    ]
  },
  vanity: {
    title: 'التسريحة',
    images: [
      { src: 'images/vanity/1.jpg', alt: 'تسريحة فاخرة' },
      { src: 'images/vanity/2.jpg', alt: 'تسريحة أنيقة' }
    ]
  },
  'vanity-chair': {
    title: 'كراسي التسريحة',
    images: [
      { src: 'images/vanity-chair/1.jpg', alt: 'كرسي تسريحة فاخر' },
      { src: 'images/vanity-chair/2.jpg', alt: 'كرسي تسريحة عصري' }
    ]
  },
  puff: {
    title: 'البف',
    images: [
      { src: 'images/puff/1.jpg', alt: 'بف فخم' },
      { src: 'images/puff/2.jpg', alt: 'بف عصري' }
    ]
  },
  chiffonier: {
    title: 'الشيفونيرة',
    images: [
      { src: 'images/chiffonier/1.jpg', alt: 'شفونيرة فاخرة' },
      { src: 'images/chiffonier/2.jpg', alt: 'شفونيرة أنيقة' }
    ]
  },
  commode: {
    title: 'الكومود',
    images: [
      { src: 'images/commode/1.jpg', alt: 'كومود فاخر' },
      { src: 'images/commode/2.jpg', alt: 'كومود عصري' }
    ]
  }
};

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

let currentGalleryCategory = null;
let currentGalleryIndex = 0;
let galleryImages = [];

function openGallery(category) {
  const data = galleryData[category];
  if (!data) return;

  currentGalleryCategory = category;
  galleryImages = data.images;
  currentGalleryIndex = 0;

  const modal = document.getElementById('galleryModal');
  const title = document.getElementById('galleryModalTitle');
  const subtitle = document.getElementById('galleryModalSubtitle');
  const image = document.getElementById('galleryModalImage');
  const counter = document.getElementById('galleryModalCounter');

  title.textContent = data.title;
  subtitle.textContent = 'معرض الصور الخاص بهذه الفئة';
  renderGalleryImage();
  counter.textContent = `${currentGalleryIndex + 1} / ${galleryImages.length}`;

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#catalog .group').forEach((el, index) => {
    el.classList.add('reveal-init', 'catalog-card');
    el.style.transitionDelay = `${index * 50}ms`;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    const label = el.querySelector('span')?.textContent.trim();
    const category = categoryMap[label] || 'beds';
    el.dataset.category = category;

    el.addEventListener('click', () => openGallery(category));
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openGallery(category);
      }
    });

    observer.observe(el);
  });

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
    openGallery(category);
  }
});
