# 🚕 Taxi Frontend

Vue 3 frontend for a ride-hailing application (Uber Clone).

## Tech Stack

- **Vue 3** — Composition API, `<script setup>`
- **Vue Router 4** — client-side routing with auth guard
- **Leaflet** — interactive maps with geocoding via Nominatim (OpenStreetMap)
- **Vite** — build tool with HMR

## Features

- 🔐 JWT authentication (register, login, logout, token refresh)
- 🗺️ Interactive map with address autocomplete for trip ordering
- 🚗 Passenger: order a trip, track status, cancel
- 🚕 Driver: view available trips, accept and complete
- 📍 Geocoding — address → coordinates via Nominatim API

## Backend

REST API: [taxi-backend](https://github.com/bogdan0089/taxi-backend) — FastAPI, PostgreSQL, Redis, Stripe, Celery

## Setup

```bash
npm install
npm run dev
```

Create `.env` file:

```
VITE_API_URL=http://localhost:8001
```
