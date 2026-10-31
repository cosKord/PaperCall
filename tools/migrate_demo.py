"""Preview or migrate the legacy demo without modifying its source database."""
import argparse
from pathlib import Path

from market_app.db import migrate_demo


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", help="new SQLite path or empty Supabase Postgres DATABASE_URL")
    parser.add_argument("--apply", action="store_true", help="write a new target database")
    args = parser.parse_args()
    target = args.target if "://" in args.target else Path(args.target)
    report = migrate_demo(args.source, target, dry_run=not args.apply)
    print(f"users={report.users} markets={report.markets} bets={report.bets} mode={'apply' if args.apply else 'preview'}")


if __name__ == "__main__":
    main()
