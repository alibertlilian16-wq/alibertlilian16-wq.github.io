// Le voyage : la molette fait avancer une caméra dans un couloir en 3D (CSS, sans bibliothèque).
(function () {
  var root = document.documentElement;
  var stage = document.getElementById('stage');
  var track = document.getElementById('track');
  var railList = document.getElementById('rail');
  var hint = document.getElementById('hint');
  var flat = root.classList.contains('flat');

  var OPEN = 0.7;           // part d'écran de défilement consacrée à l'ouverture de la porte
  var planes, door, leaf, floor, D, railButtons = [];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  // Les projets ajoutés dans projets.json deviennent des étapes, rangées à leur date.
  function addProjects(data) {
    var end = stage.querySelector('.station--end');
    (data.projets || []).forEach(function (p) {
      if (!p.titre) return;
      var a = el('article', 'plane station');
      a.dataset.tri = p.tri || '';
      a.dataset.rail = p.date || '';
      a.appendChild(el('p', 'station__when', p.date || ''));
      a.appendChild(el('h2', '', p.titre));
      if (p.contexte) a.appendChild(el('p', 'station__where', p.contexte));
      if (p.resume) a.appendChild(el('p', '', p.resume));
      if (p.lien && /^https:\/\//.test(p.lien.url || '')) { var l = el('a', 'station__link', p.lien.texte || 'Voir le projet'); l.href = p.lien.url; l.rel = 'noopener'; a.appendChild(l); }
      var next = [].slice.call(stage.querySelectorAll('.station')).filter(function (s) { return s.dataset.tri > (p.tri || ''); })[0] || end;
      stage.insertBefore(a, next);
    });
  }

  function setup() {
    planes = [].slice.call(stage.querySelectorAll('.plane'));
    door = planes[0];
    leaf = door.querySelector('.door__leaf');
    floor = stage.querySelector('.floor');
    var side = 1;
    planes.forEach(function (p, i) {
      p.dataset.i = i;
      if (i > 0) { p.dataset.side = side > 0 ? 'left' : 'right'; side = -side; }
    });
    if (flat) return;

    // Hauteur de défilement et points d'arrêt doux, un par étape.
    track.innerHTML = '';
    track.style.height = ((planes.length - 1 + OPEN) * 100 + 100) + 'vh';
    for (var i = 0; i < planes.length; i++) {
      var mark = document.createElement('i');
      mark.style.top = (i === 0 ? 0 : (i - 1 + OPEN + 1) * 100) + 'vh';
      track.appendChild(mark);
    }

    // Le fil des étapes, à droite.
    railList.innerHTML = '';
    railButtons = planes.slice(1).map(function (p, k) {
      var li = el('li'); var b = el('button'); b.type = 'button';
      b.appendChild(el('span', '', p.dataset.rail || ''));
      b.setAttribute('aria-label', 'Aller à : ' + (p.dataset.rail || '') + ', ' + (p.querySelector('h2') || {}).textContent);
      b.addEventListener('click', function () { go(k + 1); });
      li.appendChild(b); railList.appendChild(li);
      return b;
    });
    resize();
  }

  function stationScroll(i) { return i === 0 ? 0 : (i - 1 + OPEN + 1) * innerHeight; }
  function go(i) { scrollTo({ top: stationScroll(i), behavior: 'smooth' }); }

  function resize() { D = innerWidth < 760 ? 1100 : 1500; render(); }

  var ticking = false;
  var settle;
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; render(); }); }
    clearTimeout(settle); settle = setTimeout(render, 140); // dernier rendu une fois le défilement posé
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function render() {
    var s = scrollY / innerHeight;
    // 1) la porte s'ouvre sur place, 2) puis la caméra avance d'une étape par écran défilé.
    var open = clamp(s / OPEN, 0, 1);
    var cam = Math.max(0, s - OPEN) * D;
    leaf.style.setProperty('--open', open.toFixed(3));
    hint.style.opacity = s > 0.15 ? 0 : 1;

    var narrow = innerWidth < 760;
    var current = 0;
    planes.forEach(function (p, i) {
      var z = i === 0 ? 0 : -i * D;
      var rel = z + cam;                       // < 0 : devant soi, > 0 : déjà dépassé
      var o;
      if (rel <= 0) o = clamp(1 + rel / (D * 1.7), 0, 1);
      else o = clamp(1 - rel / 340, 0, 1);
      if (i === 0) o = rel <= 250 ? 1 : clamp(1 - (rel - 250) / 450, 0, 1);
      if (i > 0 && rel > -D * 0.5) current = i;
      var hidden = o < 0.01 || rel > 600;
      p.style.visibility = hidden ? 'hidden' : 'visible';
      if (hidden) return;
      var x = 0, y = 0;
      if (i > 0) {
        var w = p.offsetWidth, h = p.offsetHeight;
        x = narrow ? -w / 2 : (p.dataset.side === 'left' ? -w - innerWidth * 0.02 : innerWidth * 0.06);
        y = -h / 2;
      }
      p.style.opacity = o.toFixed(3);
      p.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + rel.toFixed(1) + 'px)';
      p.style.pointerEvents = Math.abs(rel) < D * 0.35 ? 'auto' : 'none';
    });
    floor.style.backgroundPosition = '0 ' + (-(cam % 180)).toFixed(1) + 'px';
    railButtons.forEach(function (b, k) { if (k + 1 === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  }

  // Clavier : flèches et Page suivante passent d'une étape à l'autre.
  addEventListener('keydown', function (e) {
    if (flat || e.target.closest && e.target.closest('a,button,input,textarea')) return;
    var k = e.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'PageDown' && k !== 'PageUp' && k !== ' ') return;
    e.preventDefault();
    var s = scrollY, idx = 0;
    for (var i = 0; i < planes.length; i++) if (stationScroll(i) <= s + 5) idx = i;
    var down = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey);
    go(clamp(idx + (down ? 1 : (stationScroll(idx) < s - 5 ? 0 : -1)), 0, planes.length - 1));
  });

  document.getElementById('restart').addEventListener('click', function (e) { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });

  document.querySelector('.bar__theme').addEventListener('click', function () {
    var dark = matchMedia('(prefers-color-scheme: dark)').matches;
    var next = (root.dataset.theme || (dark ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  var started = false;
  function start() {
    if (started) return; started = true;
    setup();
    if (!flat) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', resize); }
  }
  fetch('../projets.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (d) { if (!started) addProjects(d); })
    .catch(function () {})
    .then(start);
  setTimeout(start, 1500);
})();
