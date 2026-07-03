# Prediction Market Demo

An interactive full-stack prediction market web application that allows participants to place virtual-token wagers on binary (YES/NO) prediction markets and watch market probabilities update in real time.

Originally built as an internal demonstration project, the application simulates how prediction markets aggregate information through participant trading without requiring user accounts or real money.

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

The application includes instructor-only controls that are hidden from participants. These administrative features are designed to manage the demonstration without affecting the participant experience.

Instructor-only functionality includes:

* Create new prediction markets
* Delete existing prediction markets
* Resolve markets as YES or NO
* Automatically distribute payouts after market resolution
* Reset the application to its initial state before a new demonstration

Participants cannot access these controls and are limited to viewing markets and placing wagers.

---

# Tech Stack

### Frontend

* React (Vite)
* JavaScript
* Recharts

### Backend

* Flask (Python)

### Database

* SQLite

---

# Project Structure

```text
prediction-market/
├── backend/      Flask API, business logic, SQLite database
└── frontend/     React application and user interface
```

---

# How It Works

1. A participant enters a username.
2. New users automatically receive **1,000 virtual tokens**.
3. Users place wagers on YES or NO outcomes for available prediction markets.
4. Every wager updates:

   * Market totals
   * Implied probabilities
   * Historical probability data
   * User balances
5. When the instructor resolves a market, winning participants automatically receive payouts based on their successful wagers.
6. The instructor can reset the application at any time to prepare for another demonstration.

The implied probability is calculated as:

```text
YES Probability = YES Tokens / (YES Tokens + NO Tokens)
```

---

# Running the Project Locally

The application consists of a Flask backend and a React frontend. Both must be running simultaneously.

## Backend

```bash
cd backend

python -m venv venv

# Activate environment
source venv/bin/activate      # macOS/Linux
venv\Scripts\activate         # Windows

pip install -r requirements.txt

python database.py
python seed.py

python app.py
```

The backend runs at:

```
http://localhost:5000
```

---

## Frontend

Open a second terminal:

```bash
cd frontend

npm install

npm run dev
```

The frontend runs at:

```
http://localhost:5173
```

---

# Resetting Demo Data

To completely reset the application:

```bash
cd backend

rm market.db

python database.py
python seed.py
```

---

# Database

The application uses SQLite with the following primary tables:

* **contracts** – stores all prediction markets
* **users** – tracks participant token balances
* **predictions** – records every wager placed
* **probability_snapshots** – stores historical probability data for chart visualization

---

# Project Architecture

* **React** provides the user interface.
* **Flask** exposes REST API endpoints that process bets, manage markets, resolve contracts, and update balances.
* **SQLite** stores users, markets, wagers, payouts, and historical probability data.
* The frontend periodically polls the backend so all participants see updated market information throughout the demonstration.

---

# Current Functionality

### Participant Features

* Virtual token economy
* Multiple prediction markets
* Real-time probability updates
* Historical probability charts
* Automatic balance tracking
* Server-side wager validation
* Mobile-friendly interface

### Instructor Features

* Create new prediction markets
* Delete existing markets
* Resolve markets
* Automatic payout distribution
* Reset the application for a new demonstration

---

# Known Limitations

This application was designed as a demonstration project rather than a production trading platform.

Current limitations include:

* No authentication or password system
* Usernames are not verified or unique
* SQLite is used instead of a production database
* Token balances are tied only to usernames
* Market prices update through periodic polling rather than live WebSocket connections
* Instructor controls are intended for demonstration purposes

---

# Future Improvements

Potential future enhancements include:

* User authentication and secure accounts
* Cloud-hosted production database
* Live updates using WebSockets
* Participant leaderboard
* Market categories and search
* Administrative dashboard
* User profiles
* Advanced market analytics
* Public cloud deployment with a custom domain

---

This project demonstrates full-stack web development using React, Flask, and SQLite while modeling the core mechanics of a prediction market through an interactive, browser-based application. It was designed to provide an intuitive demonstration of how market sentiment and implied probabilities evolve as participants place wagers over time.
