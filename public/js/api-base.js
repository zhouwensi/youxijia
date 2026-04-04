window.__API_BASE__ = "https://api.yijuhuayouxi.com";
window.resolveApiUrl = function (p) {
  var b = String(window.__API_BASE__ || '').replace(/\/$/, '');
  if (/^https?:\/\//.test(p)) return p;
  return b + (p.charAt(0) === '/' ? p : '/' + p);
};
