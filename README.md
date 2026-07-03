# Prediction Market Demo

An interactive full-stack prediction market web application that allows participants to place virtual-token wagers on binary (YES/NO) prediction markets and watch market probabilities update in real time.

**Live demo:** https://group1demo.com

---

# Features

## Participant Experience

* Enter a username (no account creation required)
* Receive **1,000 virtual tokens** upon first joining
* Place YES or NO wagers on active prediction markets
* View your remaining token balance
* Watch market probabilities update after every wager
* View historical probability charts for every market
* See recent market activity in real time

## Instructor Controls

Type **"Instructor"** as your name to unlock hidden admin controls:

* Create new prediction markets
* Delete existing prediction markets
* Resolve markets as YES or NO (automatically distributes payouts)
* Reset the application to a clean state before a new demonstration

---

# Tech Stack

### Frontend
* React (Vite), served as static files directly by the Flask backend in production

### Backend
* Flask (Python), served via gunicorn in production

### Database
* PostgreSQL (Render-managed)

### Hosting
* Render (Web Service + PostgreSQL), custom domain via Namecheap

---

# Running Locally

## Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # macOS/Linux
pip install -r requirements.txt

# Requires a local Postgres database -- see local setup notes below
export DATABASE_URL="postgresql://localhost/prediction_market"
python database.py
python seed.py
python app.py
```
Runs at http://localhost:5000

## Frontend

```bash
cd frontend
npm install
npm run dev
```
Runs at http://localhost:5173 (proxies /api requests to Flask automatically)

---

# Deployment

Deployed on Render as a single Web Service (Flask serves both the API and the built React app from one origin) plus a separate Render PostgreSQL database. DNS is managed on Namecheap, pointing group1demo.com at Render via an ALIAS record and www.group1demo.com via CNAME.

Pushing to the `main` branch on GitHub automatically triggers a new deploy on Render.

---

# Resetting Demo Data

As Instructor, use the in-app "Reset Market" button. This wipes all bets, balances, and resolution state back to a clean 0/0 slate without needing to touch the database directly.

---

# Known Limitations

* No authentication or password system -- usernames are not verified or unique
* Two people using the identical name share one identity/balance
* Instructor access is a plaintext name match, not real auth
* This is a demonstration project, not a production trading platform