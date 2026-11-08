/*
 * Original project: ISDaddy (MIT License)
 * Modifications: tixelcat (2026) — overlay lifecycle, player cleanup,
 * screensaver wake via Homebrew root service with standard webOS fallback.
 * See MODIFICATIONS.md and LICENSE for attribution.
 */
/*
 * Home Assistant PIP: shows one camera or two saved Home Assistant cameras over TV
 * over whatever the TV is playing, then closes itself.
 *
 * Launch params (sent by the Home Assistant integration via
 * webostv.command -> system.launcher/launch):
 *   {camera | url, title, mode, position, size, timeout, muted, refresh}
 *       show a PIP; launching again while open swaps the feed
 *   {close: true}                     hide the PIP
 *   {connect: {url, token}}           store the HA connection on the TV
 *                                     (may be combined with a camera)
 *   {show_saved: true, timeout}        show one or two cameras saved in the TV menu
 *   {} / {settings: true}             open the setup screen (app list launch)
 */
(function () {
  'use strict';

  var KEY_BACK = 461, KEY_ENTER = 13, KEY_ESC = 27;
  var POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
  var RETRY_DELAY = 3000;

  var webos = window.webOSSystem || window.PalmSystem || null;
  var appInfo = window.APP_INFO || {};

  var pip = document.getElementById('pip');
  var label = document.getElementById('label');
  var errorBox = document.getElementById('error');
  var spinner = document.getElementById('spinner');
  var video = document.getElementById('video');
  var pip2 = document.getElementById('pip2');
  var label2 = document.getElementById('label2');
  var errorBox2 = document.getElementById('error2');
  var spinner2 = document.getElementById('spinner2');
  var video2 = document.getElementById('video2');
  var toast = document.getElementById('toast');

  var ha = null;
  var haKey = '';          // url|token the current client was made for
  var haPromise = null;    // one connection shared by both cameras, even during auth
  var closeTimer = null;
  var retryTimer = null;
  var retryTimer2 = null;
  var toastTimer = null;
  var showId = 0;          // bumped per show()/closePip() so stale retries stop
  var returnToSettings = false;
  var closeAnimationTimer = null;
  var exitRequested = false;
  var pipVisible = false;

  var player = new Player(video, document.getElementById('frame'), function (state, info) {
    spinner.classList.toggle('hidden', state !== 'loading');
    // A lone camera keeps its original feed aspect ratio (1.0.5 behavior).
    // In dual-camera mode both windows must keep the same 16:9 box geometry,
    // regardless of their source resolutions or first-frame arrival order.
    if (state === 'playing' && info && info.width && info.height &&
        pip2.classList.contains('hidden')) {
      pip.style.aspectRatio = info.width + ' / ' + info.height;
    }
  });

  var player2 = new Player(video2, document.getElementById('frame2'), function (state, info) {
    spinner2.classList.toggle('hidden', state !== 'loading');
    // Camera 2 only runs in dual-camera mode: use the shared 16:9 frame.
    // The media itself is contained without stretching or cropping.
  });

  function stopSecond() {
    clearTimeout(retryTimer2);
    retryTimer2 = null;
    player2.stop();
    pip2.classList.add('hidden');
    pip2.classList.remove('closing', 'fill');
  }

  // ---------- launch params ----------

  function parseParams(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return {}; }
  }

  function initialParams() {
    if (webos) return parseParams(webos.launchParams);
    // Desktop browser testing: index.html?camera=camera.front_door&mode=hls
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      out[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
    });
    return out;
  }

  /** Launch params override the saved settings. */
  function resolve(params, settings) {
    function pick(key) {
      return params[key] !== undefined && params[key] !== '' ? params[key] : settings[key];
    }
    var url = params.url || '';
    var position = pick('position');
    return {
      camera: url ? '' : (pick('camera') || ''),
      url: url,
      title: params.title || '',
      mode: pick('mode') || 'mjpeg',
      position: POSITIONS.indexOf(position) >= 0 ? position : 'top-right',
      size: clamp(Number(pick('size')), 10, 100) / 100,
      timeout: Math.max(0, Number(pick('timeout')) || 0),
      refresh: Number(params.refresh) || 500,
      muted: String(params.muted === undefined ? true : params.muted) !== 'false'
    };
  }

  function route(params) {
    if (params.connect && params.connect.url && params.connect.token) {
      Store.save({ url: String(params.connect.url).replace(/\/+$/, ''), token: params.connect.token });
    }
    if (params.close) {
      closePip();
    } else if (params.camera || params.url) {
      Settings.close();
      returnToSettings = false;
      show(params, Store.get());
    } else if (params.show_saved === true || params.show_saved === 'true') {
      Settings.close();
      returnToSettings = false;
      showSaved(params, Store.get());
    } else if (params.connect) {
      if (Settings.isOpen()) {
        openSettings(); // reload the form with the pushed connection
        showToast('Connection received from Home Assistant');
      } else {
        notice('Connected to Home Assistant ✓', 6);
      }
    } else {
      openSettings();
    }
  }

  // ---------- Home Assistant connection ----------

  function connectHA(conn) {
    var key = conn.url + '|' + conn.token;
    if (!conn.url || !conn.token) {
      var err = new Error('Not set up yet: open Home Assistant PIP from the TV\'s app list, or add the access token in the Home Assistant integration.');
      err.fatal = true;
      return Promise.reject(err);
    }
    if (ha && haKey === key && ha.connected) return Promise.resolve(ha);
    if (ha && haKey === key && haPromise) return haPromise;
    if (ha) ha.close();
    var client = new HAClient(conn.url, conn.token);
    ha = client;
    haKey = key;
    haPromise = client.connect().then(function () {
      if (ha === client) haPromise = null;
      return client;
    }, function (err) {
      if (ha === client) haPromise = null;
      throw err;
    });
    return haPromise;
  }

  // ---------- Screensaver wake via Homebrew root service ----------
  // LG's system screensaver may be composited ABOVE a normal overlay window.
  // Requests sent directly by an ordinary app can be silently denied.
  // On rooted TVs, Homebrew Channel exposes a root execution service; use it
  // to ask the native tvpower service to dismiss an active screensaver.
  // We do not restart Home, send remote keys, or permanently disable burn-in protection.
  var wakeTimers = [];
  var WAKE_COMMAND = '/usr/bin/luna-send -n 1 -f luna://com.webos.service.tvpower/power/turnOnScreen \'{}\'';

  function cancelWakeTimers() {
    wakeTimers.forEach(function (timer) { clearTimeout(timer); });
    wakeTimers = [];
  }

  function lunaBridge(uri, data, callback) {
    try {
      if (typeof window.PalmServiceBridge !== 'function') {
        if (callback) callback(new Error('PalmServiceBridge unavailable'));
        return;
      }
      var bridge = new window.PalmServiceBridge();
      bridge.onservicecallback = function (raw) {
        try {
          var obj = JSON.parse(raw);
          if (callback) callback(null, obj);
        } catch (err) { if (callback) callback(err); }
      };
      bridge.call(uri, JSON.stringify(data));
    } catch (err) { if (callback) callback(err); }
  }

  function wakeFromScreenSaver(id) {
    if (id !== showId || exitRequested) return;
    lunaBridge('luna://org.webosbrew.hbchannel.service/exec',
      {command: WAKE_COMMAND}, function (err, response) {
        if (id !== showId || exitRequested) return;
        if (err || !response || response.error || response.returnValue === false) {
          // Fallback for setups without elevated Homebrew service access.
          console.warn('Homebrew screensaver wake failed:', err || (response && (response.error || response.errorText)));
          lunaBridge('luna://com.webos.service.tvpower/power/turnOnScreen', {},
            function (directErr, directResponse) {
              if (directErr || (directResponse && directResponse.returnValue === false)) {
                console.warn('Direct wake fallback failed:', directErr || directResponse.errorText);
              }
            });
        }
      });
  }

  function scheduleScreensaverWake(id) {
    cancelWakeTimers();
    // Trigger immediately and retry briefly: on some devices the system saver
    // reappears while the overlay app is being brought to the foreground.
    wakeFromScreenSaver(id);
    [450, 1300].forEach(function (delay) {
      wakeTimers.push(setTimeout(function () { wakeFromScreenSaver(id); }, delay));
    });
  }

  // ---------- PIP ----------

  function preparePip(opts) {
    clearTimeout(closeTimer);
    clearTimeout(retryTimer);
    clearTimeout(closeAnimationTimer);
    exitRequested = false;
    pipVisible = true;
    hideError();
    pip.classList.remove('hidden', 'closing');
    POSITIONS.forEach(function (p) { pip.classList.toggle(p, p === opts.position); });
    pip.style.setProperty('--size', opts.size);
    pip.style.aspectRatio = '';
    // If webOS sized the overlay window itself, just fill it.
    pip.classList.toggle('fill', !!webos && window.innerWidth < 1200);
    if (opts.timeout > 0) closeTimer = setTimeout(closePip, opts.timeout * 1000);
  }

  function show(params, settings) {
    var opts = resolve(params, settings);
    var id = ++showId;
    // Wake first so an existing screensaver does not cover the PIP.
    scheduleScreensaverWake(id);
    player.stop();
    stopSecond();
    preparePip(opts);
    video.muted = opts.muted;
    label.textContent = opts.title;

    if (!opts.camera && !opts.url) {
      showError('No camera chosen. Pick a default camera in setup, or choose one in Home Assistant.');
      return;
    }
    attempt(id, opts, { url: settings.url, token: settings.token });
  }

  // Saved layout: launch ONLY the camera slots enabled on the television.
  // An explicit legacy {camera: ...} launch is intentionally unaffected.
  function showSaved(params, settings) {
    var timeout = params.timeout !== undefined ? params.timeout : settings.timeout;
    // Absent flags from older saved configurations mean enabled, for upgrades.
    var first = settings.enabled1 !== false && settings.enabled1 !== 'false' && !!settings.camera;
    var second = settings.enabled2 !== false && settings.enabled2 !== 'false' && !!settings.camera2;

    // Both disabled (or without a selected source): do not show an error PIP.
    // HA launch can still foreground the app; release it immediately.
    if (!first && !second) {
      exitApp();
      return;
    }

    if (!first && second) {
      // Camera 2 works on its own in the original primary renderer: aspect
      // ratio, remote-control focus and close behavior stay exactly as 1.0.5.
      show({ camera: settings.camera2, title: params.title || '', mode: settings.mode,
        position: settings.position2 || 'bottom-left',
        size: Math.min(50, Math.max(10, Number(settings.size2) || 30)),
        timeout: timeout }, settings);
      return;
    }

    show({ camera: settings.camera, title: params.title || '', mode: settings.mode, position: settings.position,
      size: Math.min(50, Math.max(10, Number(settings.size) || 30)),
      timeout: timeout }, settings);
    if (!second) return;

    var opts = resolve({ camera: settings.camera2, mode: settings.mode,
      position: settings.position2 || 'bottom-left',
      size: Math.min(50, Math.max(10, Number(settings.size2) || 30)),
      timeout: timeout }, settings);
    if (opts.position === settings.position) {
      showToast('Camera 2 needs a different corner');
      return;
    }
    pip2.classList.remove('hidden', 'closing');
    POSITIONS.forEach(function (p) { pip2.classList.toggle(p, p === opts.position); });
    pip2.style.setProperty('--size', opts.size);
    pip2.style.aspectRatio = '';
    // Multi-camera uses a full transparent overlay; never fill the TV.
    pip.classList.remove('fill');
    video2.muted = true;
    label2.textContent = '';
    errorBox2.classList.add('hidden');
    attemptSecond(showId, opts, { url: settings.url, token: settings.token });
  }

  // A failing second stream must never stop or restart the first stream.
  function attemptSecond(id, opts, conn) {
    connectHA(conn).then(function (client) {
      if (id !== showId) return;
      if (!label2.textContent && opts.camera) {
        client.friendlyName(opts.camera).then(function (name) {
          if (id === showId && !label2.textContent) label2.textContent = name;
        }, function () {});
      }
      return player2.play(client, opts).then(function () {
        if (id === showId) errorBox2.classList.add('hidden');
      });
    }).catch(function (err) {
      if (id !== showId) return;
      spinner2.classList.add('hidden');
      errorBox2.textContent = (err.message || String(err)) + (err.fatal ? '' : ' (retrying...)');
      errorBox2.classList.remove('hidden');
      if (!err.fatal) retryTimer2 = setTimeout(function () {
        attemptSecond(id, opts, conn);
      }, RETRY_DELAY);
    });
  }

  /** HA or the camera can take a while to respond, so keep retrying while the PIP is open. */
  function attempt(id, opts, conn) {
    connectHA(conn).then(function (client) {
      if (id !== showId) return;
      if (!label.textContent && opts.camera) {
        client.friendlyName(opts.camera).then(function (n) {
          if (id === showId && !label.textContent) label.textContent = n;
        }, function () {});
      }
      return player.play(client, opts).then(hideError);
    }).catch(function (err) {
      if (id !== showId) return;
      showError((err.message || String(err)) + (err.fatal ? '' : ' (retrying…)'));
      if (!err.fatal) retryTimer = setTimeout(function () { attempt(id, opts, conn); }, RETRY_DELAY);
    });
  }

  /** A text-only PIP, e.g. after Home Assistant pushed the connection settings. */
  function notice(text, seconds) {
    showId++;
    stopSecond();
    player.stop();
    var s = Store.get();
    preparePip(resolve({ timeout: seconds }, s));
    label.textContent = '';
    spinner.classList.add('hidden');
    errorBox.textContent = text;
    errorBox.classList.add('info');
    errorBox.classList.remove('hidden');
  }

  function closePip() {
    // A timer, Back and an HA close command may all arrive together.
    // Only the first close should win; a new show() can cancel it.
    if (exitRequested) return;
    exitRequested = true;
    var closingId = ++showId;
    clearTimeout(closeTimer);
    clearTimeout(retryTimer);
    clearTimeout(closeAnimationTimer);
    cancelWakeTimers();
    // Release the stream immediately rather than leaving its renderer active
    // during the closing animation.
    player.stop();
    clearTimeout(retryTimer2);
    player2.stop();
    pip2.classList.add('closing');
    pip.classList.add('closing');
    closeAnimationTimer = setTimeout(function () {
      if (closingId !== showId) return; // A new doorbell launch superseded close.
      pipVisible = false;
      pip.classList.add('hidden');
      pip2.classList.add('hidden');
      if (returnToSettings) {
        returnToSettings = false;
        exitRequested = false;
        Settings.resume();
      } else {
        exitApp();
      }
    }, 180);
  }

  function showError(msg) {
    spinner.classList.add('hidden');
    errorBox.classList.remove('info');
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }

  // ---------- setup screen ----------

  function openSettings() {
    showId++;
    cancelWakeTimers();
    clearTimeout(closeAnimationTimer);
    exitRequested = false;
    pipVisible = false;
    clearTimeout(closeTimer);
    clearTimeout(retryTimer);
    stopSecond();
    player.stop();
    pip.classList.add('hidden');
    Settings.open({
      version: (appInfo.title || 'Home Assistant PIP') + ' ' + (appInfo.version || ''),
      toast: showToast,
      onExit: exitApp,
      onPreview: function (draft) {
        if (!(draft.enabled1 && draft.camera) && !(draft.enabled2 && draft.camera2)) {
          showToast('Enable and select at least one camera to preview');
          return;
        }
        Settings.hide();
        returnToSettings = true;
        // Preview uses the unsaved draft, connection included.
        showSaved({ show_saved: true, timeout: draft.timeout || 15 }, draft);
      }
    });
  }

  function showToast(text) {
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.classList.remove('hidden');
    toastTimer = setTimeout(function () { toast.classList.add('hidden'); }, 2500);
  }

  function exitApp() {
    cancelWakeTimers();
    clearTimeout(closeTimer);
    clearTimeout(retryTimer);
    clearTimeout(closeAnimationTimer);
    pipVisible = false;
    stopSecond();
    player.stop();
    Settings.close();
    if (ha) ha.close();
    ha = null;
    haKey = '';
    haPromise = null;
    // Close the actual webOS overlay app, not merely its DOM contents.
    // Focus restoration after closing is owned by webOS, not JavaScript.
    try {
      if (webos && typeof webos.close === 'function') webos.close();
      else window.close();
    } catch (e) { window.close(); }
  }

  function clamp(n, lo, hi) {
    return isNaN(n) ? 30 : Math.min(hi, Math.max(lo, n));
  }

  // ---------- events ----------

  document.addEventListener('webOSRelaunch', function (e) {
    route(parseParams(e.detail || (webos && webos.launchParams)));
  });

  // The overlay window takes the remote while it's open: in setup the keys
  // drive the form; over a PIP, Back or OK dismisses it.
  document.addEventListener('keydown', function (e) {
    if (Settings.isOpen()) {
      if (Settings.handleKey(e)) e.preventDefault();
    } else if (e.keyCode === KEY_BACK || e.keyCode === KEY_ESC || e.keyCode === KEY_ENTER) {
      e.preventDefault();
      closePip();
    }
  });

  document.addEventListener('visibilitychange', function () {
    // webOS may hide an overlay when Home comes forward. The old version
    // stopped video but left the overlay/app alive, which could retain focus.
    if (document.hidden && pipVisible && !returnToSettings) {
      closePip();
    }
  });

  route(initialParams());
})();
