/* Original navigation helper; no platform-specific Tizen/webOS dependencies. */
(function (root) {
  'use strict';
  function nextIndex(rects, index, direction) {
    if (!rects.length) return -1;
    if (index < 0 || index >= rects.length) return 0;
    var here = rects[index], hx = here.left + here.width / 2, hy = here.top + here.height / 2;
    var best = index, score = Infinity;
    rects.forEach(function (r, i) {
      if (i === index) return;
      var dx = r.left + r.width / 2 - hx, dy = r.top + r.height / 2 - hy;
      var primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
      var cross = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (primary <= 1) return;
      var value = primary + cross * 3 + cross * cross / primary;
      if (value < score) { score = value; best = i; }
    });
    return best;
  }
  root.ProbeNavigation = { nextIndex: nextIndex };
}(window));
