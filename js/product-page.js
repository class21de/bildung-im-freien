document.addEventListener('DOMContentLoaded', async function() {
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

  // Initialisiert die Tooltips für Farbfelder
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
        if (swatchOption.dataset.material === 'Feuerverzinkt') {
          tooltipSwatch.style.backgroundImage = `url('/materialien/feuerverzinkt.jpg')`;
          tooltipSwatch.style.backgroundSize = 'cover';
        } else if (swatchOption.dataset.part === 'fabric') {
          tooltipSwatch.style.backgroundImage = `url('${swatchOption.dataset.previewUrl}')`;
          tooltipSwatch.style.backgroundSize = 'cover';
        } else {
          tooltipSwatch.style.backgroundColor = swatchOption.dataset.colorValue;
          tooltipSwatch.style.backgroundImage = '';
        }
        const rect = swatchOption.getBoundingClientRect();
        tooltip.style.display = 'flex';
        tooltip.style.opacity = '1';
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
      });
      container.addEventListener('mouseout', (e) => { tooltip.style.opacity = '0'; });
    });
  }

  // Initialisiert die Akkordeon-Funktionalität (Öffnen/Schließen)
  function setupAccordion() {
    document.querySelectorAll('.accordion-item').forEach(item => {
      const header = item.querySelector('.accordion-header');
      if (header) {
        header.addEventListener('click', (e) => {
          e.preventDefault();
          const isActive = item.classList.toggle('active');
          header.querySelector('i').className = isActive ? 'fas fa-times' : 'fas fa-plus';
        });
      }
    });
  }

// For Stretchable

function setupCustomAccordion() {
  // Define all accordion IDs that should get the special full-width treatment on desktop
  const fullWidthAccordionIds = ['configurations-accordion', 'wood-info-accordion', 'accessories-accordion', 'measurements-accordion'];
  const accordionItems = document.querySelectorAll('.accordion-item');

  // Store the original home location for each full-width accordion's content
  const originalLocations = new Map();
  fullWidthAccordionIds.forEach(id => {
    const item = document.getElementById(id);
    if (item) {
      const content = item.querySelector('.accordion-content');
      // Store a reference to the content panel and its original parent
      originalLocations.set(id, { parent: content.parentNode, content: content });
    }
  });

  accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', (e) => {
        e.preventDefault();

        const isFullWidthItem = fullWidthAccordionIds.includes(item.id);
        const isDesktop = window.innerWidth > 1200;
        const accordionContainer = item.parentNode;

        // --- Close ALL other accordion items first ---
        accordionItems.forEach(otherItem => {
          if (otherItem !== item && otherItem.classList.contains('active')) {
            otherItem.classList.remove('active');
            const otherHeaderIcon = otherItem.querySelector('.accordion-header i');
            if (otherHeaderIcon) {
              otherHeaderIcon.className = 'fas fa-plus';
            }

            // Restore content for other full-width items if needed
            if (fullWidthAccordionIds.includes(otherItem.id) && isDesktop) {
              const originalLocation = originalLocations.get(otherItem.id);
              if (originalLocation) {
                originalLocation.parent.appendChild(originalLocation.content);
                originalLocation.content.classList.remove('is-external');
              }
            }
          }
        });

        // --- Toggle the clicked item ---
        const isActive = item.classList.toggle('active');
        header.querySelector('i').className = isActive ? 'fas fa-times' : 'fas fa-plus';

        if (isFullWidthItem && isDesktop) {
          const topRowGrid = document.querySelector('.top-row-grid');
          const originalLocation = originalLocations.get(item.id);

          if (isActive) {
            // WHEN OPENING: Move the content panel after the grid
            topRowGrid.after(originalLocation.content);
            originalLocation.content.classList.add('is-external');

            // Move the item itself to the end
            accordionContainer.appendChild(item);

            // --- Scroll into view ---
            originalLocation.content.scrollIntoView({ behavior: 'smooth', block: 'center' });

          } else {
            // WHEN CLOSING: Restore content to its original location
            originalLocation.parent.appendChild(originalLocation.content);
            originalLocation.content.classList.remove('is-external');
          }
        } else {
          if (isActive) {
            // Move active item to the end
            accordionContainer.appendChild(item);
          }
        }
      });
    }
  });
}


  // Initialisiert die Bild-Großansicht (Modal)
  function setupImageModal() {
    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-image");
    const closeBtn = document.querySelector(".modal-close");
    if (!modal || !modalImg || !closeBtn) return;

    const galleryContainer = document.getElementById('image-collage-container');
    if (galleryContainer) {
      galleryContainer.addEventListener('click', function(event) {
        const imageWrapper = event.target.closest('.collage-image-wrapper');
        if (imageWrapper) {
          const image = imageWrapper.querySelector('img');
          if (image) {
            modal.style.display = "block";
            modalImg.src = image.src;
            document.body.style.overflow = 'hidden';
          }
        }
      });
    }

    const closeModal = function() {
      modal.style.display = "none";
      document.body.style.overflow = 'auto';
    }
    closeBtn.onclick = closeModal;
    modal.onclick = (event) => { if (event.target === modal) closeModal(); }
  }

  // Hauptfunktion zum Aufbau der Seite
  async function buildPage() {
    const config = await loadProductConfig();
    if (!config) return;

    // document.querySelector('.product-name').textContent = config.productName;
    // document.querySelector('.tagline').textContent = config.tagline;

    const details = document.querySelector('.product-details');
    if (details && config.description) {
      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'product-description';
      descriptionDiv.innerHTML = config.description.join('');
      details.insertBefore(descriptionDiv, details.querySelector('.accordion-container'));
    }

    const accordionContainer = document.querySelector('.accordion-container');
    if (accordionContainer) {
      accordionContainer.innerHTML = '';

      if (config.measurements) {
        let contentHTML = '';
        let headerText = 'Varianten & Maße'; // Default header text

        // Fall 1: Verarbeitet mehrere Bilder aus einem Array (neue Struktur)
        if (config.measurements.type === 'images' && Array.isArray(config.measurements.images) && config.measurements.images.length > 0) {
            if (config.measurements.images.length === 1) {
                headerText = 'Maße'; // Change header for single image
            }
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
            headerText = 'Maße'; // Change header for single image
            const imageCardHTML = `<div class="variant-card"><img src="${config.measurements.image}" alt="Maßskizze" style="max-width: 100%; height: auto; display: block;"></div>`;
            contentHTML = `<div class="content-wrapper">${imageCardHTML}</div>`;
        }
        else if (config.measurements.type === 'table' && config.measurements.variants && config.measurements.sketch == true) {
          if (config.measurements.variants.length === 1) {
            headerText = 'Maße'; // Change header for single table variant
          }
          let grid = '<div class="variants-grid">';
          config.measurements.variants.forEach(v => {
            grid += `<div class="variant-card"><h3>${v.name}</h3><div class="variant-sketch"><img src="${v.sketch}" alt="Skizze ${v.name}"></div><table><tbody><tr><th>Maße</th><th>L/Ø</th><th>B</th><th>H</th><th>SH</th></tr>${Object.entries(v.measurements).map(([k, vals]) => `<tr><td>${k}</td><td>${vals['L/Ø']}</td><td>${vals.B}</td><td>${vals.H}</td><td>${vals.SH}</td></tr>`).join('')}<tr><td colspan="5">Gewicht: ${v.weight}</td></tr></tbody></table></div>`;
          });
          grid += '</div>';
          contentHTML = `<div class="content-wrapper">${grid}</div>`;
        }

        else if (config.measurements.type === 'table' && config.measurements.variants && config.measurements.sketch == false) {
          if (config.measurements.variants.length === 1) {
            headerText = 'Maße'; // Change header for single table variant
          }
          let grid = '<div class="variants-grid">';
          config.measurements.variants.forEach(v => {
            grid += `<div class="variant-card"><h3>${v.name}</h3><table><tbody><tr><th>Maße</th><th>L/Ø</th><th>B</th><th>H</th><th>SH</th></tr>${Object.entries(v.measurements).map(([k, vals]) => `<tr><td>${k}</td><td>${vals['L/Ø']}</td><td>${vals.B}</td><td>${vals.H}</td><td>${vals.SH}</td></tr>`).join('')}<tr><td colspan="5">Gewicht: ${v.weight}</td></tr></tbody></table></div>`;
          });
          grid += '</div>';
          contentHTML = `<div class="content-wrapper">${grid}</div>`;
        }

        if (contentHTML) {
          const item = document.createElement('div');
          item.className = 'accordion-item';

          // check if "Varianten & Maße" should be stretchable
         if (config.stretchable && config.stretchable.measurements === true) {
           item.id = 'measurements-accordion';
         }
          // Use the dynamic headerText here
          item.innerHTML = `<button class="accordion-header"><span>${headerText}</span><i class="fas fa-plus"></i></button><div class="accordion-content">${contentHTML}</div>`;
          accordionContainer.appendChild(item);
        }
      }

      if (config.colorInfo && Array.isArray(config.colorInfo)) {
        let colorsHTML = '';
        config.colorInfo.forEach(group => {
            colorsHTML += `<div class="colorsContainer"><h4 class="colorTitle">${group.title}</h4>`;
            group.colors.forEach(color => {
                const colorName = color.name.replace(' ', '&nbsp;');
                colorsHTML += `<div class="colorBlock" style="background-color: ${color.hex};">${colorName}</div>`;
            });
            colorsHTML += `</div>`;
        });

        const item = document.createElement('div');
        item.className = 'accordion-item';
        item.innerHTML = `<button class="accordion-header"><span>Farben</span><i class="fas fa-plus"></i></button><div class="accordion-content"><div class="content-wrapper">${colorsHTML}</div></div>`;
        accordionContainer.appendChild(item);
      }

      // In product-page.js, inside the buildPage function...

        if (config.configurations && config.configurations.length > 0) {
          let grid = '<div class="variants-grid">';
          config.configurations.forEach(c => {
            grid += `<div class="variant-card"><h3>${c.name}</h3><p style="text-align:center;font-size:0.9rem;margin: 0.5rem 0 1rem;">${c.size}</p><div class="variant-sketch"><img src="${c.svg}" alt="${c.name}" style="max-height:150px;"></div></div>`;
          });
          grid += '</div>';
          const item = document.createElement('div');
          item.className = 'accordion-item';

          // checks if Konfigurationsbeispiele should be stretchable
          if(config.stretchable.configurations == true){
            item.id = 'configurations-accordion';
          }

          item.innerHTML = `<button class="accordion-header"><span>Konfigurationsbeispiele</span><i class="fas fa-plus"></i></button><div class="accordion-content"><div class="content-wrapper">${grid}</div></div>`;
          accordionContainer.appendChild(item);
        }


        // In the buildPage function...

        if (config.accessories && config.accessories.length > 0) {
            let list = '<div class="accessories-list">';
            config.accessories.forEach(a => {
                if(a.style){
                  list += `<div class="accessory-item"><img src="${a.image}" alt="${a.name}" ${a.style}><div><h3>${a.name}</h3><p>${a.description}</p></div></div>`;
                }
                else{
                  list += `<div class="accessory-item"><img src="${a.image}" alt="${a.name}"><div><h3>${a.name}</h3><p>${a.description}</p></div></div>`;

                }
            });
            list += '</div>';
            const item = document.createElement('div');
            item.className = 'accordion-item';

            // checks if Zubehör & merkmale should be stretchable
            if(config.stretchable.accessories == true){
              item.id = 'accessories-accordion';
            }

            item.innerHTML = `<button class="accordion-header"><span>Zubehör & Merkmale</span><i class="fas fa-plus"></i></button><div class="accordion-content"><div class="content-wrapper">${list}</div></div>`;
            accordionContainer.appendChild(item);
        }


        if (config.woodInfo && config.woodInfo.length > 0) {
            let list = '<div class="wood-info-container">';
            config.woodInfo.forEach(a => {
                list += `<div class="wood-info-item"><h3>${a.name}</h3><img src="${a.image}" alt="${a.name}"><p>${a.description}</p></div>`;
            });
            list += '</div>';
            const item = document.createElement('div');

            // checks if Holz should be stretchable
            if(config.stretchable.wood == true){
              item.id = 'wood-info-accordion';
            }

            item.className = 'accordion-item';
            item.innerHTML = `<button class="accordion-header"><span>Holz</span><i class="fas fa-plus"></i></button><div class="accordion-content"><div class="content-wrapper">${list}</div></div>`;
            accordionContainer.appendChild(item);
        }

    }

    const galleryContainer = document.getElementById('image-collage-container');
    if (galleryContainer && config.galleryImages) {
      galleryContainer.innerHTML = '';
      config.galleryImages.forEach((src, index) => {
        galleryContainer.innerHTML += `<div class="collage-image-wrapper"><img src="${src}" alt="${config.productName} Ansicht ${index + 1}"></div>`;
      });
    }

    if (config.colorOptions) {
      ['frame', 'seat', 'tabletop', 'fabric'].forEach(part => {
        const swatchContainer = document.getElementById(`${part}-swatches`);
        if (swatchContainer) {
          swatchContainer.innerHTML = '';
          if(config.colorOptions[part]) {
            config.colorOptions[part].forEach((option, index) => {
              const swatchOption = document.createElement('div');
              swatchOption.className = 'swatch-option';
              if (index === 0) swatchOption.classList.add('active');
              swatchOption.dataset.part = part;
              swatchOption.dataset.material = option.material;
              swatchOption.dataset.colorName = option.name;
              swatchOption.dataset.colorValue = option.color;
              if (part === 'fabric') {
                  swatchOption.dataset.previewUrl = option.preview;
                  swatchOption.innerHTML = `<div class="swatch" style="background-image: url('${option.preview}'); background-size: cover;"></div>`;
              } else if (option.material === 'Feuerverzinkt') {
                swatchOption.innerHTML = `<div class="swatch" style="background-image: url('${config.galvanizedTexture || ''}'); background-size: cover; background-color: #ccc;"></div>`;
              } else {
                swatchOption.innerHTML = `<div class="swatch" style="background-color: ${option.color};"></div>`;
              }
              swatchContainer.appendChild(swatchOption);
            });
          }
        }
      });
    }
if(config.stretchable.exists == true) {
  setupCustomAccordion();
}
else{
    setupAccordion();
}
    setupImageModal();
    setupCustomTooltip();
  }

  buildPage();
});
