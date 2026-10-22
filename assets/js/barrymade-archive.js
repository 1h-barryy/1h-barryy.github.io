/* The existing semantic project links are the catalog. Archive rows are a
   separate view: never clone physics classes, handlers, or live transforms. */
(function () {
  'use strict';
  var list = document.getElementById('archive-list');
  if (!list) return;
  var sources = document.querySelectorAll('#stage .chip, .study-entry');
  var rows = [];
  sources.forEach(function (source, index) {
    var row = document.createElement('a');
    row.className = 'archive-row';
    row.href = source.getAttribute('href');
    row.dataset.category = source.dataset.category;
    var number = document.createElement('span');
    number.className = 'archive-number';
    number.textContent = String(index + 1).padStart(2, '0');
    var preview = document.createElement('span');
    preview.className = 'archive-preview';
    preview.setAttribute('aria-hidden', 'true');
    var img = source.querySelector('img');
    if (img) {
      img = img.cloneNode(); img.loading = 'lazy'; img.draggable = false;
      img.removeAttribute('class'); preview.appendChild(img);
    } else { preview.textContent = 'B / M'; }
    var text = document.createElement('span');
    text.className = 'archive-text';
    var title = document.createElement('span');
    title.className = 'archive-title';
    title.textContent = source.querySelector('.chip__title').textContent;
    var detail = document.createElement('span');
    detail.className = 'archive-detail';
    detail.textContent = (source.querySelector('.chip__tools') || source.querySelector('.chip__note')).textContent;
    text.append(title, detail);
    var kind = document.createElement('span');
    kind.className = 'archive-kind';
    kind.textContent = source.querySelector('.chip__kind').textContent;
    var arrow = document.createElement('span');
    arrow.className = 'archive-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    row.append(number, preview, text, kind, arrow);
    list.appendChild(row); rows.push(row);
  });
  var buttons = document.querySelectorAll('[data-filter]');
  function filter(category) {
    var count = 0;
    rows.forEach(function (row) {
      row.hidden = category !== 'all' && row.dataset.category !== category;
      if (!row.hidden) count++;
    });
    buttons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.filter === category)); });
    document.getElementById('archive-count').textContent = count + ' / ' + rows.length + ' entries';
  }
  buttons.forEach(function (button) { button.addEventListener('click', function () { filter(button.dataset.filter); }); });
  document.getElementById('browse-studies').addEventListener('click', function () {
    filter('studies');
    document.querySelector('[data-filter="studies"]').focus({ preventScroll: true });
  });
  document.querySelector('.archive-controls').hidden = false;
  filter('all');
})();
