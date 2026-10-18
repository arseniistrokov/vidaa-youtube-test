(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { config: {}, api: '', query: '', id: 'jNQXAC9IVRw', formats: [], format: 0, generation: 0, keyboard: null, lines: [], played: false };
  var video = $('video');
  function log(message) {
    state.lines.push(new Date().toISOString().substr(11, 8) + ' ' + message);
    if (state.lines.length > 45) state.lines.shift();
    $('log').textContent = state.lines.join('\n');
  }
  function status(message) { $('status').textContent = message; log(message); }
  function save(key, value) { try { localStorage.setItem('vidaa-probe.' + key, value); return true; } catch (e) { status('localStorage недоступен: ' + e.name); return false; } }
  function read(key) { try { return localStorage.getItem('vidaa-probe.' + key) || ''; } catch (e) { return ''; } }
  function https(value, noQuery) {
    var url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (noQuery && url.search)) throw new Error('Нужен HTTPS URL без логина, пароля и фрагмента');
    return url.href.replace(noQuery ? /\/$/ : /$^/, '');
  }
  function json(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true); xhr.timeout = 15000;
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) return callback(new Error('HTTP ' + xhr.status));
      try { var data = JSON.parse(xhr.responseText); } catch (e) { return callback(new Error('Ответ не является JSON')); }
      callback(null, data);
    };
    xhr.onerror = function () { callback(new Error('Сеть / TLS / CORS: ответ недоступен браузеру')); };
    xhr.ontimeout = function () { callback(new Error('Тайм-аут 15 секунд')); };
    xhr.send();
  }
  function settings() { $('settings').textContent = 'API: ' + (state.api || 'не задан') + ' · Запрос: ' + state.query + ' · ID: ' + state.id; }
  function focusables() {
    var scope = state.keyboard ? $('keyboard') : document;
    return Array.prototype.filter.call(scope.querySelectorAll('button, video[tabindex]'), function (el) { return !el.disabled && el.getClientRects().length > 0; });
  }
  function focus(el) { if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }); } }
  function move(direction) {
    var items = focusables();
    var rects = items.map(function (el) { return el.getBoundingClientRect(); });
    var index = window.ProbeNavigation.nextIndex(rects, items.indexOf(document.activeElement), direction);
    focus(items[index]);
  }
  function keyboard(title, initial, done, origin) {
    state.keyboard = { value: initial, done: done, origin: origin }; $('keyboard').hidden = false; $('keyboardTitle').textContent = title;
    $('keys').textContent = '';
    var chars = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.:/?=&%';
    function redraw() { $('entry').textContent = state.keyboard.value + '▏'; }
    function key(label, action) { var b = document.createElement('button'); b.textContent = label; b.onclick = action; $('keys').appendChild(b); }
    chars.split('').forEach(function (c) { key(c, function () { if (state.keyboard.value.length < 500) state.keyboard.value += c; redraw(); }); });
    key('Пробел', function () { if (state.keyboard.value.length < 500) state.keyboard.value += ' '; redraw(); });
    key('⌫', function () { state.keyboard.value = state.keyboard.value.slice(0, -1); redraw(); });
    key('Очистить', function () { state.keyboard.value = ''; redraw(); });
    key('Готово', function () { var k = state.keyboard; closeKeyboard(); k.done(k.value.trim()); });
    key('Отмена', closeKeyboard); redraw(); focus($('keys').firstChild);
  }
  function closeKeyboard() { if (!state.keyboard) return; var origin = state.keyboard.origin; state.keyboard = null; $('keyboard').hidden = true; focus(origin); }
  function stop() {
    state.generation++; video.pause(); video.removeAttribute('src'); video.load(); video.removeAttribute('tabindex'); $('playerSection').hidden = true; state.formats = []; state.played = false; focus($('sample'));
  }
  function playFormat(index) {
    if (!state.formats.length) return;
    state.format = index % state.formats.length; var f = state.formats[state.format];
    state.played = false; $('playerSection').hidden = false; video.setAttribute('tabindex', '0'); video.src = f.url; video.load();
    $('mediaStatus').textContent = f.label; status('Открыт поток: ' + f.label + '. Успех будет отмечен после продвижения воспроизведения.');
    focus(video); var playing = video.play(); if (playing && playing.catch) playing.catch(function () { log('play() отклонён: нажмите OK на плеере; при повторной ошибке проверьте формат.'); });
  }
  function play(formats) { stop(); state.formats = formats; playFormat(0); }
  function toggle() { if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () { status('Не удалось начать воспроизведение'); }); } else video.pause(); }
  function seek(delta) { if (isFinite(video.duration) && video.duration > 0) video.currentTime = Math.max(0, Math.min(video.duration - 0.1, video.currentTime + delta)); }
  function youtube(id) {
    if (!state.api) return status('Сначала задайте HTTPS API Invidious');
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return status('ID YouTube должен содержать 11 символов');
    stop(); var generation = state.generation; status('Получение метаданных YouTube…');
    json(state.api + '/api/v1/videos/' + id, function (error, data) {
      if (generation !== state.generation) return;
      if (error) return status(error.message);
      if (!data || typeof data !== 'object' || data.error) return status('API не вернул доступное видео');
      var formats = [];
      (Array.isArray(data.formatStreams) ? data.formatStreams : []).forEach(function (f) {
        if (!f || typeof f.url !== 'string' || !/^video\/mp4/i.test(f.type || '')) return;
        try { formats.push({ url: https(f.url, false), label: 'YouTube MP4 ' + String(f.qualityLabel || f.resolution || f.itag || '') }); } catch (e) { /* reject unsafe media URLs */ }
      });
      if (typeof data.hlsUrl === 'string' && video.canPlayType('application/vnd.apple.mpegurl')) {
        try { formats.push({ url: https(data.hlsUrl, false), label: 'YouTube HLS (нативный)' }); } catch (e) { /* reject unsafe media URLs */ }
      }
      if (!formats.length) return status('Нет совместимого совмещённого MP4 / нативного HLS. DASH/SABR пока не реализованы.');
      play(formats);
    });
  }
  $('marker').onclick = function () { var marker = new Date().toISOString(); if (save('marker', marker)) { $('persistence').textContent = 'Сохранено: ' + marker + '. Перезагрузите ТВ и проверьте эту метку.'; status('Метка записана'); } };
  $('diagnostics').onclick = function () {
    log('UA: ' + navigator.userAgent);
    log('HTML5 video=' + !!video.canPlayType + ' MP4/H264=' + video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') + ' HLS=' + video.canPlayType('application/vnd.apple.mpegurl'));
    log('MSE=' + !!window.MediaSource + ' URL=' + !!window.URL + ' HTTPS=' + (location.protocol === 'https:'));
  };
  $('sample').onclick = function () { try { play([{ url: https(state.config.sampleUrl, false), label: 'Контрольный MP4, не YouTube' }]); } catch (e) { status('Контрольный URL не задан или некорректен'); } };
  $('stop').onclick = stop; $('playerClose').onclick = stop; $('toggle').onclick = toggle;
  $('rewind').onclick = function () { seek(-10); }; $('forward').onclick = function () { seek(10); }; $('quality').onclick = function () { playFormat(state.format + 1); };
  $('api').onclick = function () { keyboard('HTTPS-адрес Invidious (без /api/v1)', state.api, function (value) { try { state.api = value ? https(value, true) : ''; settings(); } catch (e) { status(e.message); } }, $('api')); };
  $('query').onclick = function () { keyboard('Поисковый запрос', state.query, function (value) { state.query = value; settings(); }, $('query')); };
  $('videoId').onclick = function () { keyboard('YouTube video ID (11 символов)', state.id, function (value) { state.id = value; settings(); }, $('videoId')); };
  $('youtube').onclick = function () { youtube(state.id); };
  $('search').onclick = function () {
    if (!state.api || !state.query) return status('Задайте API и поисковый запрос');
    var generation = ++state.generation; $('results').textContent = ''; status('Поиск…');
    json(state.api + '/api/v1/search?type=video&hl=ru&q=' + encodeURIComponent(state.query), function (error, data) {
      if (generation !== state.generation) return;
      if (error) return status(error.message);
      if (!Array.isArray(data)) return status('API поиска вернул неожиданный ответ');
      data.filter(function (x) { return x && x.type === 'video' && /^[A-Za-z0-9_-]{11}$/.test(x.videoId); }).slice(0, 12).forEach(function (item) {
        var b = document.createElement('button'); b.textContent = item.title || item.videoId; b.onclick = function () { state.id = item.videoId; settings(); youtube(item.videoId); }; $('results').appendChild(b);
      });
      status('Найдено на этой странице: ' + $('results').children.length); if ($('results').firstChild) focus($('results').firstChild);
    });
  };
  $('report').onclick = function () { log('Отчёт локальный: версия 0.1.0-probe; метка=' + (read('marker') || 'нет') + '; продвижение плеера=' + state.played + '. Регистрация и работа без ПК проверяются отдельно владельцем.'); };
  video.addEventListener('loadedmetadata', function () { log('Метаданные: ' + video.videoWidth + '×' + video.videoHeight + ', длительность=' + Math.round(video.duration)); });
  video.addEventListener('timeupdate', function () { if (!state.played && !video.paused && !video.seeking && video.currentTime > 1) { state.played = true; status('Плеер сообщил о продвижении воспроизведения. Изображение и звук подтвердите на ТВ.'); } });
  video.addEventListener('error', function () { if (video.error) status('Ошибка HTML5 video: code=' + video.error.code + ' (2 сеть, 3 декодирование, 4 источник/формат)'); });
  document.addEventListener('keydown', function (event) {
    var code = event.keyCode, key = event.key; log('Пульт: key=' + key + ' code=' + code);
    if (key === 'Escape' || key === 'Backspace' || code === 461 || code === 10009 || key === 'BrowserBack') {
      if (state.keyboard) { event.preventDefault(); closeKeyboard(); }
      else if (!$('playerSection').hidden) { event.preventDefault(); stop(); }
      return;
    }
    if (document.activeElement === video && !state.keyboard) {
      if (code === 37 || code === 39 || code === 13) { event.preventDefault(); if (code === 13) toggle(); else seek(code === 37 ? -10 : 10); return; }
    }
    var directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
    if (directions[code]) { event.preventDefault(); move(directions[code]); }
    else if ((code === 415 || code === 19 || code === 413 || code === 417 || code === 412 || key === 'MediaPlayPause') && !$('playerSection').hidden && !state.keyboard) {
      event.preventDefault(); if (code === 413) stop(); else if (code === 417 || code === 412) seek(code === 417 ? 10 : -10); else if (code === 415) { if (video.paused) toggle(); } else if (code === 19) video.pause(); else toggle();
    }
  });
  window.addEventListener('error', function (event) { status('Ошибка JavaScript: ' + event.message); });
  $('persistence').textContent = 'Предыдущая метка: ' + (read('marker') || 'ещё не сохранена');
  focus($('marker'));
  json('config.json', function (error, config) {
    if (error) return status('Не удалось загрузить config.json: ' + error.message);
    state.config = config || {}; state.id = state.config.videoId || state.id;
    try { state.api = state.config.apiBase ? https(state.config.apiBase, true) : ''; } catch (e) { status('Некорректный API в config.json'); }
    settings(); status('Готово. Это диагностический прототип, не проверенный на вашем ТВ.');
  });
}());
