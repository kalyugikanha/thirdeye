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
        // DOM mutations, mouse movements, scrolls
        sampling: {
          mousemove: true,
          mouseInteraction: true,
          scroll: 150
        },
        // STRICT PRIVACY: Mask ALL inputs
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: true,
          tel: true,
          text: true,
          color: true,
          date: true
        },
        maskInputFn: function(v, el) {
          return '***';
        },
        // STRICT PRIVACY: Mask ALL text
        maskTextSelector: '*',
        maskTextFn: function(text, el) {
          if (!text || !text.trim()) return text;
          return '***';
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

  // 7. General event tracking (pageview)
  function track(eventName, properties) {
    fetch(apiHost + '/api/v1/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event_type: eventName,
        url: window.location.href,
        referrer: document.referrer,
        session_id: sessionId,
        properties: properties || {}
      })
    }).catch(function(err) {
      console.warn('[ThirdEye] Track event failed:', err);
    });
  }

  // Automatically track pageview
  track('pageview');

  // Initiate session recording
  loadAndStartRecording();

  // Expose to window
  window.ThirdEye = {
    track: track,
    getSessionId: function() { return sessionId; },
    flush: flushRecordings
  };
})();
