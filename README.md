# Little Weather

A tiny daily emotion tracker with a local Python API and SQLite database. Your check-ins stay on this device.

## Run it

Requires Python 3.9 or newer. No packages to install.

```sh
cd ~/daily-mood-tracker
python3 server.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Stop the server with `Ctrl+C`. Check-ins are saved in `moods.sqlite3` beside the server.

## API

- `GET /api/entries` returns entries from the last seven days; `GET /api/entries?all=1` returns all saved entries for browsing older notes.
- `POST /api/entries` saves or updates today's entry. JSON body: `{"mood":"steady","intensity":3,"note":"A little more settled"}`.
- `DELETE /api/entries` removes today's entry. The Undo action uses this when undoing a first-time check-in.
