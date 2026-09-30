import subprocess
import sys
from pathlib import Path

def test_snippet_syntax_and_requirements():
    workspace = Path(__file__).resolve().parent.parent.parent
    te_js_path = workspace / "apps" / "api" / "public" / "te.js"
    rrweb_path = workspace / "apps" / "api" / "public" / "rrweb-record.min.js"

    print(f"Testing snippet at: {te_js_path}")
    assert te_js_path.exists(), f"File {te_js_path} does not exist"
    assert rrweb_path.exists(), f"File {rrweb_path} does not exist"
    assert rrweb_path.stat().st_size > 10000, f"rrweb-record.min.js is too small: {rrweb_path.stat().st_size} bytes"

    # a) node --check passes cleanly with exit code 0
    proc = subprocess.run(["node", "--check", str(te_js_path)], capture_output=True, text=True)
    assert proc.returncode == 0, f"node --check failed on te.js:\nStdout: {proc.stdout}\nStderr: {proc.stderr}"

    proc_rrweb = subprocess.run(["node", "--check", str(rrweb_path)], capture_output=True, text=True)
    assert proc_rrweb.returncode == 0, f"node --check failed on rrweb-record.min.js:\nStdout: {proc_rrweb.stdout}\nStderr: {proc_rrweb.stderr}"

    content = te_js_path.read_text(encoding="utf-8")

    # b) Snippet contains required privacy masking parameters
    assert "maskAllInputs: true" in content, "Missing 'maskAllInputs: true'"
    assert "'***'" in content, "Missing '***' mask replacement"
    assert "maskTextFn" in content, "Missing 'maskTextFn'"
    assert "maskInputFn" in content, "Missing 'maskInputFn'"
    assert "maskTextSelector: '*'" in content, "Missing \"maskTextSelector: '*'\""

    # c) Snippet contains 5-second interval timer (5000) and POST /api/v1/recordings
    assert "5000" in content, "Missing 5000ms flush interval"
    assert "/api/v1/recordings" in content, "Missing '/api/v1/recordings' endpoint reference"
    assert "POST" in content, "Missing 'POST' method"
    assert "session_id" in content, "Missing session_id in payload"
    assert "events" in content, "Missing events in payload"
    assert "duration" in content, "Missing duration in payload"

    # d) Unload listeners and dynamic loader
    assert "beforeunload" in content, "Missing beforeunload listener"
    assert "pagehide" in content, "Missing pagehide listener"
    assert "rrweb-record.min.js" in content, "Missing fallback to local rrweb-record.min.js"
    assert "window.ThirdEye" in content, "Missing window.ThirdEye global export"

    print("ALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_snippet_syntax_and_requirements()
