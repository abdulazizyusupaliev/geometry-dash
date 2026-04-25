# Pulse Dash

Pulse Dash is a Geometry Dash inspired browser game with a Python API backend and an HTML/CSS/JavaScript frontend.

## Stack

- Python `FastAPI` backend for level, health, and score APIs
- HTML, CSS, and vanilla JavaScript frontend
- Canvas rendering for the game visuals

## API Endpoints

- `GET /api/health`
- `GET /api/level`
- `GET /api/scores`
- `POST /api/run`

## Run Locally

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Start the backend:

   ```bash
   uvicorn backend.app:app --reload
   ```

3. Open `http://127.0.0.1:8000`

The frontend is served by the backend and reads its level and leaderboard from the API.
