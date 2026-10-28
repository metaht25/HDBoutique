"""Run isolated legacy adapter tests using existing dependencies only."""

import importlib.util
import os
from pathlib import Path
import sys


def main() -> int:
    required_modules = ("django", "rest_framework")
    missing = [name for name in required_modules if importlib.util.find_spec(name) is None]
    if missing:
        print("Tests not run. Missing dependencies: " + ", ".join(missing), file=sys.stderr)
        print("No dependencies were installed. See docs/characterization.md.", file=sys.stderr)
        return 2

    test_root = Path(__file__).resolve().parent
    project_root = test_root.parents[2]
    sys.path.insert(0, str(project_root / "backend" / "hdboutique"))
    sys.path.insert(0, str(test_root))
    os.environ["DJANGO_SETTINGS_MODULE"] = "isolated_settings"

    import django
    django.setup()

    from django.conf import settings
    from django.test.runner import DiscoverRunner

    if any(
        database.get("ENGINE") != "django.db.backends.dummy"
        for database in settings.DATABASES.values()
    ):
        raise RuntimeError("Characterization tests require the dummy database backend")
    runner = DiscoverRunner(verbosity=2)
    return int(bool(runner.run_tests(["django_contract_cases"])))


if __name__ == "__main__":
    raise SystemExit(main())
