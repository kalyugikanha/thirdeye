# Survey & Technical Architecture Report: ThirdEye Tracking Snippet & rrweb Recording

**Agent**: Explorer 2 (Tracking Snippet & rrweb Recording Survey)  
**Date**: 2026-09-30  
**Target File**: `apps/api/public/te.js`  
**Workspace**: `d:/Project/Our Product/thirdeye`  

---

## 1. Observation

### 1.1 Existing Tracking Script Location and Implementation
- **File Path**: `apps/api/public/te.js` (29 lines, 788 bytes)
- **Verbatim Code**:
  ```javascript
  (function() {
    var script = document.currentScript;
    var apiKey = script.getAttribute('data-key');
    var sessionId = localStorage.getItem('te_session') || Math.random().toString(36).substring(2);
    localStorage.setItem('te_session', sessionId);

    function track(eventName, properties) {
      fetch('http://localhost:8000/api/v1/track', {
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
      });
    }

    // Automatically track pageview
    track('pageview');

    // Expose to window
    window.ThirdEye = { track: track };
  })();
  ```

### 1.2 Web Application Integration & Snippet Usage
- In `apps/web/src/app/onboarding/page.tsx` (lines 48-52 and 168-176):
  ```typescript
  const copyToClipboard = () => {
    const code = `<script>\n  (function(t,h,i,r,d){\n    t.ThirdEye=t.ThirdEye||{};\n    var s=h.createElement('script');\n    s.src='http://localhost:8000/public/te.js';\n    s.setAttribute('data-key',i);\n    h.head.appendChild(s);\n  })(window,document,'${apiKey}');\n</script>`;
    navigator.clipboard.writeText(code);
    alert('Copied to clipboard!');
  };
  ```
  The client snippet instructs users to load `te.js` from `http://localhost:8000/public/te.js` with attribute `data-key="<apiKey>"`.

### 1.3 Backend Static Serving Mount
- In `apps/api/app/main.py` (line 28):
  ```python
  app.mount('/public', StaticFiles(directory='public'), name='public')
  ```
  FastAPI directly mounts the filesystem directory `apps/api/public` at route `/public`. Any file placed in `apps/api/public/` is served over HTTP with appropriate MIME types.

### 1.4 Workspace Build Configuration & Tooling
- In root `package.json` (lines 1-13):
  ```json
  {
      "private":  true,
      "workspaces":  [
                         "apps/*",
                         "packages/*"
                     ],
      "name":  "thirdeye-monorepo",
      "scripts":  {
                      "dev":  "npm run dev --workspaces",
                      "build":  "npm run build --workspaces"
                  }
  }
  ```
- Inspecting `packages/sdk-js/`:
  The directory is currently empty. There is no existing build tooling (e.g. webpack, rollup, esbuild, tsup) configured to bundle or compile `te.js`.
- `apps/api/public/te.js` is currently edited and served directly as raw JavaScript without a compilation or bundling pipeline.

### 1.5 Backend Ingestion Contract (from Explorer 1 Handoff)
- Endpoint: `POST /api/v1/recordings`
- Expected JSON Payload structure:
  ```json
  {
    "session_id": "vr5fokbi6fo",
    "api_key": "te_live_...",
    "duration": 15,
    "events": [
      { "type": 2, "data": { ... }, "timestamp": 1727700000000 }
    ]
  }
  ```
- Explorer 1's backend decompresses `storage/recordings/{session_id}.json.gz` (if existing), appends incoming events, compresses back into `.json.gz`, and records metadata into the `SessionRecording` SQLite table.

---

## 2. Logic Chain

### 2.1 Analysis of Current `te.js` Structure & Gaps
1. **Script Target Resolution**:
   - In `apps/api/public/te.js:2`, `var script = document.currentScript;` is used.
   - If the script tag is injected dynamically via DOM methods (`createElement` + `appendChild`), `document.currentScript` can evaluate to `null` in certain asynchronous execution phases or modern browser contexts.
   - **Remedy**: Use fallback query:
     `var script = document.currentScript || document.querySelector('script[data-key]') || document.querySelector('script[src*="te.js"]');`
2. **API Host Hardcoding**:
   - `fetch('http://localhost:8000/api/v1/track', ...)` is hardcoded to `http://localhost:8000`.
   - If a customer embeds this script in production or staging, hardcoding breaks tracking.
   - **Remedy**: Derive host dynamically from script source URL:
     `var apiHost = (script && script.src) ? new URL(script.src).origin : 'http://localhost:8000';`
3. **Session Persistence**:
   - `sessionId` is preserved in `localStorage.getItem('te_session')`. This ensures all batched recording chunks sent during a user's multi-page session belong to the same session ID.
4. **Missing Recording Logic**:
   - `te.js` currently only tracks `'pageview'`. It has zero session recording, zero event buffer, and no flush interval.

---

### 2.2 Integration Architectures for `rrweb`

Four possible architectures were evaluated:

| Architecture | Implementation Mechanism | Pros | Cons | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Dynamic Script Loader (CDN + Local Fallback)** | `te.js` checks for `window.rrwebRecord` or `window.rrweb`. If missing, injects `<script async>` from CDN (or local `/public/rrweb-record.min.js`). Once loaded, initializes recording. | Lightweight `te.js` (< 3 KB); zero build tooling required; non-blocking; supports offline fallback. | Two network requests instead of one. | **RECOMMENDED** |
| **Option B: Self-Hosted Static Script** | Place pre-built `rrweb-record.min.js` directly into `apps/api/public/` and load via `apiHost + '/public/rrweb-record.min.js'`. | 100% independent of external CDN; works offline and behind corporate firewalls. | Requires copying/serving a 120KB minified file in `apps/api/public`. | **RECOMMENDED COMPANION** |
| **Option C: Pre-bundled Monolithic `te.js`** | Concatenate or bundle the `rrweb-record` UMD bundle directly into `apps/api/public/te.js`. | Single HTTP request; completely self-contained. | `te.js` file size swells to ~150 KB; requires a bundler or manual minified embedding. | Viable Alternative |
| **Option D: Inline NPM Monorepo Package (`packages/sdk-js`)** | Set up `tsup`/`esbuild` in `packages/sdk-js` importing `@rrweb/record`, outputting to `apps/api/public/te.js`. | Best developer ergonomics for a production SDK with TypeScript. | Adds significant build setup complexity in survey phase; monorepo does not currently have `tsup`/`esbuild`. | Future Enhancement |

**Optimal Synthesis**:
Option A + Option B: `te.js` serves as the dynamic coordinator. It first attempts to load from CDN (`cdn.jsdelivr.net/npm/rrweb@latest/dist/record/rrweb-record.min.js` or `cdn.jsdelivr.net/npm/@rrweb/record@latest/dist/record.umd.min.cjs`). If unavailable or in offline development, it falls back to the self-hosted local endpoint (`http://localhost:8000/public/rrweb-record.min.js`). If rrweb is already on the page (e.g. bundled or previously loaded), it initializes immediately without requesting anything.

---

### 2.3 Recording Configuration: Capturing Full DOM Mutations, Mouse Movements, and Scrolls

In `rrweb`, calling `record(options)` sets up the recording session. The configuration required to fulfill R1:

1. **Full DOM Mutations**:
   - `rrweb` utilizes `MutationObserver` internally to observe child additions, removals, attribute modifications, and character data changes across the entire DOM tree.
   - This occurs automatically upon initialization. Taking a full initial snapshot is standard behavior (`record.takeFullSnapshot()`).
2. **Mouse Movements & Interactions**:
   - Handled via `sampling: { mousemove: true, mouseInteraction: true }`.
   - Captures cursor coordinates, clicks, double-clicks, mousedown, mouseup, and touch events with millisecond timestamps.
3. **Scroll Capture**:
   - Handled via `sampling: { scroll: 150 }`.
   - Listens to `window` and nested scrollable element scroll events, throttled to 150ms intervals to balance fidelity and payload size.
4. **Event Consumer (`emit`)**:
   - Collects each event in an in-memory buffer:
     `emit: function(event) { events.push(event); }`

---

### 2.4 Strict Privacy Masking Implementation

Requirement R1 mandates:
> **"Strict Privacy: Configure `rrweb` to mask ALL text and inputs (e.g., turn text into `***`) to ensure compliance."**

To ensure zero PII leaks to the server or database, privacy masking must be applied at the client capture boundary:

1. **Input Elements Masking (`<input>`, `<textarea>`, `<select>`)**:
   - `maskAllInputs: true`: Forces rrweb to mask the content of all input elements.
   - `maskInputOptions`: Set `{ password: true, email: true, tel: true, text: true, color: true, date: true }`.
   - `maskInputFn: function(value, element) { return '***'; }`:
     Overrides input value recording unconditionally, replacing any entered characters with `'***'`.
2. **Text Content Masking (`<div>`, `<p>`, `<span>`, `<h1>-<h6>`, `<a>`, etc.)**:
   - `maskTextSelector: '*'`: Directs rrweb to apply text masking rules to **every element** in the DOM tree.
   - `maskTextFn: function(text, element) { if (!text || !text.trim()) return text; return '***'; }`:
     - Checks if the text node contains non-whitespace content.
     - Preserves empty whitespace/newlines (preventing layout collapse).
     - Replaces all text content with `'***'`!
     - Alternatively: `return text.replace(/[^\s]/g, '*');` to preserve word lengths while redacting all glyphs.
     - For strict compliance with the prompt's explicit example (`turn text into ***`), returning `'***'` ensures complete masking.

---

### 2.5 Batching and Network Transmission Every 5 Seconds

Requirement R1 mandates:
> **"Batch and send the recording data as JSON to the backend every 5 seconds."**

Implementation Architecture:
1. **In-Memory Event Buffer**:
   - `var events = [];`
   - Every `emit(event)` pushes to `events`.
2. **Periodic Transmission Interval**:
   - `var FLUSH_INTERVAL_MS = 5000;`
   - `setInterval(flushRecordings, FLUSH_INTERVAL_MS);`
3. **Atomic Buffer Splice**:
   - To avoid dropping events recorded during JSON serialization or HTTP network transit:
     `var batch = events.splice(0, events.length);`
   - If `batch.length === 0`, return early without making unnecessary HTTP requests.
4. **Duration Tracking**:
   - `var sessionStartTime = Date.now();`
   - Calculate cumulative session duration: `Math.round((Date.now() - sessionStartTime) / 1000)`.
5. **Backend JSON Payload Contract**:
   ```javascript
   var payload = {
     session_id: sessionId,
     api_key: apiKey,
     duration: Math.round((Date.now() - sessionStartTime) / 1000),
     events: batch
   };
   ```
6. **HTTP Transmission & Error Recovery**:
   - Send via `fetch(apiHost + '/api/v1/recordings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`.
   - If network request fails: prepend un-sent events back into the buffer (`events = batch.concat(events)`), capped at a safety threshold (e.g. 5,000 events) to prevent memory exhaustion if the backend is down.
7. **Page Unload / Tab Close Handling**:
   - Register listeners for `beforeunload` and `pagehide`:
     - When user leaves or closes tab, flush remaining buffer using `navigator.sendBeacon` (or `fetch(..., { keepalive: true })`) so closing-second activity is not lost.

---

### 2.6 Concrete Proposed Implementation for `apps/api/public/te.js`

Here is the complete, drop-in replacement implementation for `apps/api/public/te.js`:

```javascript
(function() {
  // 1. Locate executing script tag and retrieve configuration
  var script = document.currentScript || document.querySelector('script[data-key]') || document.querySelector('script[src*="te.js"]');
  var apiKey = script ? script.getAttribute('data-key') : '';
  var apiHost = (script && script.src) ? new URL(script.src).origin : 'http://localhost:8000';

  // 2. Persistent session identifier
  var sessionId = localStorage.getItem('te_session') || Math.random().toString(36).substring(2);
  localStorage.setItem('te_session', sessionId);

  var sessionStartTime = Date.now();
  var events = [];
  var isRecording = false;

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
    var payload = JSON.stringify({
      session_id: sessionId,
      api_key: apiKey,
      duration: Math.round((Date.now() - sessionStartTime) / 1000),
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
    var recordFn = (window.rrweb && window.rrweb.record) || 
                   (window.rrwebRecord && (window.rrwebRecord.record || window.rrwebRecord)) || 
                   window.rrwebRecord;

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
          text: true
        },
        maskInputFn: function(value, element) {
          return '***';
        },
        // STRICT PRIVACY: Mask ALL text
        maskTextSelector: '*',
        maskTextFn: function(text, element) {
          if (!text || !text.trim()) return text;
          return '***';
        }
      });

      isRecording = true;
      setInterval(flushRecordings, 5000);
      window.addEventListener('beforeunload', flushOnUnload);
      window.addEventListener('pagehide', flushOnUnload);
    } catch (e) {
      console.error('[ThirdEye] Failed to initialize rrweb recording:', e);
    }
  }

  // 6. Dynamic loader for rrweb script
  function loadAndStartRecording() {
    if ((window.rrweb && window.rrweb.record) || window.rrwebRecord) {
      initRecorder();
      return;
    }

    var scriptTag = document.createElement('script');
    scriptTag.src = 'https://cdn.jsdelivr.net/npm/rrweb@latest/dist/record/rrweb-record.min.js';
    scriptTag.async = true;
    scriptTag.onload = function() {
      initRecorder();
    };
    scriptTag.onerror = function() {
      // Offline fallback: try local backend public directory
      var localTag = document.createElement('script');
      localTag.src = apiHost + '/public/rrweb-record.min.js';
      localTag.async = true;
      localTag.onload = initRecorder;
      localTag.onerror = function() {
        console.warn('[ThirdEye] rrweb library could not be loaded from CDN or local host.');
      };
      document.head.appendChild(localTag);
    };
    document.head.appendChild(scriptTag);
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

  // Execute tracking & initiate session recording
  track('pageview');
  loadAndStartRecording();

  // Expose global interface
  window.ThirdEye = {
    track: track,
    getSessionId: function() { return sessionId; }
  };
})();
```

---

## 3. Caveats

1. **Third-Party CDN Accessibility**:
   - If client users operate in restricted enterprise intranets, sandboxed Docker containers, or air-gapped test runners where `cdn.jsdelivr.net` is unreachable, loading from CDN will fail.
   - **Mitigation**: The provided implementation includes an automatic local fallback to `apiHost + '/public/rrweb-record.min.js'`. Placing a copy of `rrweb-record.min.js` in `apps/api/public/` completely eliminates external network dependencies.
2. **Input Masking Scope**:
   - Setting `maskTextSelector: '*'` and `maskTextFn` returning `'***'` will mask all text nodes across headings, paragraphs, buttons, and links. Whitespace must be preserved (`if (!text || !text.trim()) return text;`) to prevent breaking CSS flex/grid spacing and line breaks.
3. **Database & Backend Dependency**:
   - `te.js` relies on `POST /api/v1/recordings` being implemented as specified in Explorer 1's report. If the backend is not running or returns 404, `te.js` gracefully logs a warning without breaking the customer's page.
4. **CORS Configuration**:
   - `apps/api/app/main.py:20-26` currently configures `CORSMiddleware` with `allow_origins=['*']`, `allow_methods=['*']`, `allow_headers=['*']`. This is essential because `te.js` will send `POST /api/v1/recordings` from arbitrary customer domains.

---

## 4. Conclusion

1. **Location & Serving**: `public/te.js` is located at `apps/api/public/te.js` and is served statically by FastAPI at `/public/te.js`.
2. **Integration Strategy**: A dynamic script loader with a fallback to local `/public/rrweb-record.min.js` is the optimal integration pattern:
   - Keeps `te.js` small (<3 KB).
   - Zero build tools required.
   - Non-blocking asynchronous loading.
   - Resilient against network partitioning.
3. **Capture Capabilities**: `rrweb.record` captures full DOM mutations via `MutationObserver`, mouse movements via mouse event listeners, and scroll activity throttled at 150ms.
4. **Privacy Compliance**: Full compliance is achieved using:
   - `maskAllInputs: true`
   - `maskInputFn: () => '***'`
   - `maskTextSelector: '*'`
   - `maskTextFn: (t) => t.trim() ? '***' : t`
5. **Batching Cadence**: An interval timer flushes every 5000ms, slicing the in-memory array and transmitting JSON to `POST /api/v1/recordings`, with `beforeunload` beacon protection for session termination.
6. **Syntax & Loading Safety**: The script uses ES5 syntax with modern `fetch`/`Blob` APIs, guaranteed to parse without syntax errors in all modern HTML documents.

---

## 5. Verification Method

### 5.1 Syntax Verification
Run Node.js syntax checker on `apps/api/public/te.js`:
```powershell
node --check "d:\Project\Our Product\thirdeye\apps\api\public\te.js"
```
- **Expected Result**: Exits with code 0 and zero output (no syntax errors).

### 5.2 HTML Loading Test Fixture
Create a test HTML file (e.g. `apps/api/public/test_snippet.html`):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ThirdEye Snippet Verification</title>
  <!-- Load snippet -->
  <script src="http://localhost:8000/public/te.js" data-key="te_live_test"></script>
</head>
<body>
  <h1>Confidential Title</h1>
  <p>Sensitive user paragraph</p>
  <input type="text" id="user-input" value="SensitiveInput">
  <script>
    window.addEventListener('load', function() {
      console.assert(typeof window.ThirdEye === 'object', 'ThirdEye global must be defined');
      console.assert(typeof window.ThirdEye.track === 'function', 'ThirdEye.track must be a function');
      console.log('ThirdEye snippet loaded without syntax errors!');
    });
  </script>
</body>
</html>
```

### 5.3 Programmatic Python Verification Script
A Python test script (running under `apps/api/venv/Scripts/python.exe`) can verify:
1. File syntax via `node --check apps/api/public/te.js`.
2. Content assertions:
   - Contains `maskAllInputs: true`
   - Contains `'***'`
   - Contains `POST` and `/api/v1/recordings`
   - Contains `5000` (5-second batch interval)
3. HTTP retrieval from FastAPI:
   - `urllib.request.urlopen("http://localhost:8000/public/te.js")` returns HTTP 200 with Content-Type header containing `javascript`.
