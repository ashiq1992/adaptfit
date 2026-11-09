// Applies the saved appearance before first paint (Paper is the default).
// A separate file because the Content Security Policy blocks inline scripts.
(function () {
  var t = 'paper';
  try {
    t = localStorage.getItem('adaptfit:theme') || 'paper';
  } catch (e) {
    /* storage unavailable: use Paper */
  }
  document.documentElement.setAttribute('data-theme', t);
  var night = t === 'night' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', night ? '#161513' : '#f6f2ea');
})();
