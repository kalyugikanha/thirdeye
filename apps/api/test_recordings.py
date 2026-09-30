#!/usr/bin/env python3
"""
ThirdEye UX Session Recording - Canonical Programmatic Acceptance Test Suite
=============================================================================
This file is co-located in apps/api/test_recordings.py and delegates to or mirrors
the root test_recordings.py suite.
"""

import sys
from pathlib import Path

ROOT_TEST = Path(__file__).resolve().parent.parent.parent / "test_recordings.py"

if __name__ == "__main__":
    if ROOT_TEST.exists():
        import runpy
        runpy.run_path(str(ROOT_TEST), run_name="__main__")
    else:
        print(f"Root test file not found at {ROOT_TEST}", file=sys.stderr)
        sys.exit(1)
