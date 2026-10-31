import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app import Store, RuleError


class BettingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.store = Store(Path(self.temp.name) / "test.db")
        self.store.initialize()
        self.admin = self.store.authenticate("admin", "admin123")
        self.alice = self.store.authenticate("alice", "player123")
        self.bob = self.store.authenticate("bob", "player123")
        self.starts = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        self.exam = self.store.create_exam(self.admin, "Algorithms", self.starts)
        self.market = self.store.create_market(self.admin, self.exam, "topic", "Graphs")

    def tearDown(self):
        self.temp.cleanup()

    def advance_past_start(self):
        with self.store.connect() as db:
            db.execute("UPDATE exams SET starts_at=? WHERE id=?", ((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(), self.exam))

    def test_bets_debit_balance_and_hide_other_bets(self):
        self.store.place_bet(self.alice, self.market, "YES", 100)
        self.assertEqual(self.store.balance(self.alice), 900)
        view = self.store.snapshot(self.bob)
        market = view["exams"][0]["markets"][0]
        self.assertNotIn("pool", market)
        self.assertNotIn("bets", market)
        self.assertNotIn("odds", market)
        self.assertEqual(market["my_bets"], [])

    def test_overspend_and_invalid_stake_rejected(self):
        for stake in (0, -1, 1001):
            with self.assertRaises(RuleError):
                self.store.place_bet(self.alice, self.market, "YES", stake)
        self.assertEqual(self.store.balance(self.alice), 1000)

    def test_lock_rejects_bets(self):
        self.store.lock_exam(self.admin, self.exam)
        with self.assertRaises(RuleError):
            self.store.place_bet(self.alice, self.market, "YES", 10)

    def test_parimutuel_settlement_and_duplicate_guard(self):
        self.store.place_bet(self.alice, self.market, "YES", 100)
        self.store.place_bet(self.bob, self.market, "NO", 50)
        self.store.lock_exam(self.admin, self.exam)
        self.advance_past_start()
        self.store.settle_market(self.admin, self.market, "YES")
        self.assertEqual(self.store.balance(self.alice), 1050)
        self.assertEqual(self.store.balance(self.bob), 950)
        scores = {row["username"]: row["profit"] for row in self.store.snapshot(self.alice)["leaderboard"]}
        self.assertEqual(scores, {"alice": 50, "bob": -50})
        bob_bet = self.store.snapshot(self.bob)["exams"][0]["markets"][0]["my_bets"][0]
        self.assertEqual(bob_bet["net"], -50)
        with self.assertRaises(RuleError):
            self.store.settle_market(self.admin, self.market, "YES")
        revealed = self.store.snapshot(self.bob)["exams"][0]["markets"][0]
        self.assertEqual(revealed["pool"], {"YES": 100, "NO": 50})

    def test_no_winning_side_refunds_everyone(self):
        self.store.place_bet(self.alice, self.market, "NO", 75)
        self.store.lock_exam(self.admin, self.exam)
        self.advance_past_start()
        self.store.settle_market(self.admin, self.market, "YES")
        self.assertEqual(self.store.balance(self.alice), 1000)
        self.assertEqual(self.store.snapshot(self.alice)["exams"][0]["markets"][0]["settlement"], "refund")

    def test_cannot_settle_before_exam_start_or_lock(self):
        with self.assertRaises(RuleError):
            self.store.settle_market(self.admin, self.market, "YES")
        self.store.lock_exam(self.admin, self.exam)
        with self.assertRaises(RuleError):
            self.store.settle_market(self.admin, self.market, "YES")


if __name__ == "__main__":
    unittest.main()
