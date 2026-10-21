// Portfolio de Lilian Alibert. Aucun cookie, aucun appel extérieur.
(function () {
  var CV = {
    agence: {
      href: 'cv/CV_Lilian_Alibert_Agence.pdf',
      label: 'Télécharger mon CV agence',
      note: 'Version agence : transaction, location et gestion. PDF, une page.'
    },
    promoteur: {
      href: 'cv/CV_Lilian_Alibert_Promotion.pdf',
      label: 'Télécharger mon CV promotion',
      note: 'Version promotion immobilière, vente de logements neufs. PDF, une page.'
    },
    autre: {
      href: 'cv/CV_Lilian_Alibert_Immobilier.pdf',
      label: 'Télécharger mon CV',
      note: 'Version générale, immobilier au sens large. PDF, une page.'
    }
  };

  var buttons = document.querySelectorAll('[data-pour]');
  var link = document.getElementById('cv-link');
  var note = document.getElementById('cv-note');

  function apply(choice, push) {
    if (!CV[choice]) choice = 'autre';
    buttons.forEach(function (b) {
      var on = b.dataset.pour === choice;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('[data-for]').forEach(function (el) {
      el.hidden = el.dataset.for.split(' ').indexOf(choice) === -1;
    });
    link.href = CV[choice].href;
    link.textContent = CV[choice].label;
    note.textContent = CV[choice].note;
    if (push) {
      var url = new URL(location.href);
      if (choice === 'autre') url.searchParams.delete('pour'); else url.searchParams.set('pour', choice);
      history.replaceState(null, '', url);
    }
  }

  buttons.forEach(function (b, i) {
    b.addEventListener('click', function () { apply(b.dataset.pour, true); });
    // Flèches gauche et droite pour passer d'une option à l'autre, comme un groupe radio natif.
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      next.focus();
      apply(next.dataset.pour, true);
    });
  });

  // Le QR code de chaque CV ouvre la page sur la bonne version (?pour=agence ou ?pour=promoteur).
  apply(new URLSearchParams(location.search).get('pour'), false);

  // Thème : clair, sombre, puis retour au réglage du système.
  var root = document.documentElement;
  document.querySelector('.theme').addEventListener('click', function () {
    var dark = matchMedia('(prefers-color-scheme: dark)').matches;
    var current = root.dataset.theme || (dark ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // Copier l'adresse e-mail.
  var copy = document.getElementById('copy');
  var done = document.getElementById('copy-done');
  copy.addEventListener('click', function () {
    var mail = copy.dataset.mail;
    var ok = function () { done.textContent = 'Adresse copiée'; setTimeout(function () { done.textContent = ''; }, 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(mail).then(ok, function () { done.textContent = mail; });
    else done.textContent = mail;
  });


  // Autres projets : lus dans projets.json, pour en ajouter sans toucher au code.
  var section = document.getElementById('autres-projets');
  var list = document.getElementById('autres-liste');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  fetch('projets.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : { projets: [] }; }).then(function (data) {
    var items = (data.projets || []).slice().sort(function (a, b) { return String(b.tri || '').localeCompare(String(a.tri || '')); });
    if (!items.length) return;
    items.forEach(function (p) {
      var row = el('article', 'more__item');
      row.appendChild(el('p', 'more__when', p.date || ''));
      var body = el('div');
      body.appendChild(el('h3', '', p.titre));
      if (p.contexte) body.appendChild(el('p', 'more__ctx', p.contexte));
      if (p.resume) body.appendChild(el('p', '', p.resume));
      if (p.puces && p.puces.length) { var ul = el('ul'); p.puces.forEach(function (x) { ul.appendChild(el('li', '', x)); }); body.appendChild(ul); }
      if (p.competences && p.competences.length) { var s = el('p', 'more__skills'); s.appendChild(el('strong', '', 'Compétences mobilisées ')); s.appendChild(document.createTextNode(p.competences.join(', '))); body.appendChild(s); }
      if (p.lien && /^https:\/\//.test(p.lien.url || '')) { var a = el('a', 'link', p.lien.texte || 'Voir le projet'); a.href = p.lien.url; a.rel = 'noopener'; body.appendChild(a); }
      row.appendChild(body);
      list.appendChild(row);
    });
    section.hidden = false;
  }).catch(function () {});

  // Filet sous l'en-tête une fois la page défilée.
  var top = document.querySelector('.top');
  var onScroll = function () { top.classList.toggle('is-scrolled', scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
