"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import {
  Layers,
  Plus,
  Copy,
  Check,
  Smartphone,
  Building2,
  Globe2,
  Server,
  ShieldCheck,
  Code2,
  Loader2,
  Lock
} from 'lucide-react';

interface AppItem {
  id: number;
  name: string;
  domain: string;
  api_key: string;
  app_type: string;
  platform: string;
  mask_all_inputs: boolean;
  dns_verified: boolean;
  event_count: number;
  recording_count: number;
}

export default function ApplicationsHubPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [appType, setAppType] = useState<'web' | 'internal_portal' | 'mobile_app' | 'backend_api'>('internal_portal');
  const [platform, setPlatform] = useState<'browser' | 'react_native' | 'flutter' | 'android' | 'ios' | 'nodejs' | 'python'>('browser');
  const [maskAll, setMaskAll] = useState(true);

  const [sdkTab, setSdkTab] = useState<'portal' | 'react_native' | 'flutter' | 'native' | 'backend' | 'proxy'>('portal');
  const [copied, setCopied] = useState(false);

  const fetchApps = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/applications'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setApps(list);
        if (list.length > 0 && !selectedApp) {
          setSelectedApp(list[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !domain) return;
    const token = localStorage.getItem('te_token');
    setCreating(true);
    try {
      const res = await fetch(apiUrl('/api/v1/applications'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          domain,
          app_type: appType,
          platform,
          mask_all_inputs: maskAll
        })
      });
      if (res.ok) {
        const created = await res.json();
        setName('');
        setDomain('');
        await fetchApps();
        setSelectedApp(created);
      }
    } finally {
      setCreating(false);
    }
  };

  const activeKey = selectedApp?.api_key || 'te_live_your_api_key';

  const getSnippet = () => {
    if (sdkTab === 'portal') {
      return `<!-- 1. Add to your Internal Portal / Admin Dashboard <head> -->
<script
  src="https://thirdeye.colladome.com/public/te.js"
  data-key="${activeKey}"
  data-mask-all="${selectedApp?.mask_all_inputs ? 'true' : 'false'}"
  data-app-version="1.0.0"
  defer
></script>

<script>
  // 2. Call on Employee / Admin Login (Links all replays, clicks & errors to this employee)
  window.addEventListener('load', function () {
    if (window.ThirdEye) {
      window.ThirdEye.identify("emp_101", {
        email: "admin@company.com",
        name: "Rahul Sharma",
        role: "Finance_Admin",
        department: "Accounts",
        portal: "Internal_ERP"
      });
    }
  });

  // 3. Call on Sensitive Admin Operations (Auto-alerts Slack/Email if risk_level is 'high' or 'critical')
  function onExportCustomerCsv() {
    window.ThirdEye?.audit("export_customer_csv", {
      target: "customers_table (15,000 rows)",
      risk_level: "high" // 'low' | 'medium' | 'high' | 'critical'
    });
  }

  // 4. Call on Employee Logout
  function onLogout() {
    window.ThirdEye?.reset();
  }
</script>`;
    }

    if (sdkTab === 'react_native') {
      return `// ThirdEyeMobile.ts — Zero-dependency React Native / Expo SDK
const THIRDEYE_KEY = "${activeKey}";
const THIRDEYE_HOST = "https://thirdeye.colladome.com";

export const ThirdEyeMobile = {
  sessionId: "rn_" + Math.random().toString(36).slice(2),
  user: { id: null as string | null, email: null as string | null },

  identify(userId: string, email?: string) {
    this.user = { id: userId, email: email || null };
  },

  async trackScreen(screenName: string, appVersion = "1.0.0", deviceModel = "ReactNative") {
    await fetch(\`\${THIRDEYE_HOST}/api/v1/app/telemetry\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: THIRDEYE_KEY,
        type: "screen_view",
        session_id: this.sessionId,
        user_id: this.user.id,
        user_email: this.user.email,
        platform: "react_native",
        app_version: appVersion,
        device_model: deviceModel,
        screen_name: screenName
      })
    }).catch(() => {});
  },

  async reportCrash(error: Error, screenName = "UnknownScreen", isANR = false) {
    await fetch(\`\${THIRDEYE_HOST}/api/v1/app/telemetry\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: THIRDEYE_KEY,
        type: isANR ? "anr" : "crash",
        session_id: this.sessionId,
        user_id: this.user.id,
        user_email: this.user.email,
        platform: "react_native",
        app_version: "1.0.0",
        screen_name: screenName,
        message: error.message,
        stack_trace: error.stack || ""
      })
    }).catch(() => {});
  }
};`;
    }

    if (sdkTab === 'flutter') {
      return `// third_eye_flutter.dart — Flutter Mobile App Telemetry & Crash Hook
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';

class ThirdEyeFlutter {
  static const String apiKey = "${activeKey}";
  static const String endpoint = "https://thirdeye.colladome.com/api/v1/app/telemetry";
  static String sessionId = "flt_\${DateTime.now().millisecondsSinceEpoch}";
  static String? userId;
  static String? userEmail;

  static void initCrashHandler() {
    FlutterError.onError = (FlutterErrorDetails details) {
      reportCrash(details.exceptionAsString(), details.stack.toString());
    };
  }

  static Future<void> trackScreen(String screenName, {String version = "1.0.0", String device = "FlutterDevice"}) async {
    await http.post(
      Uri.parse(endpoint),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "api_key": apiKey,
        "type": "screen_view",
        "session_id": sessionId,
        "user_id": userId,
        "user_email": userEmail,
        "platform": "flutter",
        "app_version": version,
        "device_model": device,
        "screen_name": screenName,
      }),
    );
  }

  static Future<void> reportCrash(String message, String stackTrace, {String screenName = "Main"}) async {
    await http.post(
      Uri.parse(endpoint),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "api_key": apiKey,
        "type": "crash",
        "session_id": sessionId,
        "user_id": userId,
        "user_email": userEmail,
        "platform": "flutter",
        "app_version": "1.0.0",
        "screen_name": screenName,
        "message": message,
        "stack_trace": stackTrace,
      }),
    );
  }
}`;
    }

    if (sdkTab === 'native') {
      return `// Android (Kotlin) — Global Unhandled Crash & Screen Reporter
Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
    val json = """
    {
      "api_key": "${activeKey}",
      "type": "crash",
      "platform": "android",
      "app_version": "1.0.0",
      "device_model": "\${android.os.Build.MODEL}",
      "os_version": "Android \${android.os.Build.VERSION.RELEASE}",
      "message": "\${throwable.message}",
      "stack_trace": "\${throwable.stackTraceToString().take(1500)}"
    }
    """.trimIndent()
    // POST json to https://thirdeye.colladome.com/api/v1/app/telemetry
}

// iOS (Swift) — Screen View & Crash Telemetry
func reportThirdEyeScreen(screen: String, userId: String?) {
    let url = URL(string: "https://thirdeye.colladome.com/api/v1/app/telemetry")!
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let body: [String: Any] = [
        "api_key": "${activeKey}",
        "type": "screen_view",
        "platform": "ios",
        "app_version": "1.0.0",
        "screen_name": screen,
        "user_id": userId ?? "anonymous"
    ]
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    URLSession.shared.dataTask(with: req).resume()
}`;
    }

    if (sdkTab === 'backend') {
      return `# Python FastAPI — HTTP Endpoint + Slow SQL Database Query APM Tracer
import time, json, urllib.request

THIRDEYE_KEY = "${activeKey}"

@app.middleware("http")
async def thirdeye_apm_middleware(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = int((time.time() - start) * 1000)
    if duration_ms > 200 or response.status_code >= 400:
        payload = json.dumps({
            "api_key": THIRDEYE_KEY,
            "service_name": "fastapi-backend",
            "trace_type": "http",
            "endpoint": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "duration_ms": duration_ms
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://thirdeye.colladome.com/api/v1/apm/report",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        try: urllib.request.urlopen(req, timeout=2)
        except Exception: pass
    return response`;
    }

    return `# Intranet / Behind-VPN Nginx Reverse Proxy (Zero external firewall exposure)
location /_te/ {
    proxy_pass https://thirdeye.colladome.com/;
    proxy_ssl_server_name on;
    proxy_set_header Host thirdeye.colladome.com;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

<!-- Then in your internal portal HTML, set data-endpoint="/_te" -->
<script
  src="/_te/public/te.js"
  data-key="${activeKey}"
  data-endpoint="/_te"
  data-mask-all="true"
  defer
></script>`;
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">
                  Applications, Internal Portals &amp; Mobile SDK Hub
                </h1>
                <p className="text-xs text-slate-500">
                  Register multiple applications (Public Web, Internal CRM/Admin Portals, React Native / Flutter Mobile Apps, Backend APIs) under your workspace.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Create & Select Application */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-4">
                  Register New Portal or Mobile App
                </h2>
                <form onSubmit={handleCreateApp} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Application Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SelfUp Internal Admin CRM / SelfUp iOS App"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Domain or App Bundle ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. admin.company.com or com.company.mobileapp"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">App Type</label>
                      <select
                        value={appType}
                        onChange={(e) => setAppType(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="internal_portal">Internal Portal / Admin</option>
                        <option value="mobile_app">Mobile App (iOS/Android)</option>
                        <option value="web">Public Web App</option>
                        <option value="backend_api">Backend Microservice</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Platform / Framework</label>
                      <select
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="browser">Web / React / Next.js</option>
                        <option value="react_native">React Native / Expo</option>
                        <option value="flutter">Flutter (Dart)</option>
                        <option value="android">Android (Kotlin)</option>
                        <option value="ios">iOS (Swift)</option>
                        <option value="python">Python (FastAPI/Django)</option>
                        <option value="nodejs">Node.js (Express/Nest)</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maskAll}
                      onChange={(e) => setMaskAll(e.target.checked)}
                    />
                    <div>
                      <span className="font-bold text-slate-800">Enforce Strict PII Input Masking (`data-mask-all`)</span>
                      <p className="text-[11px] text-slate-500">Recommended for internal HR, Finance, and Admin portals</p>
                    </div>
                  </label>
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Create Application &amp; Generate API Key</span>
                  </button>
                </form>
              </div>

              {/* Existing Applications List */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Your Registered Applications ({apps.length})
                </h2>
                {loading ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Loading applications...</p>
                ) : (
                  <div className="space-y-2.5">
                    {apps.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => setSelectedApp(app)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          selectedApp?.id === app.id
                            ? 'bg-blue-50/60 border-blue-500 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-xs text-slate-900">{app.name}</div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                            {app.app_type} • {app.platform}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-1 truncate">
                          Key: {app.api_key}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                          <span>{app.event_count.toLocaleString()} events</span>
                          <span>{app.recording_count.toLocaleString()} replays</span>
                          {app.mask_all_inputs && <span className="text-emerald-600 font-bold">PII Guard Active</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Ready-to-Paste SDKs */}
            <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-slate-900">
                    Integration SDKs for: <span className="text-blue-600">{selectedApp?.name || 'Default Project'}</span>
                  </h2>
                  <p className="text-xs font-mono text-slate-500">API Key: {activeKey}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(getSnippet());
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied SDK Code!' : 'Copy SDK Snippet'}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                {[
                  { id: 'portal', label: '1. Internal Portal (identify + audit)' },
                  { id: 'react_native', label: '2. React Native / Expo' },
                  { id: 'flutter', label: '3. Flutter (Dart)' },
                  { id: 'native', label: '4. Android & iOS Native' },
                  { id: 'backend', label: '5. Backend & DB APM' },
                  { id: 'proxy', label: '6. Intranet Reverse-Proxy' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSdkTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      sdkTab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <pre className="p-5 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-[540px]">
                {getSnippet()}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
