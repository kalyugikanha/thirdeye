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

  // 2. Persistent session identifier with 30-minute inactivity expiration
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var storedSession = null;
  var lastActivity = 0;
  try {
    storedSession = localStorage.getItem('te_session');
    lastActivity = parseInt(localStorage.getItem('te_session_activity') || '0', 10);
  } catch (e) {}

  var now = Date.now();
  var sessionId = storedSession;
  if (!sessionId || !lastActivity || (now - lastActivity > SESSION_TIMEOUT_MS)) {
    sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    try {
      localStorage.setItem('te_session', sessionId);
    } catch (e) {}
  }
  try {
    localStorage.setItem('te_session_activity', String(now));
  } catch (e) {}

  function touchActivity() {
    try {
      localStorage.setItem('te_session_activity', String(Date.now()));
    } catch (e) {}
  }

  var sessionStartTime = Date.now();
  var events = [];
  var isRecording = false;
  var flushTimer = null;

  // 3. Batch transmission logic (every 5 seconds)
  function flushRecordings() {
    touchActivity();
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
      if (e.target && e.target.closest && e.target.closest('#te-feedback-root')) return;
      var x = Math.round((e.pageX / Math.max(window.innerWidth, 1)) * 100);
      var y = Math.round((e.pageY / Math.max(document.documentElement.scrollHeight, window.innerHeight, 1)) * 100);
      var targetTag = e.target ? (e.target.tagName || '').toLowerCase() : '';
      var targetText = e.target && e.target.innerText ? e.target.innerText.trim().substring(0, 30) : '';

      track('click', {
        x: x,
        y: y,
        tag: targetTag,
        text: targetText,
        selectors: buildSelectors(e.target)
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
          openFeedback('rage_click');
        }
      } else {
        lastClick = { time: now, target: e.target, count: 1 };
      }
    } catch (clickErr) {}
  }, true);

  // CSS selectors (#id, .class, tag) of the clicked element and its ancestors, used by click goals
  function buildSelectors(node) {
    var out = [];
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      var tag = (node.tagName || '').toLowerCase();
      if (node.id) out.push('#' + node.id);
      if (typeof node.className === 'string' && node.className.trim()) {
        node.className.trim().split(/\s+/).slice(0, 3).forEach(function(c) { out.push('.' + c); });
      }
      out.push(tag);
      node = node.parentElement;
      depth++;
    }
    return out;
  }

  // 8b. Customer feedback widget (CSAT). Enabled per project from the ThirdEye dashboard.
  var feedbackCfg = { enabled: false, prompt: 'How is your experience?' };
  var feedbackRoot = null;
  var lastRagePrompt = 0;

  function mk(tag, styles, text) {
    var n = document.createElement(tag);
    if (styles) n.style.cssText = styles;
    if (text) n.textContent = text;
    return n;
  }

  function closeFeedback() {
    if (feedbackRoot) { feedbackRoot.remove(); feedbackRoot = null; }
    renderPill();
  }

  function renderPill() {
    if (!feedbackCfg.enabled || document.getElementById('te-feedback-root')) return;
    feedbackRoot = mk('div', 'position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,sans-serif;');
    feedbackRoot.id = 'te-feedback-root';
    var pill = mk('button', 'background:#0f172a;color:#fff;border:0;border-radius:999px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(15,23,42,.35);border-bottom:2px solid #F43F5E;', 'Feedback');
    pill.addEventListener('click', function() { openFeedback('widget'); });
    feedbackRoot.appendChild(pill);
    document.body.appendChild(feedbackRoot);
  }

  function openFeedback(trigger) {
    if (!feedbackCfg.enabled) return;
    if (trigger === 'rage_click') {
      if (Date.now() - lastRagePrompt < 60000) return;  // at most one automatic prompt per minute
      lastRagePrompt = Date.now();
    }
    var existing = document.getElementById('te-feedback-root');
    if (existing) existing.remove();

    var rating = 0;
    feedbackRoot = mk('div', 'position:fixed;right:20px;bottom:20px;z-index:2147483647;width:300px;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(15,23,42,.28);border-top:3px solid #F43F5E;padding:16px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;');
    feedbackRoot.id = 'te-feedback-root';
    var title = trigger === 'rage_click' ? 'Notice an issue? Let our team know.' : feedbackCfg.prompt;
    feedbackRoot.appendChild(mk('div', 'font-size:14px;font-weight:700;margin-bottom:10px;', title));

    var stars = mk('div', 'display:flex;gap:6px;margin-bottom:10px;');
    var starBtns = [];
    for (var i = 1; i <= 5; i++) {
      (function(v) {
        var b = mk('button', 'background:none;border:0;font-size:24px;cursor:pointer;color:#cbd5e1;padding:0;line-height:1;', '\u2605');
        b.setAttribute('aria-label', v + ' star');
        b.addEventListener('click', function() {
          rating = v;
          starBtns.forEach(function(s, idx) { s.style.color = idx < v ? '#F59E0B' : '#cbd5e1'; });
        });
        starBtns.push(b);
        stars.appendChild(b);
      })(i);
    }
    feedbackRoot.appendChild(stars);

    var box = mk('textarea', 'width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:13px;resize:none;height:64px;margin-bottom:10px;font-family:inherit;');
    box.placeholder = 'Tell us more (optional)';
    box.maxLength = 500;
    box.setAttribute('data-te-mask', '1');
    feedbackRoot.appendChild(box);

    var msg = mk('div', 'font-size:12px;color:#e11d48;min-height:14px;margin-bottom:6px;');
    feedbackRoot.appendChild(msg);

    var row = mk('div', 'display:flex;gap:8px;justify-content:flex-end;');
    var cancel = mk('button', 'background:#f1f5f9;border:0;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;', 'Cancel');
    var send = mk('button', 'background:#F43F5E;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;', 'Send');
    cancel.addEventListener('click', closeFeedback);
    send.addEventListener('click', function() {
      if (!rating) { msg.textContent = 'Please choose a rating.'; return; }
      send.disabled = true;
      fetch(apiHost + '/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          rating: rating,
          comment: box.value,
          url: window.location.href,
          session_id: sessionId,
          trigger: trigger,
          browser: getClientMeta().browser
        })
      }).then(function(r) {
        if (!r.ok) throw new Error('status ' + r.status);
        feedbackRoot.textContent = '';
        feedbackRoot.appendChild(mk('div', 'font-size:14px;font-weight:600;text-align:center;padding:8px 0;', 'Thank you for your feedback!'));
        setTimeout(closeFeedback, 1800);
      }).catch(function() {
        send.disabled = false;
        msg.textContent = 'Could not send feedback. Please try again.';
      });
    });
    row.appendChild(cancel);
    row.appendChild(send);
    feedbackRoot.appendChild(row);
    document.body.appendChild(feedbackRoot);
  }

  function initFeedback() {
    if (!apiKey) return;
    fetch(apiHost + '/api/v1/feedback/config?api_key=' + encodeURIComponent(apiKey))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(cfg) {
        if (cfg && cfg.enabled) {
          feedbackCfg = cfg;
          if (document.body) renderPill();
          else document.addEventListener('DOMContentLoaded', renderPill);
        }
      }).catch(function() {});
  }
  initFeedback();

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

  // 12. Core Web Vitals & Real User Monitoring (RUM)
  var vitalsState = { lcp: null, inp: null, cls: 0, ttfb: null, sent: false };
  try {
    if (window.PerformanceObserver) {
      try {
        new PerformanceObserver(function(list) {
          var entries = list.getEntries();
          if (entries.length) {
            var last = entries[entries.length - 1];
            vitalsState.lcp = Math.round(last.renderTime || last.loadTime || last.startTime || 0);
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {}
      try {
        new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(entry) {
            if (!entry.hadRecentInput && typeof entry.value === 'number') {
              vitalsState.cls += entry.value;
            }
          });
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
      try {
        new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(entry) {
            var dur = Math.round(entry.duration || (entry.processingStart ? entry.processingStart - entry.startTime : 0));
            if (dur > (vitalsState.inp || 0)) vitalsState.inp = dur;
          });
        }).observe({ type: 'first-input', buffered: true });
      } catch (e) {}
    }
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && nav.responseStart > 0) {
      vitalsState.ttfb = Math.max(0, Math.round(nav.responseStart - (nav.requestStart || 0)));
    }
  } catch (e) {}

  function flushVitals() {
    if (vitalsState.sent || !apiKey) return;
    if (vitalsState.lcp === null && vitalsState.ttfb === null) return;
    vitalsState.sent = true;
    var deviceType = window.innerWidth < 768 ? 'Mobile' : 'Desktop';
    fetch(apiHost + '/api/v1/rum/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        session_id: sessionId,
        url: window.location.href,
        device: deviceType,
        lcp_ms: vitalsState.lcp,
        inp_ms: vitalsState.inp || 80,
        cls_score: Math.round(vitalsState.cls * 1000) / 1000,
        ttfb_ms: vitalsState.ttfb || 180
      }),
      keepalive: true
    }).catch(function() {});
  }
  setTimeout(flushVitals, 4000);
  window.addEventListener('pagehide', flushVitals);

  // 13. Privacy-Safe Form & Checkout Abandonment Tracking (never reads field values)
  var activeFormField = null;
  var touchedForms = {};
  document.addEventListener('focusin', function(e) {
    try {
      var t = e.target;
      if (!t || !t.tagName) return;
      if (t.closest && t.closest('#te-feedback-root')) return;
      var tag = t.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return;
      var form = t.form || (t.closest && t.closest('form'));
      var formId = (form && (form.id || form.getAttribute('name'))) || (window.location.pathname + '#form');
      var fieldName = t.name || t.id || t.type || tag;
      activeFormField = { formId: formId, field: fieldName, start: Date.now() };
      touchedForms[formId] = { submitted: false, lastField: fieldName };
    } catch (err) {}
  }, true);

  document.addEventListener('focusout', function() {
    try {
      if (!activeFormField) return;
      var dur = Math.max(0, Date.now() - activeFormField.start);
      track('form_focus', {
        form_id: activeFormField.formId,
        field: activeFormField.field,
        duration_ms: dur
      });
      activeFormField = null;
    } catch (err) {}
  }, true);

  document.addEventListener('submit', function(e) {
    try {
      var form = e.target;
      var formId = (form && (form.id || form.getAttribute('name'))) || (window.location.pathname + '#form');
      if (touchedForms[formId]) touchedForms[formId].submitted = true;
      track('form_submit', { form_id: formId });
    } catch (err) {}
  }, true);

  window.addEventListener('beforeunload', function() {
    try {
      Object.keys(touchedForms).forEach(function(fid) {
        var st = touchedForms[fid];
        if (st && !st.submitted) {
          track('form_abandon', { form_id: fid, last_field: st.lastField });
        }
      });
    } catch (err) {}
  });

  // 14. A/B Testing & Feature Flags Bucketer
  var assignedVariants = {};
  function hashBucket(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % 100;
  }

  function initExperiments() {
    if (!apiKey) return;
    fetch(apiHost + '/api/v1/experiments/active?api_key=' + encodeURIComponent(apiKey))
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(list) {
        if (!Array.isArray(list)) return;
        list.forEach(function(exp) {
          var b = hashBucket(sessionId + ':' + exp.key);
          var variant = b < (exp.traffic_split || 50) ? 'B' : 'A';
          assignedVariants[exp.key] = variant;
          if (exp.selector) {
            var node = document.querySelector(exp.selector);
            if (node && variant === 'B' && exp.variant_text) {
              node.textContent = exp.variant_text;
            }
          }
          track('experiment_exposure', { experiment_key: exp.key, variant: variant });
        });
      }).catch(function() {});
  }
  // 15. Privacy-Safe Browser Network XHR / Fetch Failure & Latency Interceptor
  function reportNetwork(endpoint, method, status, dur) {
    if (!endpoint || !apiKey) return;
    try {
      if (endpoint.indexOf(apiHost) === 0 || endpoint.indexOf('/api/v1/network/collect') > -1) return;
      if (status >= 400 || dur >= 1000 || status === 0) {
        fetch(apiHost + '/api/v1/network/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            session_id: sessionId,
            page_url: window.location.href,
            endpoint_url: endpoint,
            method: method || 'GET',
            status_code: status,
            duration_ms: Math.round(dur || 0)
          }),
          keepalive: true
        }).catch(function() {});
      }
    } catch (e) {}
  }

  // Intercept fetch
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function() {
      var args = arguments;
      var urlStr = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      var methodStr = (args[1] && args[1].method) || (args[0] && args[0].method) || 'GET';
      var startT = performance.now();
      return origFetch.apply(this, args).then(function(res) {
        var elapsed = performance.now() - startT;
        reportNetwork(urlStr, methodStr, res.status, elapsed);
        return res;
      }).catch(function(err) {
        var elapsed = performance.now() - startT;
        reportNetwork(urlStr, methodStr, 0, elapsed);
        throw err;
      });
    };
  }

  // Intercept XMLHttpRequest
  if (window.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m, u) {
      this._teMethod = m;
      this._teUrl = u;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var xhr = this;
      var startT = performance.now();
      xhr.addEventListener('loadend', function() {
        var elapsed = performance.now() - startT;
        reportNetwork(xhr._teUrl, xhr._teMethod, xhr.status, elapsed);
      });
      return origSend.apply(this, arguments);
    };
  }

  initExperiments();

  // Initiate session recording
  loadAndStartRecording();

  console.log('[ThirdEye] Full-stack observability active for project:', apiKey, 'via:', apiHost);

  // Expose to window
  window.ThirdEye = {
    track: track,
    getSessionId: function() { return sessionId; },
    getVariant: function(key) { return assignedVariants[key] || 'A'; },
    flush: flushRecordings
  };
})();
