"""Consistent online backup for a local SQLite pilot database."""
import argparse
import sqlite3
from pathlib import Path


def backup_db(source: Path, destination: Path) -> Path:
    source, destination = Path(source), Path(destination)
    if not source.is_file() or destination.exists() or source.resolve() == destination.resolve():
        raise ValueError("Source must exist and destination must be a new file")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True) as src, sqlite3.connect(destination) as dst:
        src.backup(dst)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(backup_db(args.source, args.destination))
