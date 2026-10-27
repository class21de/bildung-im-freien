/* /js/product-page.js (Finale, stabile Version mit Unterstützung für mehrere Maßbilder) */

document.addEventListener('DOMContentLoaded', function() {

  // Lädt die produktspezifische Konfigurations-JSON-Datei
  async function loadProductConfig() {
    const pathParts = location.pathname.split('/');
    const productSlug = pathParts[pathParts.indexOf('produkte') + 1];
    try {
      const response = await fetch(`/produkte/${productSlug}/config.json`);
      if (!response.ok) {
        console.error(`Fehler beim Laden der Konfiguration für ${productSlug}: ${response.statusText}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Netzwerkfehler beim Laden der Konfiguration für ${productSlug}:`, error);
      return null;
    }
  }

  // Initialisiert die Event-Listener für alle interaktiven Elemente
  function setupEventListeners() {
    setupAccordion();
    setupImageModal();
    setupCustomTooltip();
  }

  // Füllt die Kopfzeile mit Produktname und Tagline
  function populateHeader(config) {
    // document.querySelector('.product-name').textContent = config.productName;
    // document.querySelector('.tagline').textContent = config.tagline;
  }

  // Fügt die Produktbeschreibung ein
  function populateDescription(config) {
    const details = document.querySelector('.product-details');
    if (details && config.description) {
      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'product-description';
      descriptionDiv.innerHTML = config.description.join('');
      details.insertBefore(descriptionDiv, details.querySelector('.accordion-container'));
    }
  }

  // Erstellt alle Akkordeon-Elemente
  function populateAccordions(config) {
    const accordionContainer = document.querySelector('.accordion-container');
    if (!accordionContainer) return;

    accordionContainer.innerHTML = ''; // Container leeren

    // *** START DER ÄNDERUNG: Logik für Maß-Akkordeon ***
    if (config.measurements) {
        let contentHTML = '';

        // Fall 1: Verarbeitet mehrere Bilder aus einem Array (neue Struktur)
        if (config.measurements.type === 'images' && Array.isArray(config.measurements.images) && config.measurements.images.length > 0) {
            // Wir verwenden die bestehende .variants-grid Klasse für ein responsives Layout
            let imagesGridHTML = '<div class="variants-grid">';
            config.measurements.images.forEach((imageSrc, index) => {
                imagesGridHTML += `
                    <div class="variant-card">
                        <img src="${imageSrc}" alt="Maßskizze ${index + 1}" style="max-width: 100%; height: auto; display: block;">
                    </div>`;
            });
            imagesGridHTML += '</div>';
            contentHTML = `<div class="content-wrapper">${imagesGridHTML}</div>`;
        }
        // Fall 2: Verarbeitet ein einzelnes Bild (alte Struktur, für Abwärtskompatibilität)
        else if (config.measurements.type === 'image' && config.measurements.image) {
            const imageCardHTML = `<div class="variant-card"><img src="${config.measurements.image}" alt="Maßskizze" style="max-width: 100%; height: auto; display: block;"></div>`;
            contentHTML = `<div class="content-wrapper">${imageCardHTML}</div>`;
        }

        // Fügt das Akkordeon-Element nur hinzu, wenn Inhalt dafür erstellt wurde
        if (contentHTML) {
            const item = document.createElement('div');
            item.className = 'accordion-item';
            item.innerHTML = `<button class="accordion-header"><span>Varianten & Maße</span><i class="fas fa-plus"></i></button><div class="accordion-content">${contentHTML}</div>`;
            accordionContainer.appendChild(item);
        }
    }
    // *** ENDE DER ÄNDERUNG ***

    // START: Add "Formationen" accordion if video sources are defined in config
    if (config.formations && Array.isArray(config.formations.videoSources) && config.formations.videoSources.length > 0) {
        let videoSourcesHTML = '';
        config.formations.videoSources.forEach(source => {
            videoSourcesHTML += `<source src="${source.src}" type="${source.type}">`;
        });

        const formationenContent = `
            <div class="content-wrapper">
                <video style="width: 100%; height: auto;" controls autoplay loop muted playsinline>
                    ${videoSourcesHTML}
                    Ihr Browser unterstützt das Video-Tag nicht.
                </video>
            </div>
        `;

        const formationenItem = document.createElement('div');
        formationenItem.className = 'accordion-item';
        formationenItem.innerHTML = `<button class="accordion-header"><span>Formationen</span><i class="fas fa-plus"></i></button><div class="accordion-content">${formationenContent}</div>`;
        accordionContainer.appendChild(formationenItem);
    }
    // END: Add "Formationen" accordion
  }

  // Erstellt die Bildergalerie
  function populateGallery(config) {
    const galleryContainer = document.getElementById('image-collage-container');
    if (galleryContainer && config.galleryImages) {
      galleryContainer.innerHTML = '';
      config.galleryImages.forEach((src, index) => {
        galleryContainer.innerHTML += `<div class="collage-image-wrapper"><img src="${src}" alt="${config.productName} Ansicht ${index + 1}"></div>`;
      });
    }
  }

  // Erstellt die Farbauswahl (Swatches)
  function populateSwatches(config) {
    // Populate Frame Swatches
    if (config.colorOptions && config.colorOptions.frame) {
      const swatchContainer = document.getElementById('frame-swatches');
      if (swatchContainer) {
        swatchContainer.innerHTML = '';
        config.colorOptions.frame.forEach((option, index) => {
          const swatchOption = document.createElement('div');
          swatchOption.className = 'swatch-option';
          if (index === 0) swatchOption.classList.add('active');
          swatchOption.dataset.part = 'frame';
          swatchOption.dataset.material = option.name;
          swatchOption.dataset.colorName = option.name;
          swatchOption.dataset.colorValue = option.color;
          swatchOption.innerHTML = `<div class="swatch" style="background-image: url('${option.color}'); background-size: cover;"></div>`;
          swatchContainer.appendChild(swatchOption);
        });
      }
    }

    // START: Populate Seat Swatches
    if (config.colorOptions && config.colorOptions.seat) {
      const swatchContainer = document.getElementById('seat-swatches');
      if (swatchContainer) {
        swatchContainer.innerHTML = '';
        config.colorOptions.seat.forEach((option, index) => {
          const swatchOption = document.createElement('div');
          swatchOption.className = 'swatch-option';
          if (index === 0) swatchOption.classList.add('active');
          swatchOption.dataset.part = 'seat';
          swatchOption.dataset.material = option.name;
          swatchOption.dataset.colorName = option.name;
          swatchOption.dataset.colorValue = option.color;
          swatchOption.innerHTML = `<div class="swatch" style="background-image: url('${option.color}'); background-size: cover;"></div>`;
          swatchContainer.appendChild(swatchOption);
        });
      }
    }
    // END: Populate Seat Swatches
  }


  // --- EVENT-LISTENER SETUP FUNKTIONEN ---

  function setupAccordion() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.parentElement;
        item.classList.toggle('active');
        const icon = header.querySelector('i');
        icon.className = item.classList.contains('active') ? 'fas fa-times' : 'fas fa-plus';
      });
    });
  }

  function setupImageModal() {
    const modal = document.getElementById("image-modal");
    if (!modal) return;
    const modalImg = document.getElementById("modal-image");
    const closeBtn = modal.querySelector(".modal-close");
    document.getElementById('image-collage-container')?.addEventListener('click', function(event) {
        const image = event.target.closest('img');
        if (image) {
            modal.style.display = "block";
            modalImg.src = image.src;
        }
    });
    const closeModal = () => { modal.style.display = "none"; };
    closeBtn.onclick = closeModal;
    modal.onclick = (event) => { if (event.target === modal) closeModal(); };
  }

  function setupCustomTooltip() {
    const tooltip = document.querySelector('.custom-tooltip');
    if (!tooltip) return;
    const tooltipName = tooltip.querySelector('.tooltip-name');
    const tooltipSwatch = tooltip.querySelector('.tooltip-swatch');
    document.querySelectorAll('.swatch-container').forEach(container => {
        container.addEventListener('mouseover', (e) => {
            const swatchOption = e.target.closest('.swatch-option');
            if (!swatchOption) return;
            tooltipName.textContent = swatchOption.dataset.colorName;
            tooltipSwatch.style.backgroundImage = `url('${swatchOption.dataset.colorValue}')`;
            tooltipSwatch.style.backgroundSize = 'cover';
            const rect = swatchOption.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
            tooltip.style.display = 'flex';
            tooltip.style.opacity = '1';
        });
        container.addEventListener('mouseout', () => {
            tooltip.style.opacity = '0';
        });
    });
  }

  // --- HAUPT-INITIALISIERUNG ---

  async function init() {
    const config = await loadProductConfig();
    if (!config) {
      console.error("Seitenaufbau wird wegen fehlender Konfiguration abgebrochen.");
      document.body.innerHTML = "<h2>Fehler: Produktinformationen konnten nicht geladen werden.</h2>";
      return;
    }

    // Ruft alle Funktionen zum Aufbau der Seite der Reihe nach auf
    populateHeader(config);
    populateDescription(config);
    populateAccordions(config);
    populateGallery(config);
    populateSwatches(config);

    // Initialisiert alle Event-Listener, nachdem das DOM aufgebaut wurde
    setupEventListeners();
  }

  // Startet den gesamten Prozess
  init();
});
