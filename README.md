# Exam Prediction Lab

A local, virtual-points prototype for exam predictions. No dependencies beyond Python 3.10+.

## Run

```powershell
cd D:\projects\ExamsMinigame
python app.py
```

Open [http://localhost:8000](http://localhost:8000). Use `PORT=8001` (PowerShell: `$env:PORT=8001`) to change the port.

Demo logins: `admin / admin123`, `alice / player123`, `bob / player123`. Each player starts with 1,000 points. The SQLite file `exams.db` is created next to `app.py` and keeps exams, bets, settlements, sessions, and balances across restarts. Delete it only to reset all demo data.

## Flow and rules

1. Admin creates an exam with a future start time, then adds topic or specific-question YES/NO markets.
2. Players bet positive whole points while the exam is open. Stakes are deducted immediately. Their own bets are visible, but other bets, pool totals, and odds are hidden.
3. Betting closes automatically at the exam start time or when the admin locks it. Admin settles each market YES or NO once the exam has started; an early manual lock does not permit early settlement.
4. The complete pool is distributed in proportion to winning stakes. Integer rounding uses largest remainders and stable bet order, so every point is allocated. If there are no bets on the winning side, every stake is refunded. Settlement is final and cannot run twice.
5. A settled market reveals YES/NO pool totals. The leaderboard ranks settled profit only, without exposing live balances or stakes.

This is a local demo with known credentials and virtual points, not a production authentication or real-money system.

## Tests

```powershell
python -m unittest discover -s tests -v
```
