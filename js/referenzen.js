/* /js/referenzen.js */
// Die Projekte stehen in /js/referenzen.json. Texte und Produkte des Kunden kommen dort in „text“ und „produkte“.
document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('references-grid');
  const modal = document.getElementById('reference-modal');
  if (!grid || !modal) return;

  const image = document.getElementById('reference-modal-image');
  const caption = document.getElementById('reference-modal-caption');
  const previous = modal.querySelector('.reference-modal-prev');
  const next = modal.querySelector('.reference-modal-next');
  const close = modal.querySelector('.reference-modal-close');
  let project = null;
  let index = 0;
  let lastFocus = null;

  const photoUrl = (item, number) => `/bilder/referenzen/${item.slug}/${String(number).padStart(2, '0')}.jpg`;
  const title = item => `${item.einrichtung}, ${item.ort}`;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function showPhoto() {
    image.src = photoUrl(project, index + 1);
    image.alt = title(project);
    caption.textContent = `${title(project)} (${index + 1} von ${project.fotos})`;
  }

  function step(direction) {
    index = (index + direction + project.fotos) % project.fotos;
    showPhoto();
  }

  function openProject(item, trigger) {
    project = item;
    index = 0;
    lastFocus = trigger;
    const several = item.fotos > 1;
    previous.hidden = !several;
    next.hidden = !several;
    showPhoto();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    close.focus();
  }

  function closeModal() {
    modal.hidden = true;
    image.removeAttribute('src');
    document.body.style.overflow = '';
    lastFocus?.focus();
  }

  function createCard(item) {
    const card = element('article', 'reference-card');

    const open = element('button', 'reference-open');
    open.type = 'button';
    open.setAttribute('aria-label', `Fotos ansehen: ${title(item)}`);
    const cover = element('img');
    cover.src = `/bilder/referenzen/${item.slug}/vorschau.jpg`;
    cover.alt = title(item);
    cover.loading = 'lazy';
    const count = element('span', 'reference-count');
    const icon = element('i', 'fa-solid fa-images');
    count.append(icon, ` ${item.fotos} ${item.fotos === 1 ? 'Foto' : 'Fotos'}`);
    open.append(cover, count);
    open.addEventListener('click', () => openProject(item, open));

    const info = element('div', 'reference-info');
    info.append(element('span', 'reference-place', item.ort), element('h2', '', item.einrichtung));

    if (item.produkte.length) {
      const products = element('div', 'reference-products');
      item.produkte.forEach(product => {
        const link = element('a');
        link.href = `/produkte/${product.slug}/`;
        link.append(element('span', 'product-name-inline', product.name));
        products.append(link);
      });
      info.append(products);
    }
    if (item.text) info.append(element('p', '', item.text));

    card.append(open, info);
    return card;
  }

  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  close.addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => {
    if (modal.hidden) return;
    if (event.key === 'Escape') closeModal();
    if (project.fotos > 1 && event.key === 'ArrowLeft') step(-1);
    if (project.fotos > 1 && event.key === 'ArrowRight') step(1);
  });

  const projects = await fetch('/js/referenzen.json').then(response => response.json());
  grid.append(...projects.map(createCard));
});
