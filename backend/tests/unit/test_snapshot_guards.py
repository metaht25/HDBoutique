"""Reject ambiguous snapshot targets before connecting or overwriting evidence."""

import sys
from pathlib import Path
from unittest.mock import Mock

from app.operations import snapshot


def test_snapshot_requires_matching_explicit_database(
    monkeypatch, tmp_path: Path
) -> None:
    build = Mock()
    monkeypatch.setattr(snapshot, "build_engine", build)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "snapshot",
            "--database",
            "unapproved",
            "--output",
            str(tmp_path / "evidence.json"),
        ],
    )
    assert snapshot.main() == 2
    build.assert_not_called()


def test_snapshot_never_overwrites_evidence(monkeypatch, tmp_path: Path) -> None:
    output = tmp_path / "evidence.json"
    output.write_text("Preserved evidence")
    build = Mock()
    monkeypatch.setenv("HDB_DATABASE_HOST", "synthetic")
    monkeypatch.setenv("HDB_DATABASE_NAME", "approved")
    monkeypatch.setenv("HDB_DATABASE_USER", "synthetic")
    monkeypatch.setenv("HDB_DATABASE_PASSWORD", "synthetic")
    monkeypatch.setattr(snapshot, "build_engine", build)
    monkeypatch.setattr(
        sys, "argv", ["snapshot", "--database", "approved", "--output", str(output)]
    )
    assert snapshot.main() == 2
    assert output.read_text() == "Preserved evidence"
    build.assert_not_called()
