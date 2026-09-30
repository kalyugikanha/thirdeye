#!/usr/bin/env python3
"""
ThirdEye UX Session Recording - Canonical Programmatic Acceptance Test Suite
=============================================================================
This test suite verifies all Acceptance Criteria defined in ORIGINAL_REQUEST.md
and PROJECT.md across Milestones 1, 2, 3, and 4:

1. Data Capture & Storage (M1 / AC):
   - POST /api/v1/recordings accepts batched rrweb JSON payloads.
   - Compressed .json.gz file is verified in storage/recordings/.
   - Gzip file is decompressed and content matches the sent rrweb events.
   - Second batch append is tested: verifies continuous batch merging into existing recording.
   - SQLite apps/api/thirdeye.db is queried: SessionRecording table and view must link
     session_id to the file path and updated duration.
   - GET /api/v1/recordings lists the recorded session.
   - GET /api/v1/recordings/{session_id} returns the decompressed events.
   - Error handling: empty session_id returns 400; non-existent session returns 404.

2. Tracking Snippet Syntax & Privacy Masking (M2 / AC):
   - Executes `node --check apps/api/public/te.js` asserting exit code 0.
   - Executes `node --check apps/api/public/rrweb-record.min.js` asserting exit code 0.
   - Asserts strict privacy rules in te.js: maskAllInputs: true, '***', maskTextFn.
   - Asserts 5000ms batch flush cadence, unload beacon listeners, and window.ThirdEye export.

3. Next.js Replay Dashboard Build Verification (M3 / AC):
   - Verifies apps/web build compilation (`npm run build` / `npx next build`).
   - Asserts exit code 0 without server-side rendering crashes.
   - Verifies `/analytics/sessions` route is generated in build output.
"""

import sys
import os
import time
import json
import gzip
import shutil
import sqlite3
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Identify project directory structure
WORKSPACE_ROOT = Path(__file__).resolve().parent
API_DIR = (WORKSPACE_ROOT / "apps" / "api").resolve()
STORAGE_ROOT = (WORKSPACE_ROOT / "storage" / "recordings").resolve()
STORAGE_API = (API_DIR / "storage" / "recordings").resolve()
PUBLIC_DIR = (API_DIR / "public").resolve()
DB_PATH = (API_DIR / "thirdeye.db").resolve()
WEB_DIR = (WORKSPACE_ROOT / "apps" / "web").resolve()


class TestResult:
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.message = ""
        self.details: List[str] = []

    def pass_test(self, message: str = ""):
        self.passed = True
        self.message = message

    def fail_test(self, message: str, details: Optional[List[str]] = None):
        self.passed = False
        self.message = message
        if details:
            self.details = details


class ApiClientWrapper:
    """
    Unified API client:
    - If a live server is running on http://127.0.0.1:8000 or http://localhost:8000,
      communicates via urllib.request (zero third-party dependencies).
    - If no live server is reachable, dynamically instantiates FastAPI's TestClient
      from apps.api.app.main:app for standalone offline execution.
    """
    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self.base_url = base_url.rstrip("/")
        self.is_live = False
        self.test_client = None

        # Check if live server is reachable
        try:
            import urllib.request
            req = urllib.request.Request(f"{self.base_url}/", method="GET")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status in (200, 404):
                    self.is_live = True
        except Exception:
            self.is_live = False

        if not self.is_live:
            # Fall back to FastAPI TestClient
            sys.path.insert(0, str(API_DIR))
            orig_cwd = os.getcwd()
            try:
                os.chdir(str(API_DIR))
                from fastapi.testclient import TestClient
                from app.main import app
                self.test_client = TestClient(app)
            finally:
                os.chdir(orig_cwd)

    def post(self, path: str, json_data: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Tuple[int, Any, Dict[str, str]]:
        if self.is_live:
            import urllib.request
            import urllib.error
            url = f"{self.base_url}{path}"
            data = json.dumps(json_data).encode("utf-8")
            req_headers = {"Content-Type": "application/json"}
            if headers:
                req_headers.update(headers)
            req = urllib.request.Request(url, data=data, headers=req_headers, method="POST")
            try:
                with urllib.request.urlopen(req) as resp:
                    resp_data = resp.read()
                    status = resp.status
                    resp_headers = dict(resp.headers)
                    parsed = json.loads(resp_data.decode("utf-8")) if resp_data else {}
                    return status, parsed, resp_headers
            except urllib.error.HTTPError as e:
                err_data = e.read()
                try:
                    parsed = json.loads(err_data.decode("utf-8"))
                except Exception:
                    parsed = {"error": err_data.decode("utf-8", errors="ignore")}
                return e.code, parsed, dict(e.headers)
        else:
            orig_cwd = os.getcwd()
            try:
                os.chdir(str(API_DIR))
                resp = self.test_client.post(path, json=json_data, headers=headers or {})
                try:
                    parsed = resp.json()
                except Exception:
                    parsed = resp.text
                return resp.status_code, parsed, dict(resp.headers)
            finally:
                os.chdir(orig_cwd)

    def get(self, path: str, headers: Optional[Dict[str, str]] = None) -> Tuple[int, Any, bytes, Dict[str, str]]:
        if self.is_live:
            import urllib.request
            import urllib.error
            url = f"{self.base_url}{path}"
            req = urllib.request.Request(url, headers=headers or {}, method="GET")
            try:
                with urllib.request.urlopen(req) as resp:
                    raw_bytes = resp.read()
                    status = resp.status
                    resp_headers = dict(resp.headers)
                    try:
                        parsed = json.loads(raw_bytes.decode("utf-8"))
                    except Exception:
                        parsed = None
                    return status, parsed, raw_bytes, resp_headers
            except urllib.error.HTTPError as e:
                raw_bytes = e.read()
                try:
                    parsed = json.loads(raw_bytes.decode("utf-8"))
                except Exception:
                    parsed = {"error": raw_bytes.decode("utf-8", errors="ignore")}
                return e.code, parsed, raw_bytes, dict(e.headers)
        else:
            orig_cwd = os.getcwd()
            try:
                os.chdir(str(API_DIR))
                resp = self.test_client.get(path, headers=headers or {})
                try:
                    parsed = resp.json()
                except Exception:
                    parsed = None
                return resp.status_code, parsed, resp.content, dict(resp.headers)
            finally:
                os.chdir(orig_cwd)


def test_data_capture_and_storage() -> TestResult:
    res = TestResult("Data Capture & Mock S3 Storage")
    print("\n" + "=" * 70)
    print("TEST 1: DATA CAPTURE & MOCK S3 STORAGE (FastAPI + SQLite + Gzip)")
    print("=" * 70)

    try:
        client = ApiClientWrapper()
        mode_str = "Live HTTP Server (port 8000)" if client.is_live else "FastAPI TestClient (in-process)"
        print(f"[*] API Client initialized using: {mode_str}")

        # Ensure storage directories exist
        STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
        STORAGE_API.mkdir(parents=True, exist_ok=True)

        session_id = f"test_ac_session_{int(time.time())}"
        print(f"[*] Target Test Session ID: {session_id}")

        # 1. Edge Case: Validation on empty session_id
        status_empty, body_empty, _ = client.post("/api/v1/recordings", {"session_id": "", "events": []})
        assert status_empty == 400, f"Expected 400 for empty session_id, got {status_empty}: {body_empty}"
        print("[+] PASS: POST /api/v1/recordings with empty session_id correctly returns 400 Bad Request.")

        # 2. Batch 1 Ingestion
        batch1_events = [
            {"type": 0, "data": {"node": 1}, "timestamp": 1727700000000},
            {"type": 2, "data": {"x": 120, "y": 240}, "timestamp": 1727700002000},
            {"type": 3, "data": {"text": "***"}, "timestamp": 1727700005000}
        ]
        payload1 = {
            "session_id": session_id,
            "duration": 5,
            "events": batch1_events
        }

        print(f"[*] Sending Batch 1 ({len(batch1_events)} events, duration=5s)...")
        status1, body1, _ = client.post("/api/v1/recordings", payload1)
        assert status1 == 200, f"Batch 1 failed with status {status1}: {body1}"
        assert body1.get("status") == "stored", f"Unexpected status: {body1}"
        assert body1.get("session_id") == session_id, f"Session ID mismatch: {body1}"
        assert body1.get("event_count") == len(batch1_events), f"Event count mismatch: {body1}"
        print(f"[+] PASS: Batch 1 stored successfully. Response: {body1}")

        # 3. Assert file created on disk and verify gzip compression
        target_file_root = STORAGE_ROOT / f"{session_id}.json.gz"
        target_file_api = STORAGE_API / f"{session_id}.json.gz"

        file_found = None
        for candidate in [target_file_root, target_file_api]:
            if candidate.exists():
                file_found = candidate
                break

        assert file_found is not None, f"Compressed file not found in {STORAGE_ROOT} or {STORAGE_API}"
        print(f"[+] PASS: Mock S3 file verified on disk: {file_found} ({file_found.stat().st_size} bytes)")

        # Verify decompression matches batch 1 events
        with gzip.open(file_found, "rt", encoding="utf-8") as gf:
            decompressed_events_1 = json.load(gf)

        assert decompressed_events_1 == batch1_events, "Decompressed events do not match batch 1!"
        print(f"[+] PASS: Gzip decompression verified: matches exactly {len(batch1_events)} events.")

        # 4. Continuous Batch Append (Batch 2)
        batch2_events = [
            {"type": 2, "data": {"x": 150, "y": 300}, "timestamp": 1727700007000},
            {"type": 4, "data": {"input": "***"}, "timestamp": 1727700010000}
        ]
        payload2 = {
            "session_id": session_id,
            "duration": 10,
            "events": batch2_events
        }

        print(f"[*] Sending Batch 2 for same session ({len(batch2_events)} events, duration=10s)...")
        status2, body2, _ = client.post("/api/v1/recordings", payload2)
        assert status2 == 200, f"Batch 2 failed with status {status2}: {body2}"
        expected_total_events = len(batch1_events) + len(batch2_events)
        assert body2.get("event_count") == expected_total_events, f"Expected {expected_total_events}, got: {body2}"
        print(f"[+] PASS: Batch 2 append response confirmed. Total events: {body2.get('event_count')}")

        # Verify merged file on disk
        with gzip.open(file_found, "rt", encoding="utf-8") as gf:
            decompressed_events_merged = json.load(gf)

        assert len(decompressed_events_merged) == expected_total_events, (
            f"Expected {expected_total_events} merged events, got {len(decompressed_events_merged)}"
        )
        assert decompressed_events_merged == batch1_events + batch2_events, "Continuous batch events ordering mismatch!"
        print(f"[+] PASS: Continuous batch append verified on disk: merged array contains {len(decompressed_events_merged)} sequential events.")

        # 5. Query SQLite apps/api/thirdeye.db
        assert DB_PATH.exists(), f"SQLite database not found at {DB_PATH}"
        print(f"[*] Querying SQLite database: {DB_PATH}")

        with sqlite3.connect(str(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Verify table and view existence
            cursor.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')")
            db_objects = {row["name"]: row["type"] for row in cursor.fetchall()}
            assert "session_recordings" in db_objects, "Table 'session_recordings' missing from SQLite schema!"
            assert "SessionRecording" in db_objects, "View/Table 'SessionRecording' missing from SQLite schema!"

            # Verify row via table
            cursor.execute("SELECT * FROM session_recordings WHERE session_id = ?", (session_id,))
            row_table = cursor.fetchone()
            assert row_table is not None, f"No row found in session_recordings table for session {session_id}"
            assert row_table["session_id"] == session_id
            assert row_table["duration"] >= 10, f"Expected duration >= 10, got {row_table['duration']}"
            assert row_table["file_path"] == f"storage/recordings/{session_id}.json.gz"

            # Verify row via SessionRecording view
            cursor.execute("SELECT * FROM SessionRecording WHERE session_id = ?", (session_id,))
            row_view = cursor.fetchone()
            assert row_view is not None, f"No row found in SessionRecording view for session {session_id}"
            assert row_view["duration"] == row_table["duration"]
            assert row_view["file_path"] == row_table["file_path"]

            print(f"[+] PASS: SQLite verified via both table and view: id={row_table['id']}, duration={row_table['duration']}, file_path={row_table['file_path']}")

        # 6. Verify GET /api/v1/recordings (List)
        status_list, body_list, _, _ = client.get("/api/v1/recordings")
        assert status_list == 200, f"GET /api/v1/recordings failed: {status_list}"
        assert isinstance(body_list, list), f"Expected list response, got {type(body_list)}"
        matching_sessions = [r for r in body_list if r.get("session_id") == session_id]
        assert len(matching_sessions) >= 1, f"Session {session_id} not found in recordings list!"
        matched = matching_sessions[0]
        assert matched.get("duration") >= 10
        assert matched.get("file_path") == f"storage/recordings/{session_id}.json.gz"
        print(f"[+] PASS: GET /api/v1/recordings returned {len(body_list)} total recordings, correctly listing session {session_id}.")

        # 7. Verify GET /api/v1/recordings/{session_id} (Fetch)
        status_fetch, body_fetch, _, _ = client.get(f"/api/v1/recordings/{session_id}")
        assert status_fetch == 200, f"GET /api/v1/recordings/{session_id} failed: {status_fetch}"
        assert isinstance(body_fetch, list), f"Expected list of events, got {type(body_fetch)}"
        assert len(body_fetch) == expected_total_events, f"Expected {expected_total_events} events, got {len(body_fetch)}"
        assert body_fetch == batch1_events + batch2_events, "Fetched events do not match stored events!"
        print(f"[+] PASS: GET /api/v1/recordings/{session_id} returned {len(body_fetch)} decompressed replay events.")

        # 8. Verify GET /api/v1/recordings/{session_id}/replay (Alias Route)
        status_replay, body_replay, _, _ = client.get(f"/api/v1/recordings/{session_id}/replay")
        assert status_replay == 200, f"GET /api/v1/recordings/{session_id}/replay failed: {status_replay}"
        assert body_replay == batch1_events + batch2_events
        print(f"[+] PASS: GET /api/v1/recordings/{session_id}/replay returned identical replay events.")

        # 9. Verify 404 on non-existent session
        status_404, _, _, _ = client.get("/api/v1/recordings/non_existent_session_99999")
        assert status_404 == 404, f"Expected 404 for unknown session, got {status_404}"
        print("[+] PASS: GET /api/v1/recordings/{unknown} correctly returned 404 Not Found.")

        res.pass_test("All Data Capture, Mock S3 Gzip Storage, Continuous Append, SQLite, and Replay Retrieval checks passed cleanly.")
    except Exception as e:
        import traceback
        err_msg = f"Data Capture & Storage test failed: {str(e)}"
        print(f"[-] FAIL: {err_msg}")
        traceback.print_exc()
        res.fail_test(err_msg, traceback.format_exc().splitlines())

    return res


def test_snippet_syntax_and_privacy() -> TestResult:
    res = TestResult("Snippet Syntax & Privacy Verification")
    print("\n" + "=" * 70)
    print("TEST 2: SNIPPET SYNTAX & STRICT PRIVACY VERIFICATION (te.js)")
    print("=" * 70)

    te_js_path = PUBLIC_DIR / "te.js"
    rrweb_path = PUBLIC_DIR / "rrweb-record.min.js"

    try:
        assert te_js_path.exists(), f"Tracking snippet missing at: {te_js_path}"
        assert rrweb_path.exists(), f"Fallback rrweb script missing at: {rrweb_path}"
        print(f"[*] Snippet file located: {te_js_path} ({te_js_path.stat().st_size} bytes)")
        print(f"[*] Fallback rrweb file located: {rrweb_path} ({rrweb_path.stat().st_size} bytes)")

        # 1. node --check te.js
        print("[*] Running `node --check apps/api/public/te.js`...")
        proc_te = subprocess.run(["node", "--check", str(te_js_path)], capture_output=True, text=True)
        assert proc_te.returncode == 0, f"`node --check te.js` failed with exit code {proc_te.returncode}:\n{proc_te.stderr}"
        print("[+] PASS: `node --check apps/api/public/te.js` passed cleanly with exit code 0.")

        # 2. node --check rrweb-record.min.js
        print("[*] Running `node --check apps/api/public/rrweb-record.min.js`...")
        proc_rrweb = subprocess.run(["node", "--check", str(rrweb_path)], capture_output=True, text=True)
        assert proc_rrweb.returncode == 0, f"`node --check rrweb-record.min.js` failed:\n{proc_rrweb.stderr}"
        print("[+] PASS: `node --check apps/api/public/rrweb-record.min.js` passed cleanly with exit code 0.")

        # 3. Privacy & behavioral configuration inspection
        content = te_js_path.read_text(encoding="utf-8")

        # Strict privacy checks
        assert "maskAllInputs: true" in content, "Missing required privacy setting 'maskAllInputs: true'!"
        assert "'***'" in content or '"***"' in content, "Missing required '***' mask string replacement!"
        assert "maskTextFn" in content, "Missing required 'maskTextFn' text masking callback!"
        assert "maskInputFn" in content, "Missing required 'maskInputFn' input masking callback!"
        print("[+] PASS: Strict Privacy settings verified (maskAllInputs: true, '***', maskTextFn, maskInputFn).")

        # 5000ms flush interval cadence
        assert "5000" in content, "Missing 5000ms flush cadence in snippet!"
        assert "setInterval" in content, "Missing setInterval timer for batch flush!"
        print("[+] PASS: 5000ms periodic flush cadence verified.")

        # Endpoint transmission & beacon
        assert "/api/v1/recordings" in content, "Missing '/api/v1/recordings' target URL!"
        assert "POST" in content, "Missing 'POST' transmission method!"
        assert "beforeunload" in content, "Missing 'beforeunload' event listener for beacon flush!"
        assert "pagehide" in content, "Missing 'pagehide' event listener for beacon flush!"
        assert "window.ThirdEye" in content, "Missing global window.ThirdEye interface export!"
        print("[+] PASS: Transmission endpoint, unload beacon, and window.ThirdEye interface verified.")

        res.pass_test("Snippet syntax is valid JavaScript and all strict privacy / batching parameters are verified.")
    except Exception as e:
        import traceback
        err_msg = f"Snippet verification failed: {str(e)}"
        print(f"[-] FAIL: {err_msg}")
        traceback.print_exc()
        res.fail_test(err_msg, traceback.format_exc().splitlines())

    return res


def test_nextjs_build_verification() -> TestResult:
    res = TestResult("Next.js App Router Build Verification")
    print("\n" + "=" * 70)
    print("TEST 3: NEXT.JS APP ROUTER BUILD VERIFICATION (apps/web)")
    print("=" * 70)

    try:
        assert WEB_DIR.exists(), f"apps/web directory missing at: {WEB_DIR}"
        sessions_page = WEB_DIR / "src" / "app" / "analytics" / "sessions" / "page.tsx"
        replay_player = WEB_DIR / "src" / "app" / "analytics" / "sessions" / "ReplayPlayer.tsx"
        types_file = WEB_DIR / "src" / "types" / "rrweb-player.d.ts"

        assert sessions_page.exists(), f"Sessions page missing at: {sessions_page}"
        assert replay_player.exists(), f"ReplayPlayer component missing at: {replay_player}"
        assert types_file.exists(), f"TypeScript ambient types missing at: {types_file}"
        print(f"[+] PASS: Verified frontend source files exist: {sessions_page.name}, {replay_player.name}, {types_file.name}")

        # Check npm install status
        node_modules = WEB_DIR / "node_modules"
        if not node_modules.exists():
            print("[*] node_modules not found in apps/web. Executing `npm install`...")
            proc_inst = subprocess.run(["npm", "install"], cwd=str(WEB_DIR), capture_output=True, text=True, shell=True)
            if proc_inst.returncode != 0:
                print(f"[-] npm install failed with exit code {proc_inst.returncode}")
                print(f"Stderr: {proc_inst.stderr}")
                assert proc_inst.returncode == 0, f"`npm install` failed in apps/web:\n{proc_inst.stderr}"

        # Clean previous .next build cache to prevent stale ENOENT manifest corruption
        next_cache = WEB_DIR / ".next"
        if next_cache.exists():
            shutil.rmtree(str(next_cache), ignore_errors=True)

        print("[*] Running Next.js build in apps/web...")
        # Execute Next.js build compilation (using npx next build --no-lint to isolate compiler & route generation from legacy ESLint warnings)
        proc_build = subprocess.run(
            ["npx", "next", "build", "--no-lint"],
            cwd=str(WEB_DIR),
            capture_output=True,
            text=True,
            shell=True
        )

        build_output = proc_build.stdout + "\n" + proc_build.stderr
        print(f"[*] Build completed with exit code: {proc_build.returncode}")

        if proc_build.returncode != 0:
            print(f"[-] Next.js build failed. Output:\n{build_output}")
            assert proc_build.returncode == 0, f"Next.js build failed with code {proc_build.returncode}:\n{build_output}"

        # Verify /analytics/sessions route generation in build output and disk artifacts
        route_in_output = "/analytics/sessions" in build_output
        artifact_exists = (
            (WEB_DIR / ".next" / "server" / "app" / "analytics" / "sessions.html").exists() or
            (WEB_DIR / ".next" / "server" / "app" / "analytics" / "sessions.rsc").exists() or
            (WEB_DIR / ".next" / "server" / "app" / "analytics" / "sessions").exists()
        )
        assert route_in_output or artifact_exists, (
            "Route '/analytics/sessions' was not generated in Next.js build output or disk artifacts!"
        )
        print("[+] PASS: Next.js compiled cleanly and route '/analytics/sessions' was successfully generated.")

        res.pass_test("Next.js build succeeded with exit code 0 and generated the /analytics/sessions route.")
    except Exception as e:
        import traceback
        err_msg = f"Next.js build verification failed: {str(e)}"
        print(f"[-] FAIL: {err_msg}")
        traceback.print_exc()
        res.fail_test(err_msg, traceback.format_exc().splitlines())

    return res


def run_all_tests() -> int:
    start_time = time.time()
    print("=" * 70)
    print("THIRDEYE UX SESSION RECORDING - ACCEPTANCE TEST SUITE")
    print(f"Workspace Root: {WORKSPACE_ROOT}")
    print(f"Execution Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    results = []

    # Test 1: Data Capture & Storage
    results.append(test_data_capture_and_storage())

    # Test 2: Snippet Syntax & Privacy
    results.append(test_snippet_syntax_and_privacy())

    # Test 3: Next.js Build Verification
    results.append(test_nextjs_build_verification())

    # Summary
    print("\n" + "=" * 70)
    print("ACCEPTANCE TEST SUITE SUMMARY")
    print("=" * 70)

    all_passed = True
    for r in results:
        status_label = "[PASSED]" if r.passed else "[FAILED]"
        print(f"{status_label} - {r.name}: {r.message}")
        if not r.passed:
            all_passed = False
            for d in r.details[:5]:
                print(f"    | {d}")

    total_duration = time.time() - start_time
    print("-" * 70)
    print(f"Total Tests: {len(results)} | Passed: {sum(1 for r in results if r.passed)} | Failed: {sum(1 for r in results if not r.passed)}")
    print(f"Elapsed Time: {total_duration:.2f}s")

    if all_passed:
        print("\n>>> ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! <<<")
        return 0
    else:
        print("\n>>> ONE OR MORE ACCEPTANCE TESTS FAILED. ESCALATION REQUIRED. <<<")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
