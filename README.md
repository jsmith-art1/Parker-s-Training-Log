# Parker Training Log

A small static training tracker for Parker.

It records:

- Bedtime, wake-up time, calculated sleep duration, and sleep quality
- Energy, mood, soreness, and readiness
- Workout type, duration, effort, and notes
- History, simple stats, and trend insights

## Supabase setup

The app is wired to Supabase and falls back to browser storage if the table is not ready yet.

1. Open the Supabase SQL Editor.
2. Run `schema.sql`.
3. Open or deploy `index.html`.

Open `index.html` in a browser, or serve the folder with a local static server.
