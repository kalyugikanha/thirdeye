(function() {
  // 1. Locate executing script tag and retrieve configuration
  var script = document.currentScript ||
               document.querySelector('script[data-key]') ||
               document.querySelector('script[src*="te.js"]');
  var apiKey = script ? script.getAttribute('data-key') : '';
  var apiHost = 'http://localhost:8000';
  if (script && script.src) {
    try {
      apiHost = new URL(script.src).origin;
    } catch (e) {
      apiHost = 'http://localhost:8000';
    }
  }

  // 2. Persistent session identifier
  var sessionId = localStorage.getItem('te_session') || Math.random().toString(36).substring(2);
  localStorage.setItem('te_session', sessionId);

  var sessionStartTime = Date.now();
  var events = [];
  var isRecording = false;
  var flushTimer = null;

  // 3. Batch transmission logic (every 5 seconds)
  function flushRecordings() {
    if (events.length === 0) return;

    var batch = events.splice(0, events.length);
    var duration = Math.round((Date.now() - sessionStartTime) / 1000);

    var payload = {
      session_id: sessionId,
      api_key: apiKey,
      duration: duration,
      url: window.location.href,
      referrer: document.referrer || '',
      meta: getClientMeta(),
      events: batch
    };

    fetch(apiHost + '/api/v1/recordings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function(err) {
      console.warn('[ThirdEye] Batch upload failed, requeueing:', err);
      // Re-queue events if buffer is not overloaded
      if (events.length < 5000) {
        events = batch.concat(events);
      }
    });
  }

  // 4. Page unload flush (sendBeacon / keepalive fetch)
  function flushOnUnload() {
    if (events.length === 0) return;
    var batch = events.splice(0, events.length);
    var duration = Math.round((Date.now() - sessionStartTime) / 1000);
    var payload = JSON.stringify({
      session_id: sessionId,
      api_key: apiKey,
      duration: duration,
      url: window.location.href,
      referrer: document.referrer || '',
      meta: getClientMeta(),
      events: batch
    });

    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(apiHost + '/api/v1/recordings', blob);
    } else {
      fetch(apiHost + '/api/v1/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      });
    }
  }

  // 5. Initialize rrweb recording with strict privacy masking
  function initRecorder() {
    if (isRecording) return;
    var recordFn = (typeof rrwebRecord === 'function' ? rrwebRecord : null) ||
                   (window.rrwebRecord && typeof window.rrwebRecord.record === 'function' ? window.rrwebRecord.record : null) ||
                   (window.rrweb && typeof window.rrweb.record === 'function' ? window.rrweb.record : null) ||
                   (typeof window.rrwebRecord === 'function' ? window.rrwebRecord : null);

    if (typeof recordFn !== 'function') {
      console.warn('[ThirdEye] rrweb record function not found');
      return;
    }

    try {
      recordFn({
        emit: function(event) {
          events.push(event);
        },
        inlineStylesheet: true,
        collectFonts: true,
        recordCrossOriginIframes: true,
        // DOM mutations, mouse movements, scrolls
        sampling: {
          mousemove: true,
          mouseInteraction: true,
          scroll: 150
        },
        // Sensible privacy masking: Only mask password inputs or elements explicitly marked with .te-mask
        maskAllInputs: false,
        maskInputOptions: {
          password: true
        },
        maskTextSelector: '.te-mask, [data-te-mask]',
        maskTextFn: function(text, el) {
          if (!text || !text.trim()) return text;
          return '••••••';
        }
      });

      isRecording = true;
      if (!flushTimer) {
        flushTimer = setInterval(flushRecordings, 5000);
      }
      window.addEventListener('beforeunload', flushOnUnload);
      window.addEventListener('pagehide', flushOnUnload);
    } catch (e) {
      console.error('[ThirdEye] Failed to initialize rrweb recording:', e);
    }
  }

  // 6. Dynamic loader for rrweb script (CDN with local fallback)
  function loadAndStartRecording() {
    var hasRecord = (typeof rrwebRecord === 'function') || 
                    (window.rrweb && typeof window.rrweb.record === 'function') ||
                    (window.rrwebRecord);
    if (hasRecord) {
      initRecorder();
      return;
    }

    var cdnScript = document.createElement('script');
    cdnScript.src = 'https://cdn.jsdelivr.net/npm/rrweb@latest/dist/record/rrweb-record.min.js';
    cdnScript.async = true;
    cdnScript.onload = function() {
      initRecorder();
    };
    cdnScript.onerror = function() {
      // Offline fallback: try local backend public directory
      var localScript = document.createElement('script');
      localScript.src = apiHost + '/public/rrweb-record.min.js';
      localScript.async = true;
      localScript.onload = function() {
        initRecorder();
      };
      localScript.onerror = function() {
        console.warn('[ThirdEye] rrweb recording script could not be loaded from CDN or local host.');
      };
      document.head.appendChild(localScript);
    };
    document.head.appendChild(cdnScript);
  }

  function getClientMeta() {
    var ua = navigator.userAgent || '';
    var browser = 'Other';
    if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1 && ua.indexOf('OPR') === -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
    else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('Edg') > -1) browser = 'Edge';

    var os = 'Other';
    if (ua.indexOf('Win') > -1) os = 'Windows';
    else if (ua.indexOf('Mac') > -1) os = 'macOS';
    else if (ua.indexOf('Android') > -1) os = 'Android';
    else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';
    else if (ua.indexOf('Linux') > -1) os = 'Linux';

    return {
      browser: browser,
      os: os,
      screen: window.innerWidth + 'x' + window.innerHeight,
      title: document.title || '',
      lang: navigator.language || 'en'
    };
  }

  // 7. General event tracking (pageview & click via adblock-resilient /api/v1/collect)
  function track(eventName, properties) {
    var meta = getClientMeta();
    var mergedProps = Object.assign({}, meta, properties || {});
    fetch(apiHost + '/api/v1/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event_type: eventName,
        url: window.location.href,
        referrer: document.referrer || '',
        session_id: sessionId,
        properties: mergedProps
      })
    }).catch(function(err) {
      console.warn('[ThirdEye] Collect event failed:', err);
    });
  }

  // Automatically track initial pageview
  track('pageview');

  // 8. Rage Clicks & Click Heatmap Tracking
  var lastClick = { time: 0, target: null, count: 0 };
  document.addEventListener('click', function(e) {
    try {
      var x = Math.round((e.pageX / Math.max(window.innerWidth, 1)) * 100);
      var y = Math.round((e.pageY / Math.max(document.documentElement.scrollHeight, window.innerHeight, 1)) * 100);
      var targetTag = e.target ? (e.target.tagName || '').toLowerCase() : '';
      var targetText = e.target && e.target.innerText ? e.target.innerText.trim().substring(0, 30) : '';

      track('click', {
        x: x,
        y: y,
        tag: targetTag,
        text: targetText
      });

      // Detect Rage Clicks: 3+ rapid clicks on same element within 500ms
      var now = Date.now();
      if (lastClick.target === e.target && (now - lastClick.time) < 500) {
        lastClick.count++;
        if (lastClick.count === 3) {
          track('rage_click', {
            tag: targetTag,
            text: targetText,
            x: x,
            y: y,
            clicks: lastClick.count
          });
        }
      } else {
        lastClick = { time: now, target: e.target, count: 1 };
      }
    } catch (clickErr) {}
  }, true);

  // 9. Code-Level Error Monitoring (JS Exceptions & Unhandled Promises)
  window.addEventListener('error', function(e) {
    try {
      track('code_error', {
        message: e.message || 'Script error',
        filename: e.filename || '',
        lineno: e.lineno || 0,
        colno: e.colno || 0,
        stack: e.error && e.error.stack ? e.error.stack.substring(0, 500) : ''
      });
    } catch (err) {}
  });

  window.addEventListener('unhandledrejection', function(e) {
    try {
      track('code_error', {
        message: e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise Rejection',
        type: 'unhandled_rejection'
      });
    } catch (err) {}
  });

  // 10. Responsive & Layout Error Detection (viewport overflow, broken assets)
  window.addEventListener('load', function() {
    try {
      if (document.documentElement.scrollWidth > window.innerWidth + 20) {
        track('layout_error', {
          type: 'horizontal_overflow',
          scroll_width: document.documentElement.scrollWidth,
          viewport_width: window.innerWidth
        });
      }
    } catch (e) {}
  });

  // 11. Real-Time Presence Heartbeat (every 15s when active tab)
  function sendHeartbeat() {
    if (document.visibilityState === 'hidden') return;
    try {
      fetch(apiHost + '/api/v1/live/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          session_id: sessionId,
          current_url: window.location.href,
          referrer: document.referrer || '',
          properties: getClientMeta()
        })
      }).catch(function() {});
    } catch (e) {}
  }
  sendHeartbeat();
  setInterval(sendHeartbeat, 15000);

  // Initiate session recording
  loadAndStartRecording();

  console.log('[ThirdEye] Full-stack observability active for project:', apiKey, 'via:', apiHost);

  // Expose to window
  window.ThirdEye = {
    track: track,
    getSessionId: function() { return sessionId; },
    flush: flushRecordings
  };
})();
