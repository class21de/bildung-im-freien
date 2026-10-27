/* /js/menu.js */
// Merkliste is available on every page that uses the shared menu.
(function loadWishlist() {
  if (document.querySelector('script[data-merkliste-script]')) return;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = '/css/merkliste.css';
  document.head.appendChild(stylesheet);

  const script = document.createElement('script');
  script.src = '/js/merkliste.js';
  script.defer = true;
  script.dataset.merklisteScript = 'true';
  document.head.appendChild(script);
})();

// Auto-update copyright year independently
(function () {
  const updateYear = () => {
    const copyright = document.querySelector('.copyright');
    if (copyright) {
      copyright.innerHTML = copyright.innerHTML.replace(/\d{4}/, new Date().getFullYear());
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateYear);
  } else {
    updateYear(); // Runs immediately if DOM is already parsed
  }
})();


document.addEventListener('DOMContentLoaded', async function() {

  // Keep the wording consistent in the header and footer without maintaining
  // dozens of duplicated navigation blocks by hand.
  document.querySelectorAll('.nav-item--imprint a, .footer-links a').forEach(link => {
    if (/^Impressum\s*&(?:amp;)?\s*Datenschutz$/i.test(link.textContent.trim())) link.textContent = 'Impressum';
  });

  // Inserted here instead of duplicated in every page header.
  const pdfMenu = document.querySelector('.nav-item--has-pdf-dropdown');
  if (pdfMenu && !document.querySelector('.nav-item--wishlist')) {
    const wishlistItem = document.createElement('li');
    wishlistItem.className = 'nav-item nav-item--button nav-item--wishlist';
    wishlistItem.innerHTML = '<a href="/merkliste.html" class="nav-link-button"><i class="fa-solid fa-star"></i> Merkliste <span class="wishlist-count" aria-label="Produkte in der Merkliste">0</span></a>';
    pdfMenu.before(wishlistItem);
    try {
      const savedItems = JSON.parse(localStorage.getItem('bildung-im-freien-merkliste')) || [];
      const count = wishlistItem.querySelector('.wishlist-count');
      count.textContent = savedItems.length;
      count.hidden = savedItems.length === 0;
    } catch (_) { /* Merkliste remains available if storage is unavailable. */ }
  }

  // 1. Fetch BOTH JSON files
  const productsAdults = await fetch('/js/products.json').then(res => res.json());

  // Try to fetch the kindergarten products, fallback to empty array if file doesn't exist yet
  let productsKids = [];
  try {
    productsKids = await fetch('/js/products-kindergarten.json').then(res => res.json());
  } catch (e) {
    console.warn('products-kindergarten.json not found yet.');
  }

  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('main-nav');
  const body = document.body;
  const mobileAdultsProductsTrigger = document.getElementById('adults-products-trigger');
  const mobileKidsProductsTrigger = document.getElementById('kids-products-trigger');
  const productDropdownContainer = document.getElementById('product-dropdown-container');
  let mobileSubMenu;

  const indoorContent = {
    intro: `Ergänzend zu unseren Outdoor-Produkten bieten wir durchdachte Einrichtungskonzepte für den <strong>Indoor-Bereich</strong> von Bildungshäusern.`,
    audience: 'Unser Angebot richtet sich an Schulleitungen, Lehrende, Schulträger, Architekten und alle, die sich mit der Einrichtung von Bildungshäusern beschäftigen.',
    prompt: 'Bei Interesse gehen Sie bitte hier auf unserer Internetpräsenz:',
    url: 'https://bildung-einrichten.de/'
  };

  // The shared header is used across every page. Add Indoor here so the
  // mobile navigation stays consistent without duplicating markup per page.
  function ensureMobileIndoorTrigger() {
    const submenuList = document.querySelector('.mobile-submenu-list');
    if (!submenuList) return null;

    let trigger = document.getElementById('indoor-products-trigger');
    if (trigger) return trigger;

    const item = document.createElement('li');
    item.innerHTML = '<a href="#" class="mobile-submenu-category button-74" id="indoor-products-trigger" data-category="indoor"><i class="fa fa-long-arrow-right"></i> Indoor</a>';
    submenuList.appendChild(item);
    return item.querySelector('#indoor-products-trigger');
  }

  const mobileIndoorProductsTrigger = ensureMobileIndoorTrigger();

  // --- Helper Function to Create Product Card ---
  function createProductCard(product) {
    const productUrl = `/produkte/${product.slug}/`;
    const productLink = document.createElement('a');
    productLink.href = productUrl;
    productLink.classList.add('dropdown-link');

    const productItem = document.createElement('div');
    productItem.classList.add('dropdown-link-item');

    const img = document.createElement('img');
    img.src = product.image;
    img.alt = product.name;

    const p = document.createElement('p');
    const span = document.createElement('span');
    span.textContent = product.name;

    p.appendChild(span);
    productItem.appendChild(img);
    productItem.appendChild(p);
    productLink.appendChild(productItem);

    // Add Hover Underline Logic
    productLink.addEventListener('mouseenter', () => {
      const rects = span.getClientRects();
      let maxWidth = 0;
      if (rects.length > 0) { for (const rect of rects) { if (rect.width > maxWidth) maxWidth = rect.width; } }
      if (maxWidth > 0) span.style.setProperty('--underline-width', `${maxWidth}px`);
    });

    return productLink;
  }

  function showDesktopCategory(activeLink, activeGrid, categoryLinks, grids) {
    categoryLinks.forEach(link => link.classList.toggle('is-active', link === activeLink));
    grids.forEach(grid => grid.classList.toggle('is-visible', grid === activeGrid));
  }

  function createIndoorPanel() {
    const panel = document.createElement('section');
    panel.className = 'dropdown-indoor-panel dropdown-product-grid';
    panel.id = 'grid-indoor';
    panel.setAttribute('aria-label', 'Indoor');
    panel.innerHTML = `
      <div class="dropdown-indoor-copy">
        <p>${indoorContent.intro}</p>
        <p>${indoorContent.audience}</p>
        <p>${indoorContent.prompt}</p>
        <a href="${indoorContent.url}" target="_blank" rel="noopener noreferrer">${indoorContent.url}</a>
      </div>
      <img class="dropdown-indoor-image indoor-image-1" src="/bilder-indoor/indoor-1.jpg" alt="Indoor-Einrichtung mit grüner Sitzlandschaft">
      <img class="dropdown-indoor-image indoor-image-2" src="/bilder-indoor/indoor-2.jpg" alt="Runder Tisch mit gelben Sitzbänken im Innenbereich">
      <img class="dropdown-indoor-image indoor-image-3" src="/bilder-indoor/indoor-4.jpg" alt="Tischgruppe im Innenbereich">
      <img class="dropdown-indoor-image indoor-image-4" src="/bilder-indoor/indoor-3.jpg" alt="Stufenmöbel im Innenbereich">
    `;
    return panel;
  }


  function populateDesktopDropdown() {
      if (!productDropdownContainer) return;

      productDropdownContainer.innerHTML = '';

      const sidebar = document.createElement('div');
      sidebar.className = 'dropdown-sidebar';

      const contentArea = document.createElement('div');
      contentArea.className = 'dropdown-content-area';

      const linkAdults = document.createElement('a');
      linkAdults.href = '#';
      linkAdults.className = 'dropdown-category-link is-active';
      linkAdults.textContent = 'Für Schulkinder & Erwachsene';

      const linkKids = document.createElement('a');
      linkKids.href = '#';
      linkKids.className = 'dropdown-category-link';
      linkKids.textContent = 'Für Kindergärten';

      const linkIndoor = document.createElement('a');
      linkIndoor.href = '#';
      linkIndoor.className = 'dropdown-category-link';
      linkIndoor.textContent = 'Indoor';

      sidebar.appendChild(linkAdults);
      sidebar.appendChild(linkKids);
      sidebar.appendChild(linkIndoor);

      const gridAdults = document.createElement('div');
      gridAdults.className = 'dropdown-product-grid is-visible';
      gridAdults.id = 'grid-adults';

      const gridKids = document.createElement('div');
      gridKids.className = 'dropdown-product-grid';
      gridKids.id = 'grid-kids';

      const gridIndoor = createIndoorPanel();

      productsAdults.forEach(p => gridAdults.appendChild(createProductCard(p)));
      productsKids.forEach(p => gridKids.appendChild(createProductCard(p)));

      contentArea.appendChild(gridAdults);
      contentArea.appendChild(gridKids);
      contentArea.appendChild(gridIndoor);

      productDropdownContainer.appendChild(sidebar);
      productDropdownContainer.appendChild(contentArea);

      const categoryLinks = [linkAdults, linkKids, linkIndoor];
      const grids = [gridAdults, gridKids, gridIndoor];
      linkAdults.addEventListener('mouseenter', () => showDesktopCategory(linkAdults, gridAdults, categoryLinks, grids));
      linkKids.addEventListener('mouseenter', () => showDesktopCategory(linkKids, gridKids, categoryLinks, grids));
      linkIndoor.addEventListener('mouseenter', () => showDesktopCategory(linkIndoor, gridIndoor, categoryLinks, grids));

      categoryLinks.forEach(link => link.addEventListener('click', event => event.preventDefault()));

      const productsTrigger = document.getElementById('mobile-products-trigger');

      // Open on hover
      productsTrigger.addEventListener('mouseenter', () => {
          if (window.innerWidth > 1240) {
              productDropdownContainer.classList.add('is-open');
          }
      });

      productDropdownContainer.addEventListener('mouseenter', () => {
          if (window.innerWidth > 1240) {
              productDropdownContainer.classList.add('is-open');
          }
      });

      // Close on click on Produkte button
      productsTrigger.addEventListener('click', (e) => {
          if (window.innerWidth > 1240) {
              e.preventDefault();
              productDropdownContainer.classList.remove('is-open');
          }
      });

      // Close when clicking outside
      document.addEventListener('click', (e) => {
          if (window.innerWidth > 1240) {
              const isClickInside = productDropdownContainer.contains(e.target) || productsTrigger.contains(e.target);
              if (!isClickInside) {
                  productDropdownContainer.classList.remove('is-open');
              }
          }
      });
  }

  populateDesktopDropdown();


  // --- Mobile Menu  ---
  function createMobileSubmenu(typeOfProducts) {
  const submenuContainer = document.getElementById('mobile-submenu-container');
  if (!submenuContainer) return;

  // Reuse existing submenu instead of creating a new one every time
  let submenu = submenuContainer.querySelector('.mobile-product-submenu');
  let grid;

  // Only create a new submenu on the very first run
  if (!submenu) {
      submenu = document.createElement('div');
      submenu.className = 'mobile-product-submenu';

      const closeBtn = document.createElement('div');
      closeBtn.className = 'submenu-close-btn';
      closeBtn.innerHTML = '<i class="fas fa-times"></i>';
      closeBtn.addEventListener('click', () => {
          submenu.classList.remove('is-active');
      });

      grid = document.createElement('div');
      grid.className = 'mobile-product-grid';

      submenu.appendChild(grid);
      submenu.appendChild(closeBtn);
      submenuContainer.appendChild(submenu);
      mobileSubMenu = submenu;
  } else {
      // Clear old products before loading new ones
      grid = submenu.querySelector('.mobile-product-grid');
      grid.innerHTML = '';
  }

  // Indoor has an introduction followed by the complete, uncropped gallery.
  if (typeOfProducts === 'indoor') {
    grid.className = 'mobile-product-grid mobile-indoor-panel';
    grid.innerHTML = `
      <div class="mobile-indoor-copy">
        <p>${indoorContent.intro}</p>
        <p>${indoorContent.audience}</p>
        <p>${indoorContent.prompt}</p>
        <a href="${indoorContent.url}" target="_blank" rel="noopener noreferrer">${indoorContent.url}</a>
      </div>
      <div class="mobile-indoor-gallery">
        <img src="/bilder-indoor/indoor-1.jpg" alt="Indoor-Einrichtung mit grüner Sitzlandschaft">
        <img src="/bilder-indoor/indoor-2.jpg" alt="Runder Tisch mit gelben Sitzbänken im Innenbereich">
        <img src="/bilder-indoor/indoor-4.jpg" alt="Tischgruppe im Innenbereich">
        <img src="/bilder-indoor/indoor-3.jpg" alt="Stufenmöbel im Innenbereich">
      </div>
    `;
    submenu.classList.add('is-active');
    return;
  }

  grid.className = 'mobile-product-grid';

  // Product filtering logic
  const allProducts = typeOfProducts === 'kids' ? productsKids : productsAdults;

  allProducts.forEach(product => {
    const productUrl = `/produkte/${product.slug}/`;
    const itemLink = document.createElement('a');
    itemLink.href = productUrl;
    itemLink.className = 'mobile-product-item';
    const img = document.createElement('img');
    img.src = product.image; img.alt = product.name;
    const p = document.createElement('p');
    p.textContent = product.name;
    itemLink.appendChild(img);
    itemLink.appendChild(p);
    grid.appendChild(itemLink);
  });

  // Ensure the submenu is visible after updating products
  submenu.classList.add('is-active');
}




  if (hamburger && mainNav) {
    hamburger.addEventListener('click', () => {
      const isMenuActive = mainNav.classList.toggle('is-active');
      body.style.overflow = isMenuActive ? 'hidden' : 'auto';
      hamburger.innerHTML = isMenuActive ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
      if (!isMenuActive && mobileSubMenu && mobileSubMenu.classList.contains('is-active')) {
       mobileSubMenu.classList.remove('is-active');
      }
    });
  }

  // Adults Trigger
if (mobileAdultsProductsTrigger) {
  mobileAdultsProductsTrigger.addEventListener('click', (e) => {
    if (window.innerWidth <= 1240) {
      e.preventDefault();
      createMobileSubmenu("adults"); //
      setTimeout(() => {
        if (mobileSubMenu) mobileSubMenu.classList.add('is-active');
      }, 0);
    }
  });
}

//  Kids Trigger
if (mobileKidsProductsTrigger) {
  mobileKidsProductsTrigger.addEventListener('click', (e) => {
    if (window.innerWidth <= 1240) {
      e.preventDefault();
      createMobileSubmenu("kids"); //
      setTimeout(() => {
        if (mobileSubMenu) mobileSubMenu.classList.add('is-active');
      }, 0);
    }
  });
}

// Indoor Trigger
if (mobileIndoorProductsTrigger) {
  mobileIndoorProductsTrigger.addEventListener('click', (e) => {
    if (window.innerWidth <= 1240) {
      e.preventDefault();
      createMobileSubmenu('indoor');
    }
  });
}

});
