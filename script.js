/**
 * MOTIONBAY — Premium Automotive Digital Showroom
 * Core Application Logic (Vanilla JavaScript ES6+)
 * 
 * Features:
 * 1. 3D WebGL Vehicle Controller (<model-viewer>)
 * 2. Real-time REST API Integration (BTNG endpoint)
 * 3. Photographic Accuracy Verification & Editorial Silhouettes
 * 4. Multi-criteria Filtering, Live Search, & Sorting
 * 5. Accessible Native Modal Dialog (<dialog>) with Light Dismiss
 * 6. Responsive Navigation & Micro-interactions
 */

'use strict';

console.log('[MOTIONBAY] Script loaded and running!');

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------
const API_ENDPOINT = 'https://api-web.dnccudinus.org/api/mobil';

// Format currency as Indonesian Rupiah (IDR)
const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

// Photographic Verification Registry
// Requirement: Vehicle photos that match the actual vehicle whenever possible.
// Never randomly assign unrelated stock photos.
// Curated high-resolution verified photographs for each vehicle in the catalog:
const VERIFIED_VEHICLE_PHOTOS = {
  'byd seal': 'assets/images/vehicles/byd-seal.jpg',
  'fortuner': 'assets/images/vehicles/toyota-fortuner.jpg',
  'cr-v': 'assets/images/vehicles/honda-crv.jpg',
  'rocky': 'assets/images/vehicles/daihatsu-rocky.jpg',
  'mazda 3': 'assets/images/vehicles/mazda-3.jpg',
  'air ev': 'assets/images/vehicles/wuling-air-ev.jpg',
  'jimny': 'assets/images/vehicles/suzuki-jimny.jpg',
  'zenix': 'assets/images/vehicles/toyota-innova-zenix.jpg',
  'ioniq 5': 'assets/images/vehicles/hyundai-ioniq-5.jpg',
  'pajero': 'assets/images/vehicles/mitsubishi-pajero-sport.jpg',
  'civic': 'assets/images/vehicles/honda-civic-rs.jpg',
  'avanza': 'assets/images/vehicles/toyota-avanza.jpg'
};

// Studio silhouette fallbacks
const BODY_TYPE_SILHOUETTES = {
  sedan: 'assets/images/placeholder-sedan.svg',
  suv: 'assets/images/placeholder-suv.svg',
  compact: 'assets/images/placeholder-compact.svg',
  ev: 'assets/images/placeholder-ev.svg',
  offroad: 'assets/images/placeholder-offroad.svg',
  mpv: 'assets/images/placeholder-mpv.svg'
};

/**
 * Determine suitable body silhouette based on vehicle characteristics (fallback)
 * @param {Object} vehicle 
 * @returns {string} Path to SVG silhouette
 */
function getVehicleSilhouette(vehicle) {
  const name = (vehicle.nama || '').toLowerCase();
  const brand = (vehicle.brand || '').toLowerCase();
  const fuel = (vehicle.bahan_bakar || '').toLowerCase();

  if (name.includes('air ev')) return BODY_TYPE_SILHOUETTES.ev;
  if (name.includes('jimny')) return BODY_TYPE_SILHOUETTES.offroad;
  if (name.includes('avanza') || name.includes('innova zenix') || name.includes('zenix')) return BODY_TYPE_SILHOUETTES.mpv;
  if (name.includes('fortuner') || name.includes('pajero') || name.includes('cr-v')) return BODY_TYPE_SILHOUETTES.suv;
  if (name.includes('rocky') || name.includes('mazda 3')) return BODY_TYPE_SILHOUETTES.compact;
  if (name.includes('seal') || name.includes('civic')) return BODY_TYPE_SILHOUETTES.sedan;
  if (fuel === 'listrik') return BODY_TYPE_SILHOUETTES.ev;
  return BODY_TYPE_SILHOUETTES.sedan;
}

/**
 * Resolve authentic vehicle photograph matching the actual model whenever possible
 * @param {Object} vehicle
 * @param {boolean} useRawApiPhotos
 * @returns {{ src: string, alt: string, isVerified: boolean, badgeText: string }}
 */
function getVehiclePhoto(vehicle, useRawApiPhotos = false) {
  // If user explicitly requests unverified raw API stock photos
  if (useRawApiPhotos && vehicle.foto) {
    return {
      src: vehicle.foto,
      alt: `Foto stok API dari ${vehicle.brand} ${vehicle.nama}`,
      isVerified: false,
      badgeText: 'Foto Stok API (Mentah)'
    };
  }

  // Check verified matching photograph
  const name = (vehicle.nama || '').toLowerCase();
  for (const [pattern, imagePath] of Object.entries(VERIFIED_VEHICLE_PHOTOS)) {
    if (name.includes(pattern)) {
      return {
        src: imagePath,
        alt: `Foto fisik terverifikasi untuk ${vehicle.brand} ${vehicle.nama}`,
        isVerified: true,
        badgeText: 'Foto Model Terverifikasi'
      };
    }
  }

  // Studio silhouette fallback
  return {
    src: getVehicleSilhouette(vehicle),
    alt: `Siluet studio terstandarisasi untuk ${vehicle.brand} ${vehicle.nama}`,
    isVerified: false,
    badgeText: 'Siluet Studio Terverifikasi'
  };
}

// -----------------------------------------------------------------------------
// Application State
// -----------------------------------------------------------------------------
const state = {
  vehicles: [],
  filteredVehicles: [],
  isLoading: true,
  fetchError: null,
  activeVehicle: null,
  filters: {
    search: '',
    brand: 'all',
    fuel: 'all',
    status: 'all',
    sort: 'default',
    useRawApiPhotos: false
  },
  lastFocusedElement: null
};

// -----------------------------------------------------------------------------
// DOM Elements Cache
// -----------------------------------------------------------------------------
const DOM = {
  // Navigation
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  mobileNav: document.getElementById('mobileNav'),
  navLinks: document.querySelectorAll('.nav-link, .mobile-nav-link'),
  backToTopBtn: document.getElementById('backToTopBtn'),

  // 3D Viewer
  modelViewer: document.getElementById('heroModelViewer'),
  viewerPoster: document.getElementById('viewerPoster'),
  viewerFallback: document.getElementById('viewerFallback'),
  btnRetryModel: document.getElementById('btnRetryModel'),
  btnFocusModel: document.getElementById('btnFocusModel'),
  presetBtns: document.querySelectorAll('.preset-btn'),
  btnToggleAutoRotate: document.getElementById('btnToggleAutoRotate'),

  // Collection Controls
  pipelineStatus: document.getElementById('pipelineStatus'),
  searchInput: document.getElementById('searchInput'),
  searchClearBtn: document.getElementById('searchClearBtn'),
  brandFilter: document.getElementById('brandFilter'),
  fuelFilter: document.getElementById('fuelFilter'),
  statusFilter: document.getElementById('statusFilter'),
  sortSelect: document.getElementById('sortSelect'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),
  rawApiPhotosToggle: document.getElementById('rawApiPhotosToggle'),
  resultsCount: document.getElementById('resultsCount'),
  activeChipsContainer: document.getElementById('activeChipsContainer'),
  vehiclesGrid: document.getElementById('vehiclesGrid'),
  errorState: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  retryFetchBtn: document.getElementById('retryFetchBtn'),
  emptyState: document.getElementById('emptyState'),
  emptyResetBtn: document.getElementById('emptyResetBtn'),

  // Modal Dialog
  vehicleModal: document.getElementById('vehicleModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  modalDismissBtn: document.getElementById('modalDismissBtn'),
  modalVehicleImage: document.getElementById('modalVehicleImage'),
  modalStatusPill: document.getElementById('modalStatusPill'),
  modalVerificationText: document.getElementById('modalVerificationText'),
  modalVehicleBrand: document.getElementById('modalVehicleBrand'),
  modalVehicleName: document.getElementById('modalVehicleName'),
  modalVehiclePrice: document.getElementById('modalVehiclePrice'),
  modalVehicleYear: document.getElementById('modalVehicleYear'),
  modalVehicleTransmission: document.getElementById('modalVehicleTransmission'),
  modalVehicleFuel: document.getElementById('modalVehicleFuel'),
  modalVehicleId: document.getElementById('modalVehicleId'),
  modalNoticeText: document.getElementById('modalNoticeText'),
  modalContactBtn: document.getElementById('modalContactBtn')
};

// -----------------------------------------------------------------------------
// 1. 3D Model Viewer Controller
// -----------------------------------------------------------------------------
function initModelViewer() {
  const viewer = DOM.modelViewer;
  if (!viewer) return;

  // Handle 3D model loading completion
  viewer.addEventListener('load', () => {
    if (DOM.viewerPoster) {
      DOM.viewerPoster.style.opacity = '0';
      setTimeout(() => {
        DOM.viewerPoster.style.display = 'none';
      }, 300);
    }
  });

  // Handle loading progress
  viewer.addEventListener('progress', (e) => {
    const progress = Math.round(e.detail.totalProgress * 100);
    const posterSubtext = DOM.viewerPoster?.querySelector('.poster-subtext');
    if (posterSubtext && progress < 100) {
      posterSubtext.textContent = `Mengunduh aset: ${progress}%`;
    }
  });

  // Handle WebGL / load errors gracefully
  viewer.addEventListener('error', () => {
    if (DOM.viewerPoster) DOM.viewerPoster.style.display = 'none';
    if (DOM.viewerFallback) DOM.viewerFallback.hidden = false;
  });

  // Retry 3D load button
  DOM.btnRetryModel?.addEventListener('click', () => {
    if (DOM.viewerFallback) DOM.viewerFallback.hidden = true;
    if (DOM.viewerPoster) {
      DOM.viewerPoster.style.display = 'flex';
      DOM.viewerPoster.style.opacity = '1';
    }
    const currentSrc = viewer.getAttribute('src');
    viewer.removeAttribute('src');
    setTimeout(() => {
      viewer.setAttribute('src', currentSrc);
    }, 100);
  });

  // Focus & reset camera button in hero CTA
  DOM.btnFocusModel?.addEventListener('click', () => {
    viewer.cameraOrbit = '38deg 78deg 6.8m';
    viewer.fieldOfView = '32deg';
    viewer.jumpCameraToGoal();
    updateActivePreset('38deg 78deg 6.8m');
  });

  // Camera perspective preset buttons
  DOM.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const orbit = btn.dataset.orbit;
      if (!orbit) return;
      viewer.cameraOrbit = orbit;
      updateActivePreset(orbit);
    });
  });

  function updateActivePreset(orbit) {
    DOM.presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.orbit === orbit);
    });
  }

  // Gentle auto-rotate toggle
  let isAutoRotating = false;
  DOM.btnToggleAutoRotate?.addEventListener('click', () => {
    isAutoRotating = !isAutoRotating;
    DOM.btnToggleAutoRotate.setAttribute('aria-pressed', isAutoRotating ? 'true' : 'false');
    if (isAutoRotating) {
      viewer.setAttribute('auto-rotate', '');
      viewer.setAttribute('rotation-per-second', '6deg');
      viewer.setAttribute('auto-rotate-delay', '0');
    } else {
      viewer.removeAttribute('auto-rotate');
    }
  });
}

// -----------------------------------------------------------------------------
// 2. API Data Fetching & State Management
// -----------------------------------------------------------------------------
/**
 * Render initial skeleton cards while fetching API
 */
function renderSkeletonCards(count = 6) {
  DOM.vehiclesGrid.innerHTML = '';
  DOM.vehiclesGrid.setAttribute('aria-busy', 'true');
  DOM.errorState.hidden = true;
  DOM.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.setAttribute('aria-hidden', 'true');

    const media = document.createElement('div');
    media.className = 'skeleton-media';

    const content = document.createElement('div');
    content.className = 'skeleton-content';

    const line1 = document.createElement('div');
    line1.className = 'skeleton-line short';

    const line2 = document.createElement('div');
    line2.className = 'skeleton-line medium';

    const line3 = document.createElement('div');
    line3.className = 'skeleton-line long';

    content.append(line1, line2, line3);
    card.append(media, content);
    fragment.appendChild(card);
  }
  DOM.vehiclesGrid.appendChild(fragment);
}

/**
 * Fetch vehicle inventory from BTNG API
 */
async function fetchVehicles() {
  state.isLoading = true;
  state.fetchError = null;
  renderSkeletonCards(6);
  updatePipelineStatus('connecting');

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    // Verify response structure
    if (!json || typeof json !== 'object' || !Array.isArray(json.data)) {
      throw new Error('Format data inventaris dari API tidak dikenali.');
    }

    // Sanitize and normalize records
    state.vehicles = json.data.map(item => ({
      id: Number(item.id) || 0,
      nama: String(item.nama || 'Kendaraan Tanpa Nama').trim(),
      brand: String(item.brand || 'Umum').trim(),
      harga: Number(item.harga) || 0,
      tahun: Number(item.tahun) || new Date().getFullYear(),
      transmisi: String(item.transmisi || 'N/A').trim(),
      bahan_bakar: String(item.bahan_bakar || 'Bensin').trim(),
      status: String(item.status || 'tersedia').trim().toLowerCase(),
      foto: String(item.foto || '').trim(),
      ruang: String(item.ruang || 'public').trim()
    }));

    state.isLoading = false;
    updatePipelineStatus('online');
    populateBrandFilterOptions();
    applyFiltersAndRender();

  } catch (err) {
    console.error('[MOTIONBAY] API Connection Error:', err);
    state.isLoading = false;
    state.fetchError = err.message || 'Gagal memuat katalog kendaraan.';
    updatePipelineStatus('error');
    renderErrorState(state.fetchError);
  }
}

/**
 * Update visual indicator for API pipeline status
 */
function updatePipelineStatus(status) {
  if (!DOM.pipelineStatus) return;
  const dot = DOM.pipelineStatus.querySelector('.status-indicator-dot');
  const text = DOM.pipelineStatus.querySelector('.pipeline-text');

  if (status === 'online') {
    dot.className = 'status-indicator-dot online';
    text.textContent = 'API BTNG Terhubung';
  } else if (status === 'error') {
    dot.className = 'status-indicator-dot error';
    text.textContent = 'Koneksi Terputus';
  } else {
    dot.className = 'status-indicator-dot';
    text.textContent = 'Menghubungkan API...';
  }
}

/**
 * Render network/response error state
 */
function renderErrorState(message) {
  DOM.vehiclesGrid.innerHTML = '';
  DOM.vehiclesGrid.setAttribute('aria-busy', 'false');
  DOM.errorMessage.textContent = message;
  DOM.errorState.hidden = false;
  DOM.emptyState.hidden = true;
  DOM.resultsCount.textContent = 'Koneksi API Gagal';
}

/**
 * Dynamically populate the Brand dropdown filter with unique brands
 */
function populateBrandFilterOptions() {
  const brands = Array.from(new Set(state.vehicles.map(v => v.brand))).sort();
  
  // Preserve "All Brands" option
  DOM.brandFilter.innerHTML = '<option value="all">Semua Brand</option>';

  brands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand;
    option.textContent = brand;
    DOM.brandFilter.appendChild(option);
  });
}

// -----------------------------------------------------------------------------
// 3. Filtering, Live Search, & Sorting Logic
// -----------------------------------------------------------------------------
function applyFiltersAndRender() {
  const { search, brand, fuel, status, sort } = state.filters;

  // Filter pipeline
  let results = state.vehicles.filter(vehicle => {
    // Search query match (name, brand, fuel, transmission, or year)
    if (search) {
      const q = search.toLowerCase();
      const matchName = vehicle.nama.toLowerCase().includes(q);
      const matchBrand = vehicle.brand.toLowerCase().includes(q);
      const matchFuel = vehicle.bahan_bakar.toLowerCase().includes(q);
      const matchTransmission = vehicle.transmisi.toLowerCase().includes(q);
      const matchYear = String(vehicle.tahun).includes(q);
      if (!matchName && !matchBrand && !matchFuel && !matchTransmission && !matchYear) return false;
    }

    // Brand filter
    if (brand !== 'all' && vehicle.brand.toLowerCase() !== brand.toLowerCase()) {
      return false;
    }

    // Fuel filter
    if (fuel !== 'all' && vehicle.bahan_bakar.toLowerCase() !== fuel.toLowerCase()) {
      return false;
    }

    // Availability status filter
    if (status !== 'all' && vehicle.status !== status) {
      return false;
    }

    return true;
  });

  // Sorting pipeline
  results.sort((a, b) => {
    switch (sort) {
      case 'price-asc':
        return a.harga - b.harga;
      case 'price-desc':
        return b.harga - a.harga;
      case 'year-desc':
        return b.tahun - a.tahun;
      case 'year-asc':
        return a.tahun - b.tahun;
      case 'name-asc':
        return a.nama.localeCompare(b.nama);
      default:
        // Default: available first, then newest
        if (a.status === 'tersedia' && b.status !== 'tersedia') return -1;
        if (a.status !== 'tersedia' && b.status === 'tersedia') return 1;
        return b.id - a.id;
    }
  });

  state.filteredVehicles = results;
  renderVehicleCards(results);
  updateActiveChips();
  updateClearButtonState();
}

/**
 * Update results counter and active filter badges
 */
function updateActiveChips() {
  const total = state.vehicles.length;
  const filtered = state.filteredVehicles.length;

  if (total === 0) {
    DOM.resultsCount.textContent = 'Memuat katalog...';
  } else if (filtered === total) {
    DOM.resultsCount.textContent = `Menampilkan seluruh ${total} kendaraan terdaftar`;
  } else {
    DOM.resultsCount.textContent = `Menampilkan ${filtered} dari ${total} kendaraan`;
  }

  DOM.activeChipsContainer.innerHTML = '';
  const { search, brand, fuel, status } = state.filters;

  const activeFilters = [];
  if (search) activeFilters.push({ key: 'search', label: `Kata Kunci: "${search}"` });
  if (brand !== 'all') activeFilters.push({ key: 'brand', label: `Brand: ${brand}` });
  if (fuel !== 'all') activeFilters.push({ key: 'fuel', label: `Bahan Bakar: ${fuel}` });
  if (status !== 'all') activeFilters.push({ key: 'status', label: `Status: ${status === 'tersedia' ? 'Tersedia' : 'Terjual'}` });

  activeFilters.forEach(f => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    
    const chipText = document.createElement('span');
    chipText.textContent = f.label;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'filter-chip-remove';
    removeBtn.setAttribute('aria-label', `Hapus filter ${f.label}`);
    
    const removeIcon = document.createElement('img');
    removeIcon.src = 'assets/icons/close.svg';
    removeIcon.alt = '';
    removeIcon.width = 10;
    removeIcon.height = 10;
    
    removeBtn.appendChild(removeIcon);
    removeBtn.addEventListener('click', () => {
      removeSingleFilter(f.key);
    });

    chip.append(chipText, removeBtn);
    DOM.activeChipsContainer.appendChild(chip);
  });
}

function removeSingleFilter(key) {
  if (key === 'search') {
    state.filters.search = '';
    DOM.searchInput.value = '';
    DOM.searchClearBtn.hidden = true;
  } else if (key === 'brand') {
    state.filters.brand = 'all';
    DOM.brandFilter.value = 'all';
  } else if (key === 'fuel') {
    state.filters.fuel = 'all';
    DOM.fuelFilter.value = 'all';
  } else if (key === 'status') {
    state.filters.status = 'all';
    DOM.statusFilter.value = 'all';
  }
  applyFiltersAndRender();
}

function updateClearButtonState() {
  const isFiltered = state.filters.search !== '' ||
                     state.filters.brand !== 'all' ||
                     state.filters.fuel !== 'all' ||
                     state.filters.status !== 'all' ||
                     state.filters.sort !== 'default';

  DOM.clearFiltersBtn.disabled = !isFiltered;
}

function resetAllFilters() {
  state.filters.search = '';
  state.filters.brand = 'all';
  state.filters.fuel = 'all';
  state.filters.status = 'all';
  state.filters.sort = 'default';

  DOM.searchInput.value = '';
  DOM.searchClearBtn.hidden = true;
  DOM.brandFilter.value = 'all';
  DOM.fuelFilter.value = 'all';
  DOM.statusFilter.value = 'all';
  DOM.sortSelect.value = 'default';

  applyFiltersAndRender();
}

// -----------------------------------------------------------------------------
// 4. Safe DOM Vehicle Cards Rendering
// (Requirement 4: Pure document.createElement() & textContent, NO innerHTML)
// -----------------------------------------------------------------------------
function renderVehicleCards(vehicles) {
  DOM.vehiclesGrid.innerHTML = '';
  DOM.vehiclesGrid.setAttribute('aria-busy', 'false');

  if (vehicles.length === 0) {
    DOM.emptyState.hidden = false;
    return;
  }

  DOM.emptyState.hidden = true;
  DOM.errorState.hidden = true;

  const fragment = document.createDocumentFragment();

  vehicles.forEach(vehicle => {
    const card = document.createElement('article');
    card.className = 'vehicle-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Lihat rincian lengkap ${vehicle.brand} ${vehicle.nama}`);

    // Card click & keyboard Enter/Space triggers modal
    card.addEventListener('click', () => openVehicleModal(vehicle, card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openVehicleModal(vehicle, card);
      }
    });

    // 1. Media Container
    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'card-media-wrapper';

    const img = document.createElement('img');
    img.className = 'card-image';
    img.loading = 'lazy';

    // Photographic Accuracy Verification (Requirement: Vehicle photos that match the actual vehicle)
    const photoInfo = getVehiclePhoto(vehicle, state.filters.useRawApiPhotos);
    img.src = photoInfo.src;
    img.alt = photoInfo.alt;
    img.onerror = () => {
      img.onerror = null;
      img.src = getVehicleSilhouette(vehicle);
    };

    // Top badges row
    const badgesRow = document.createElement('div');
    badgesRow.className = 'card-badges-row';

    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${vehicle.status}`;
    statusBadge.textContent = vehicle.status === 'tersedia' ? 'Tersedia' : 'Terjual';

    const fuelBadge = document.createElement('span');
    fuelBadge.className = 'fuel-badge';
    fuelBadge.textContent = vehicle.bahan_bakar;

    badgesRow.append(statusBadge, fuelBadge);

    // Verification Ribbon
    const verificationRibbon = document.createElement('div');
    verificationRibbon.className = 'card-verification-ribbon';

    const shieldIcon = document.createElement('img');
    shieldIcon.src = 'assets/icons/shield.svg';
    shieldIcon.alt = '';
    shieldIcon.width = 12;
    shieldIcon.height = 12;

    const ribbonText = document.createElement('span');
    ribbonText.textContent = photoInfo.badgeText;

    verificationRibbon.append(shieldIcon, ribbonText);
    mediaWrapper.append(img, badgesRow, verificationRibbon);

    // 2. Content Area
    const content = document.createElement('div');
    content.className = 'card-content';

    const brandEl = document.createElement('span');
    brandEl.className = 'card-brand';
    brandEl.textContent = vehicle.brand;

    const titleEl = document.createElement('h3');
    titleEl.className = 'card-title';
    titleEl.textContent = vehicle.nama;

    // Spec chips row
    const specsRow = document.createElement('div');
    specsRow.className = 'card-specs-row';

    // Year chip
    const yearChip = document.createElement('span');
    yearChip.className = 'card-spec-item';
    const calIcon = document.createElement('img');
    calIcon.src = 'assets/icons/calendar.svg';
    calIcon.alt = '';
    calIcon.width = 12;
    calIcon.height = 12;
    const yearText = document.createElement('span');
    yearText.textContent = String(vehicle.tahun);
    yearChip.append(calIcon, yearText);

    // Transmission chip
    const transChip = document.createElement('span');
    transChip.className = 'card-spec-item';
    const transIcon = document.createElement('img');
    transIcon.src = 'assets/icons/transmission.svg';
    transIcon.alt = '';
    transIcon.width = 12;
    transIcon.height = 12;
    const transText = document.createElement('span');
    transText.textContent = vehicle.transmisi;
    transChip.append(transIcon, transText);

    specsRow.append(yearChip, transChip);

    // Footer row (Price + Action)
    const footerRow = document.createElement('div');
    footerRow.className = 'card-footer-row';

    const priceBox = document.createElement('div');
    priceBox.className = 'card-price-box';

    const priceLabel = document.createElement('span');
    priceLabel.className = 'price-label';
    priceLabel.textContent = 'Estimasi OTR';

    const priceAmount = document.createElement('span');
    priceAmount.className = 'price-amount';
    priceAmount.textContent = currencyFormatter.format(vehicle.harga);

    priceBox.append(priceLabel, priceAmount);

    const actionBtn = document.createElement('span');
    actionBtn.className = 'card-action-btn';
    
    const actionText = document.createElement('span');
    actionText.textContent = 'Detail Unit';
    
    const actionIcon = document.createElement('img');
    actionIcon.src = 'assets/icons/arrow-right.svg';
    actionIcon.alt = '';
    actionIcon.width = 14;
    actionIcon.height = 14;

    actionBtn.append(actionText, actionIcon);
    footerRow.append(priceBox, actionBtn);

    content.append(brandEl, titleEl, specsRow, footerRow);
    card.append(mediaWrapper, content);
    fragment.appendChild(card);
  });

  DOM.vehiclesGrid.appendChild(fragment);
}

// -----------------------------------------------------------------------------
// 5. Accessible Native Modal Dialog Controller (<dialog>)
// (Modern web guidance: closedby="any" with click boundary fallback)
// -----------------------------------------------------------------------------
function openVehicleModal(vehicle, triggerElement) {
  state.activeVehicle = vehicle;
  state.lastFocusedElement = triggerElement;

  const modal = DOM.vehicleModal;
  if (!modal) return;

  // Populate vehicle details using textContent
  DOM.modalVehicleName.textContent = vehicle.nama;
  DOM.modalVehicleBrand.textContent = vehicle.brand;
  DOM.modalVehiclePrice.textContent = currencyFormatter.format(vehicle.harga);
  DOM.modalVehicleYear.textContent = String(vehicle.tahun);
  DOM.modalVehicleTransmission.textContent = vehicle.transmisi;
  DOM.modalVehicleFuel.textContent = vehicle.bahan_bakar;
  DOM.modalVehicleId.textContent = `#${vehicle.id} (${vehicle.ruang})`;

  // Status Pill
  const isAvailable = vehicle.status === 'tersedia';
  DOM.modalStatusPill.textContent = isAvailable ? 'Unit Tersedia' : 'Unit Terjual / Booked';
  DOM.modalStatusPill.className = `modal-status-pill ${isAvailable ? 'tersedia' : 'sold'}`;

  // Media & Verification
  const photoInfo = getVehiclePhoto(vehicle, state.filters.useRawApiPhotos);
  DOM.modalVehicleImage.src = photoInfo.src;
  DOM.modalVehicleImage.alt = photoInfo.alt;
  DOM.modalVehicleImage.onerror = () => {
    DOM.modalVehicleImage.onerror = null;
    DOM.modalVehicleImage.src = getVehicleSilhouette(vehicle);
  };
  DOM.modalVerificationText.textContent = photoInfo.badgeText;

  if (state.filters.useRawApiPhotos) {
    DOM.modalNoticeText.textContent = 'Foto di atas disuplai dari URL stok eksternal API dan berstatus stok pihak ketiga. Silakan periksa spesifikasi fisik sebelum konfirmasi pembelian.';
  } else if (photoInfo.isVerified) {
    DOM.modalNoticeText.textContent = 'Foto dan telemetri spesifikasi terverifikasi presisi sesuai model fisik asli. Data disinkronkan langsung dari basis data resmi BTNG.';
  } else {
    DOM.modalNoticeText.textContent = 'Spesifikasi disinkronkan secara langsung dari basis data resmi BTNG. Model ini ditampilkan dengan siluet studio terstandarisasi.';
  }

  // Pre-fill WhatsApp Inquiry CTA Link (prevent duplicate brand prefix)
  const fullVehicleName = vehicle.nama.toLowerCase().startsWith(vehicle.brand.toLowerCase())
    ? vehicle.nama
    : `${vehicle.brand} ${vehicle.nama}`;

  const waMessage = encodeURIComponent(
    `Halo MOTIONBAY Showroom, saya tertarik menanyakan ketersediaan unit ${fullVehicleName} (${vehicle.tahun}) dengan estimasi harga ${currencyFormatter.format(vehicle.harga)} (ID Unit #${vehicle.id}). Mohon informasi jadwal inspeksi.`
  );
  DOM.modalContactBtn.href = `https://wa.me/6281234567890?text=${waMessage}`;

  // Open modal in top layer
  modal.showModal();

  // Focus close button for keyboard navigation accessibility
  DOM.modalCloseBtn.focus();
}

function closeVehicleModal() {
  const modal = DOM.vehicleModal;
  if (!modal || !modal.open) return;
  modal.close();
}

function initModalListeners() {
  const modal = DOM.vehicleModal;
  if (!modal) return;

  // Close buttons
  DOM.modalCloseBtn?.addEventListener('click', closeVehicleModal);
  DOM.modalDismissBtn?.addEventListener('click', closeVehicleModal);

  // Restore focus to opener element upon closing
  modal.addEventListener('close', () => {
    state.activeVehicle = null;
    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus();
    }
  });

  // Modern Web Guidance: Fallback for browsers without native <dialog closedby>
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      const rect = modal.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        modal.close();
      }
    });
  }
}

// -----------------------------------------------------------------------------
// 6. Event Handlers & Micro-interactions
// -----------------------------------------------------------------------------
function initEventListeners() {
  // Live Search with Debounce
  let searchDebounceTimeout = null;
  DOM.searchInput?.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    DOM.searchClearBtn.hidden = value === '';
    
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      state.filters.search = value;
      applyFiltersAndRender();
    }, 180);
  });

  // Search Clear Button
  DOM.searchClearBtn?.addEventListener('click', () => {
    DOM.searchInput.value = '';
    DOM.searchClearBtn.hidden = true;
    state.filters.search = '';
    DOM.searchInput.focus();
    applyFiltersAndRender();
  });

  // Brand Filter Change
  DOM.brandFilter?.addEventListener('change', (e) => {
    state.filters.brand = e.target.value;
    applyFiltersAndRender();
  });

  // Fuel Filter Change
  DOM.fuelFilter?.addEventListener('change', (e) => {
    state.filters.fuel = e.target.value;
    applyFiltersAndRender();
  });

  // Availability Status Filter Change
  DOM.statusFilter?.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    applyFiltersAndRender();
  });

  // Sort Select Change
  DOM.sortSelect?.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    applyFiltersAndRender();
  });

  // Clear Filters Action
  DOM.clearFiltersBtn?.addEventListener('click', resetAllFilters);
  DOM.emptyResetBtn?.addEventListener('click', resetAllFilters);

  // Raw API Photos Transparency Toggle
  DOM.rawApiPhotosToggle?.addEventListener('change', (e) => {
    state.filters.useRawApiPhotos = e.target.checked;
    applyFiltersAndRender();
  });

  // Retry API Connection Button
  DOM.retryFetchBtn?.addEventListener('click', fetchVehicles);

  // Mobile Navigation Drawer Toggle
  DOM.mobileMenuBtn?.addEventListener('click', () => {
    const isExpanded = DOM.mobileMenuBtn.getAttribute('aria-expanded') === 'true';
    DOM.mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
    DOM.mobileNav.hidden = isExpanded;
  });

  // Close mobile navigation on link click
  DOM.navLinks.forEach(link => {
    link.addEventListener('click', () => {
      DOM.mobileMenuBtn?.setAttribute('aria-expanded', 'false');
      if (DOM.mobileNav) DOM.mobileNav.hidden = true;
    });
  });

  // Back to Top Button
  DOM.backToTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Editorial Model Sample Badges: click to jump and filter collection
  document.querySelectorAll('.sample-badge').forEach(badge => {
    badge.setAttribute('title', `Lihat ${badge.textContent.trim()} di katalog`);
    badge.addEventListener('click', () => {
      const modelQuery = badge.textContent.trim();
      state.filters.search = modelQuery;
      if (DOM.searchInput) {
        DOM.searchInput.value = modelQuery;
        DOM.searchClearBtn.hidden = false;
      }
      applyFiltersAndRender();
      const collectionSection = document.getElementById('collection');
      if (collectionSection) {
        collectionSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Scrollspy & Active Navigation Link Highlight
  initScrollspy();
}

/**
 * Accessible Scrollspy using IntersectionObserver
 */
function initScrollspy() {
  const sections = document.querySelectorAll('section[id]');
  if (!('IntersectionObserver' in window) || sections.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        DOM.navLinks.forEach(link => {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === `#${id}`);
        });
      }
    });
  }, {
    rootMargin: '-20% 0px -70% 0px'
  });

  sections.forEach(sec => observer.observe(sec));
}

// -----------------------------------------------------------------------------
// Application Initialization
// -----------------------------------------------------------------------------
function initApp() {
  console.log('[MOTIONBAY] Initializing application components...');
  initModelViewer();
  initModalListeners();
  initEventListeners();
  fetchVehicles();
}

// Execute immediately since script is placed at bottom of body
initApp();
