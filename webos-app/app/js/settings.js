/*
 * On-TV setup screen, driven by the remote (arrows / OK / Back) or the
 * Magic Remote pointer. Edits a draft; "Save" writes it to Store.
 */
(function (global) {
  'use strict';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 461, ESC: 27 };

  var CHOICES = {
    mode: [
      ['mjpeg', 'MJPEG (recommended over live TV)'],
      ['snapshot', 'Snapshots (works with every camera)'],
      ['hls', 'HLS video'],
      ['webrtc', 'WebRTC (lowest latency)']
    ],
    position: [
      ['top-right', 'Top right'],
      ['top-left', 'Top left'],
      ['bottom-right', 'Bottom right'],
      ['bottom-left', 'Bottom left']
    ],
    size: (function () {
      var opts = [];
      for (var n = 10; n <= 50; n += 10) opts.push([n, n + ' % of screen width']);
      return opts;
    })(),
    timeout: [0, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300].map(function (n) {
      return [n, n === 0 ? 'Never (close with Back)' : n + ' seconds'];
    }),
    camera: [['', 'None (Home Assistant always chooses)']],
    camera2: [['', 'None (select a camera)']],
    enabled1: [[true, 'On'], [false, 'Off']],
    enabled2: [[true, 'On'], [false, 'Off']]
  };
  CHOICES.position2 = CHOICES.position;
  CHOICES.size2 = CHOICES.size;

  function roundedSize(value, fallback) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) n = fallback;
    return Math.max(10, Math.min(50, Math.round(n / 10) * 10));
  }

  // Each configured camera owns exactly one corner. The other camera cannot
  // cycle to it. A disabled Camera 2 does not reserve its own corner.
  function optionsFor(key) {
    var opts = CHOICES[key] || [];
    if (key === 'position2' && draft.enabled1 && draft.enabled2 && draft.camera && draft.camera2) {
      return opts.filter(function (o) { return o[0] !== draft.position; });
    }
    if (key === 'position' && draft.enabled1 && draft.enabled2 && draft.camera && draft.camera2) {
      return opts.filter(function (o) { return o[0] !== draft.position2; });
    }
    return opts;
  }

  // Repair an older saved configuration or a Camera 1 change without touching
  // camera selection or the already occupied Camera 1 corner.
  function freeSecondCorner() {
    if (!draft.enabled1 || !draft.enabled2 || !draft.camera || !draft.camera2 || draft.position !== draft.position2) return;
    var available = CHOICES.position2.filter(function (o) { return o[0] !== draft.position; });
    if (available.length) draft.position2 = available[0][0];
  }

  var root = document.getElementById('settings');
  var statusEl = document.getElementById('s-status');
  var rows = [].slice.call(root.querySelectorAll('.row'));
  var draft = {};
  var focus = { row: 0, col: 0 };
  var callbacks = {};
  var client = null;

  function rowItems(row) {
    return [].slice.call(row.querySelectorAll('input, button, .value')).filter(function (el) {
      return !(row.classList.contains('choice') && el.tagName === 'INPUT');
    });
  }

  function focusedEl() {
    var items = rowItems(rows[focus.row]);
    return items[Math.min(focus.col, items.length - 1)];
  }

  function render() {
    rows.forEach(function (row) {
      var key = row.getAttribute('data-key');
      if (row.classList.contains('choice')) {
        if (key === 'enabled1' || key === 'enabled2') row.classList.toggle('is-off', !draft[key]);
        var opts = optionsFor(key);
        var current = opts.filter(function (o) { return String(o[0]) === String(draft[key]); })[0];
        // A saved camera that isn't in the (not yet loaded) list still shows its id.
        row.querySelector('.value').textContent = current ? current[1] : String(draft[key] || '');
      } else if (key) {
        var input = row.querySelector('input');
        if (document.activeElement !== input) input.value = draft[key] || '';
      }
    });
    root.querySelectorAll('.focused').forEach(function (el) { el.classList.remove('focused'); });
    rows[focus.row].classList.add('focused');
    var el = focusedEl();
    if (el) {
      el.classList.add('focused');
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function cycle(key, step) {
    var opts = optionsFor(key);
    if (!opts.length) return;
    var idx = -1;
    opts.forEach(function (o, i) { if (String(o[0]) === String(draft[key])) idx = i; });
    idx = (idx + step + opts.length) % opts.length;
    draft[key] = opts[idx][0];
    if (key === 'position' || key === 'camera' || key === 'camera2' || key === 'enabled1' || key === 'enabled2') freeSecondCorner();
    render();
  }

  function readInputs() {
    rows.forEach(function (row) {
      var key = row.getAttribute('data-key');
      var input = row.querySelector('input');
      if (key && input) draft[key] = input.value.trim();
    });
    draft.url = (draft.url || '').replace(/\/+$/, '');
  }

  function testConnection() {
    readInputs();
    if (!draft.url || !draft.token) {
      setStatus('Enter the URL and token first', 'bad');
      return Promise.resolve(false);
    }
    setStatus('Connecting…');
    if (client) client.close();
    client = new HAClient(draft.url, draft.token);
    return client.connect()
      .then(function () { return Promise.all([client.currentUser(), client.listCameras()]); })
      .then(function (res) {
        var cameraOptions = res[1].map(function (c) { return [c.id, c.name]; });
        CHOICES.camera = [CHOICES.camera[0]].concat(cameraOptions);
        CHOICES.camera2 = [CHOICES.camera2[0]].concat(cameraOptions);
        setStatus('Connected to Home Assistant ' + client.haVersion + ' as ' + res[0].name +
          ' · ' + res[1].length + ' cameras', 'ok');
        render();
        return true;
      })
      .catch(function (err) {
        setStatus(err.message || String(err), 'bad');
        return false;
      });
  }

  // Avoid two boxes hidden on top of each other in the same corner.
  function validCameraLayout() {
    if (draft.enabled1 && draft.enabled2 && draft.camera && draft.camera2 && draft.position === draft.position2) {
      setStatus('Choose different corners for Camera 1 and Camera 2', 'bad');
      return false;
    }
    return true;
  }

  function save() {
    readInputs();
    if (!validCameraLayout()) return;
    var ok = Store.save({
      url: draft.url, token: draft.token, camera: draft.camera, camera2: draft.camera2,
      enabled1: !!draft.enabled1, enabled2: !!draft.enabled2,
      mode: draft.mode, position: draft.position, position2: draft.position2,
      size: Number(draft.size), size2: Number(draft.size2), timeout: Number(draft.timeout)
    });
    if (callbacks.toast) callbacks.toast(ok ? 'Settings saved' : 'Could not save settings');
  }

  function act(action) {
    if (action === 'test') testConnection();
    else if (action === 'save') save();
    else if (action === 'preview') {
      readInputs();
      if (validCameraLayout() && callbacks.onPreview) callbacks.onPreview(Object.assign({}, draft));
    } else if (action === 'exit' && callbacks.onExit) callbacks.onExit();
  }

  function activate(el) {
    if (!el) return;
    if (el.tagName === 'INPUT') {
      el.focus(); // webOS opens its on-screen keyboard
    } else if (el.tagName === 'BUTTON') {
      act(el.getAttribute('data-action'));
    } else if (el.classList.contains('value')) {
      cycle(el.parentNode.getAttribute('data-key'), 1);
    }
  }

  function move(dRow, dCol) {
    if (dRow) {
      focus.row = Math.max(0, Math.min(rows.length - 1, focus.row + dRow));
      focus.col = 0;
    } else {
      var n = rowItems(rows[focus.row]).length;
      focus.col = Math.max(0, Math.min(n - 1, focus.col + dCol));
    }
    render();
  }

  /** Returns true if the key was handled. */
  function handleKey(e) {
    var el = focusedEl();
    var row = rows[focus.row];

    // While typing in an input, only Up/Down/OK/Back leave it; the rest edit text.
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      if (e.keyCode === KEY.UP || e.keyCode === KEY.DOWN || e.keyCode === KEY.ENTER ||
          e.keyCode === KEY.BACK || e.keyCode === KEY.ESC) {
        document.activeElement.blur();
        readInputs();
        if (e.keyCode === KEY.UP) move(-1, 0);
        else if (e.keyCode === KEY.DOWN) move(1, 0);
        else render();
        return true;
      }
      return false;
    }

    switch (e.keyCode) {
      case KEY.UP: move(-1, 0); return true;
      case KEY.DOWN: move(1, 0); return true;
      case KEY.LEFT:
      case KEY.RIGHT:
        var dir = e.keyCode === KEY.LEFT ? -1 : 1;
        if (row.classList.contains('choice')) cycle(row.getAttribute('data-key'), dir);
        else move(0, dir);
        return true;
      case KEY.ENTER: activate(el); return true;
      case KEY.BACK:
      case KEY.ESC:
        if (callbacks.onExit) callbacks.onExit();
        return true;
    }
    return false;
  }

  // Magic Remote pointer / mouse
  root.addEventListener('click', function (e) {
    var target = e.target.closest('input, button, .value');
    var row = e.target.closest('.row');
    if (!row) return;
    // Entire On/Off row is a one-click switch for Magic Remote pointer.
    if (row.classList.contains('camera-toggle')) target = row.querySelector('.value');
    focus.row = rows.indexOf(row);
    focus.col = Math.max(0, rowItems(row).indexOf(target));
    render();
    if (target && target.tagName !== 'INPUT') activate(target);
  });
  root.addEventListener('change', readInputs, true);

  var Settings = {
    open: function (opts) {
      callbacks = opts || {};
      var s = Store.get();
      draft = {
        url: s.url || '', token: s.token || '', camera: s.camera || '',
        camera2: s.camera2 || '', enabled1: s.enabled1 !== false && s.enabled1 !== 'false',
        enabled2: s.enabled2 !== false && s.enabled2 !== 'false', mode: s.mode,
        position: s.position, position2: s.position2 || 'bottom-left',
        size: roundedSize(s.size, 30),
        size2: roundedSize(s.size2, 30),
        timeout: Number(s.timeout)
      };
      freeSecondCorner();
      root.classList.remove('hidden');
      document.body.classList.add('settings-open');
      focus = { row: draft.url && draft.token ? rows.indexOf(root.querySelector('[data-key="camera"]')) : 0, col: 0 };
      document.getElementById('s-version').textContent = callbacks.version || '';
      render();
      if (draft.url && draft.token) testConnection();
      else setStatus('Not connected yet', '');
    },
    /** Hide without forgetting the draft (used by Preview). */
    hide: function () {
      root.classList.add('hidden');
      document.body.classList.remove('settings-open');
    },
    resume: function () {
      freeSecondCorner();
      root.classList.remove('hidden');
      document.body.classList.add('settings-open');
      render();
    },
    close: function () {
      this.hide();
      if (client) client.close();
      client = null;
    },
    isOpen: function () { return !root.classList.contains('hidden'); },
    handleKey: handleKey
  };

  global.Settings = Settings;
})(window);
