(() => {
  'use strict';
  const STORAGE_KEY = 'bildung-im-freien-merkliste';
  const getItems = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (_) { return []; }
  };
  const saveItems = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  function updateCount() {
    const count = getItems().length;
    document.querySelectorAll('.wishlist-count').forEach(el => {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }
  document.addEventListener('wishlist:changed', updateCount);

  function showNotice(message) {
    let notice = document.querySelector('.wishlist-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'wishlist-notice';
      notice.setAttribute('role', 'status');
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add('is-visible');
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => notice.classList.remove('is-visible'), 3600);
  }

  function productSnapshot() {
    const name = document.querySelector('.product-name')?.textContent.trim() || document.title.replace(/\s*\|.*/, '').trim();
    const imageElement = document.querySelector('.product-image-collage img, .gallery-section img');
    // Product pages use relative image paths. Store an absolute path so it also
    // works when the image is rendered later from /merkliste.html.
    const image = imageElement ? new URL(imageElement.getAttribute('src'), document.baseURI).href : '';
    const options = [];
    const model = document.querySelector('#model-switcher .model-switcher-item.active .model-name')?.textContent.trim();
    if (model) options.push(model);
    document.querySelectorAll('.config-section').forEach(section => {
      const label = section.querySelector('.config-label')?.textContent.trim();
      const selected = section.querySelector('.swatch-option.active');
      const color = selected?.dataset.colorName || selected?.getAttribute('aria-label') || selected?.title;
      if (label && color) options.push(`${label.replace(/\s*\(.*/, '').replace(/flächen/g, 'fläche')}: ${color}`);
    });
    const url = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
    return { id: `${url}|${options.join('|')}`, name, image, url, options };
  }

  function addCurrentProduct() {
    const product = productSnapshot();
    const items = getItems();
    if (!items.some(item => item.id === product.id)) {
      items.push(product);
      saveItems(items);
      showNotice('Das Produkt wurde Ihrer Merkliste hinzugefügt.');
    } else {
      showNotice('Dieses Produkt ist bereits in Ihrer Merkliste.');
    }
    updateCount();
    document.dispatchEvent(new Event('wishlist:changed'));
  }

  function addProductButton() {
    if (!document.querySelector('#product-page') || document.querySelector('.wishlist-add-area')) return;
    const area = document.createElement('section');
    area.className = 'wishlist-add-area';
    area.innerHTML = '<button type="button" class="wishlist-add-button"><i class="fa-solid fa-star"></i> Merkliste oder auch Ihre (Preis-)Anfrage</button><p class="wishlist-config-hint" hidden>Ihre aktuelle Konfiguration wird mit der Anfrage gespeichert und übermittelt. Wenn Sie noch unsicher sind, schreiben Sie Ihren Wunsch einfach in die Anmerkungen.</p>';
    const target = document.querySelector('.bottom-row-grid') || document.querySelector('.product-description .pdf-link-list') || document.querySelector('.accordion-container');
    if (target?.classList.contains('pdf-link-list')) target.after(area);
    else if (target) target.after(area);
    else document.querySelector('#product-page .container')?.append(area);
    area.querySelector('button').addEventListener('click', () => {
      addCurrentProduct();
      if (document.querySelector('#configurator-container')) area.querySelector('.wishlist-config-hint').hidden = false;
    });
  }

  function itemCard(item, index) {
    const configuration = item.options?.length ? `<p class="wishlist-configuration"><strong>Konfiguration:</strong> ${escapeHtml(item.options.join(', '))}</p>` : '';
    const image = item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : '<div class="wishlist-image-placeholder"><i class="fa-solid fa-chair"></i></div>';
    const quantity = item.quantity === undefined ? '' : escapeHtml(item.quantity);
    return `<article class="wishlist-item"><div class="wishlist-product-image">${image}</div><div class="wishlist-product-info"><h2>${escapeHtml(item.name)}</h2>${configuration}<a href="${escapeHtml(item.url)}">Produkt ansehen</a></div><label style="margin-left:60px">Menge *<input class="wishlist-quantity" data-index="${index}" type="number" min="1" max="999" inputmode="numeric" value="${quantity}" required></label><button class="wishlist-remove" type="button" data-index="${index}" aria-label="${escapeHtml(item.name)} entfernen"><i class="fa-solid fa-xmark"></i></button></article>`;
  }

  function renderWishlist() {
    const root = document.querySelector('#wishlist-content');
    if (!root) return;
    const items = getItems();
    if (!items.length) {
      root.innerHTML = '<h1>Merkliste oder auch Ihre (Preis-)Anfrage</h1><p class="wishlist-empty">Ihre Merkliste ist leer.</p>';
      return;
    }
    root.innerHTML = `<h1>Merkliste oder auch Ihre (Preis-)Anfrage</h1><p class="wishlist-intro">Hinweis: Bitte geben Sie zu jedem Produkt die gewünschte Menge an.</p><div class="wishlist-items">${items.map(itemCard).join('')}</div><p class="wishlist-required-note">Felder mit * sind Pflichtfelder.</p><form id="wishlist-form" novalidate>
      <fieldset><legend>Wie möchten Sie angesprochen werden? *</legend><div class="salutation-options"><label><input type="radio" name="salutation" value="Frau"> Frau</label><label><input type="radio" name="salutation" value="Herr"> Herr</label><label style="max-width:300px;">Divers: <input type="text" name="salutation_other" aria-label="Andere Anrede"></label></div></fieldset>
      <div class="form-grid form-grid--names"><label style="max-width:80px">Titel<input type="text" name="title"></label><label style="max-width:255px">Vorname *<input type="text" name="first_name" required></label><label style="max-width:255px">Nachname *<input type="text" name="last_name" required></label></div>
      <label>Bildungseinrichtung oder Firmenname *<input type="text" name="company" required></label>
      <label style="max-width:400px">Straße und Hausnummer *<input type="text" name="street" required></label>
      <div class="form-grid form-grid--address"><label style="max-width:120px">Postleitzahl *<input type="text" name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required></label><label style="max-width:400px">Ort *<input type="text" name="city" required></label></div>
      <div class="form-grid form-grid--contact"><label style="max-width:200px">Telefon *<input type="tel" name="phone" inputmode="numeric" pattern="[0-9]+" required></label><label style="max-width:400px">E-Mail-Adresse *<input type="email" name="email" required></label></div>
      <label>Anmerkungen und Hinweise<textarea name="notes" rows="7"></textarea></label><p id="form-error" class="form-error" role="alert" hidden></p><button class="wishlist-submit" type="submit">Anfrage abschicken</button></form>`;

    root.querySelectorAll('.wishlist-remove').forEach(button => button.addEventListener('click', () => {
      const newItems = getItems(); newItems.splice(Number(button.dataset.index), 1); saveItems(newItems); updateCount(); document.dispatchEvent(new Event('wishlist:changed')); renderWishlist();
    }));
    root.querySelectorAll('.wishlist-quantity').forEach(input => input.addEventListener('change', () => {
      const newItems = getItems(); newItems[Number(input.dataset.index)].quantity = input.value; saveItems(newItems);
    }));
    root.querySelector('#wishlist-form').addEventListener('submit', sendRequest);
  }

  async function sendRequest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector('#form-error');
    const data = Object.fromEntries(new FormData(form));
    const items = getItems();
    const quantitiesValid = items.every(item => Number.isInteger(Number(item.quantity)) && Number(item.quantity) >= 1 && Number(item.quantity) <= 999);
    let message = '';
    if (!form.checkValidity()) message = 'Bitte füllen Sie alle Pflichtfelder korrekt aus.';
    else if (!(data.salutation || String(data.salutation_other || '').trim())) message = 'Bitte geben Sie an, wie wir Sie ansprechen dürfen.';
    else if (!/^\d{5}$/.test(data.zip || '')) message = 'Bitte geben Sie eine fünfstellige deutsche Postleitzahl ein.';
    else if (!/^\d+$/.test(data.phone || '')) message = 'Bitte geben Sie beim Telefon nur Ziffern ein.';
    else if (!quantitiesValid) message = 'Bitte geben Sie für jedes Produkt eine Menge zwischen 1 und 999 an.';
    if (message) { error.textContent = message; error.hidden = false; form.reportValidity(); return; }
    error.hidden = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = 'Anfrage wird gesendet …';
    try {
      const response = await fetch('/anfrage.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: data, items }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Versand nicht möglich');
      localStorage.removeItem(STORAGE_KEY); updateCount();
      document.dispatchEvent(new Event('wishlist:changed'));
      document.querySelector('#wishlist-content').innerHTML = '<h1>Vielen Dank für Ihre Anfrage.</h1><p class="wishlist-success">Ihre Anfrage wurde erfolgreich an uns gesendet. Wir melden uns schnellstmöglich bei Ihnen.</p>';
    } catch (err) {
      error.textContent = 'Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt.';
      error.hidden = false; submit.disabled = false; submit.textContent = 'Anfrage abschicken';
    }
  }

  function init() { updateCount(); addProductButton(); renderWishlist(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
