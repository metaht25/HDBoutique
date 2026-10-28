"""Execute the legacy Django suite in its own process and isolated settings."""

import subprocess
import sys
from pathlib import Path


def test_isolated_legacy_contracts() -> None:
    runner = Path(__file__).with_name("run_django_tests.py")
    result = subprocess.run(
        [sys.executable, "-B", str(runner)],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
