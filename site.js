const dialog = document.querySelector('.lightbox');
const image = dialog.querySelector('img');
const title = document.querySelector('#lightbox-title');
for (const link of document.querySelectorAll('[data-lightbox]')) {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // Native dialog restores the element focused before showModal().
    link.focus({preventScroll:true});
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    title.textContent = link.dataset.lightbox;
    dialog.querySelector('.original-link').href = link.href;
    dialog.showModal();
    dialog.querySelector('.close-lightbox').focus();
  });
}
dialog.querySelector('.close-lightbox').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
