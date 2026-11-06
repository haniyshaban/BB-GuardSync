# Black Belt - GuardSync

A clean, simplified security guard management platform. Fork of GuardSync by Eden Labs.

## Overview

Black Belt - GuardSync provides essential guard workforce management without the complexity of live maps, geofencing, or patrol tracking.

## Features

### Guard Statuses (3 simple states)
| Status | Meaning |
|--------|---------|
| **Online** | Guard is clocked in and active |
| **Offline** | Guard is not clocked in |
| **Idle** | Guard is clocked in but hasn't moved |

### Core Workflow
1. **Guard Enrollment** — Guards self-enroll via the guard app (name, phone, email, password, photo)
2. **Admin Authorization** — Admin reviews and approves enrollment, assigns a site and shift
3. **Clock In/Out** — Guards arrive at location, log in, and clock in to begin their shift
4. **Face Detection Checks** — 2–4 random face verification requests per day during shift
5. **GPS Location Tracking** — Location sent every 30 minutes during active shift
6. **Clock Out** — Guard clocks out at end of shift
7. **Payroll** — Daily pay rate tied to guard profile; monthly payroll auto-generated from attendance

### Apps
| App | Purpose |
|-----|---------|
| **Admin Console** | Web dashboard for managing guards, sites, shifts, attendance, payroll |
| **Guard App** | Mobile app (Android/Capacitor) for enrollment, clock-in/out, face checks |
| **Staff App** | Mobile app for field supervisors to monitor guard status and attendance |

## Architecture

```
blackbelt-guardsync/
├── admin/              # Admin console (React frontend + Express API)
│   ├── server/         # Express + SQLite backend
│   └── src/            # React + TypeScript + Vite frontend
├── guard-app/          # Guard mobile app (React + Capacitor)
├── staff-app/          # Staff mobile app (React + Vite)
└── shared/             # Shared types and utilities
```

## Tech Stack
- **Backend:** Node.js, Express, SQLite (better-sqlite3), JWT, bcrypt
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Mobile:** Capacitor (Android)
- **Face Detection:** face-api.js (TensorFlow.js)

## GPS Data Optimization

**Location tracking:** Every 30 minutes during an active shift.

| Scale | Data/Day | Data/Month | Recommendation |
|-------|----------|------------|----------------|
| 100 guards | ~360 KB | ~10.8 MB | Monthly archive |
| 500 guards | ~1.8 MB | ~54 MB | Monthly archive |
| 1000 guards | ~3.6 MB | ~108 MB | Monthly archive + vacuum |

**Strategy:** Location data older than 30 days is archived to a separate table and purged from the active table. Daily summaries are kept permanently. SQLite VACUUM runs monthly to reclaim space.

## Quick Start

```bash
# Install dependencies
cd admin && npm install
cd server && npm install
cd ../../guard-app && npm install
cd ../staff-app && npm install

# Seed database
cd admin/server && node seed.js

# Start development
cd admin/server && node index.js          # API on :5000
cd admin && npm run dev                    # Admin on :5173
cd guard-app && npm run dev                # Guard app on :5174
cd staff-app && npm run dev                # Staff app on :5175
```

## Operations Modules (Raksham-parity add-ons)

| Module | Capabilities |
|--------|-------------|
| **24×7 Command Centre** | Live site board, shift-aware guard-shortage detection, on-duty roster, battery telemetry, active-alert panel (`/command`) |
| **AI Sleep Alert** | Rule-based night-shift inactivity detection (no movement + no face response) → supervisor alerts, 10-min monitoring job |
| **Patrolling & Site Visits** | Checkpoints per site, GPS-proximity-verified scans, photo/timestamp, coverage % and route history |
| **Task & Incident Mgmt + SOS** | Assign/verify field tasks, guard incident reports, panic SOS with location, acknowledge/resolve + escalation alerts |
| **Overtime Monitoring** | OT derived from attendance vs configurable daily/weekly thresholds, abnormal-OT flags, CSV export |
| **Employee Management** | Statutory records (Aadhaar/PAN/EPF/Bank/PASARA) + document upload & verification, KYC status |
| **Assets & Inventory** | Asset catalogue, guard/site allocation, issue/return/lost tracking, inventory value reports |
| **Alerts & Notifications** | Central operational feed (sleep, shortage, SOS, low-battery, offline) surfaced in admin + staff apps |
| **Client Visibility** | Read-only `client` role scoped to assigned sites (attendance, deployment, patrol, incidents) |

Thresholds for overtime, night-shift window, sleep-alert inactivity and low-battery are configurable in **Settings**.

> Note: operational alerts are delivered as an in-app feed (polled). Native push (FCM) and a live map layer are the natural next additions.

## Still Not Included (vs full GuardSync)
- ❌ Geofencing (polygon & radius)
- ❌ Live map layer (Command Centre is list/table based)
- ❌ Native push notifications (FCM) — alerts are in-app/polled
- ❌ Conveyance requests
- ❌ Voice notes / media uploads
