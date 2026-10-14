# Presence: AI-Based Elderly Companion & Monitoring System

> **B.Tech CS-AI Capstone Project**  
> **System Architecture & 50% Midterm Presentation Deliverables (D1 – D9)**

---

## 1. Project Overview & Architecture

**Presence** is an intelligent, voice-first companion and proactive safety monitoring system tailored for elderly individuals living independently. It bridges daily conversational companionship (via Amazon Alexa) with real-time health/mood trend monitoring and multi-tier emergency alert escalation for remote caregivers.

### Architecture Overview

```
                          ┌────────────────────────┐
                          │   Amazon Alexa Device   │
                          │   (Echo / Voice UI)    │
                          └───────────┬────────────┘
                                      │ ASK SDK Envelope
                                      ▼
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│  Caregiver Dashboard   │◄─────►│ Express 5 ESM Backend  │◄─────►│ FastAPI NLP / Mood Svc │
│  (React 19 + Recharts) │ HTTP  │   (Port 4000)          │ HTTP  │ (Port 8000, Fallback)  │
└────────────────────────┘       └───────────┬────────────┘       └────────────────────────┘
            ▲                                │ Parameterized SQL
      Cognito JWT                            ▼
   Token Verification            ┌────────────────────────┐
                                 │ PostgreSQL (SDS 2.3)   │
                                 │ 22 Normalized Tables   │
                                 └────────────────────────┘
```

---

## 2. 50% Presentation Deliverables Status (100% Completed)

| # | Deliverable | Scope & Implementation | SDS / SRS Ref | Status |
|---|---|---|---|---|
| **D1** | **SDS Data Layer** | 22 PostgreSQL tables matching SDS 2.3 with snake_case, `BIGSERIAL`, `TIMESTAMPTZ`, FKs (`CASCADE`/`SET NULL`), indexes on `(user_id, time)`, and idempotent seed/reset scripts (`npm run db:reset`). | SDS 2.3 | **Completed** |
| **D2** | **Cognito Auth & Scoped Dashboard APIs** | Cognito JWT ID token verification (`aws-jwt-verify`), `caregiver_assignments` RBAC, `/api/me`, `/api/users/:id/status`, zero password storage in database. | SRS FR-3, SDS 3.1 | **Completed** |
| **D3** | **Alexa Skill Handlers & Passive Logging** | ASK SDK handlers (`LaunchRequest`, `CheckInIntent`, `DevotionalPlaybackIntent`, `SleepWakeCheckInIntent`, `MedicationConfirmationIntent`, `DistressIntent`, `FallbackIntent`), request simulator, passive transcript logging (zero raw audio). | SRS FR-1, SDS 2.2 | **Completed** |
| **D4** | **NLP & Sentiment Service** | Python FastAPI NLP service with Hinglish & English distress lexicon, continuous mood scoring $\in [-1, 1]$, confidence metrics, conversational help qualification, and Node client with graceful local fallback. | SRS FR-2, SDS 2.4 | **Completed** |
| **D5** | **Alert Engine & Multi-Tier Escalation** | 15-minute distress alert de-duplication window, `alerts` and `alert_deliveries` (Twilio SMS integration with simulated fallback), caregiver acknowledgement API (`POST /api/alerts/:id/acknowledge`) with `audit_events`. | SRS FR-4, SDS 2.5 | **Completed** |
| **D6** | **Medication Reminders & Missed-Dose Alerts** | `ReminderProvider` adapter (`SimulatedReminderProvider`, `AlexaRemindersProvider`), adherence calculator, expired pending dose detection with automated `missed_medication` alert dispatch. | SRS FR-5, SDS 2.6 | **Completed** |
| **D7** | **Caregiver React Dashboard** | React 19 web dashboard connected to live backend APIs, real-time alert banners with 1-click Acknowledge, Caregiver switcher, and embedded Alexa Voice Simulator. | SRS FR-6, SDS 4.1 | **Completed** |
| **D8** | **E2E Demo Scenarios & Verification** | 4 automated demonstration scripts verifying routine check-in, missed medication alert, distress de-duplication, and cross-caregiver security boundaries (`npm run demo:scenarios`). | SRS Testing | **Completed** |
| **D9** | **Traceability Matrix & Documentation** | Complete SRS/SDS requirement-to-code mapping matrix and quick-start instructions for evaluators. | Capstone Spec | **Completed** |

---

## 3. Requirement Traceability Matrix (SRS & SDS)

| SRS Requirement | SDS Component | Database Table(s) | Backend File / Route | Automated Test ID |
|---|---|---|---|---|
| **FR-1**: Voice Companionship | Alexa Skill Integration | `interactions`, `mood_analyses` | `src/alexa/handlers/*`, `src/alexa/skill.js`, `POST /api/alexa` | Suite 7 (Tests 22-27) |
| **FR-2**: Emotion & Distress NLP | Hinglish Lexicon & Mood Engine | `distress_keywords`, `mood_analyses` | `nlp-service/analyzer.py`, `src/services/nlpClient.js` | Suite 8 (Tests 28-30) |
| **FR-3**: Caregiver Identity | Amazon Cognito JWT Auth | `caregivers`, `caregiver_assignments` | `src/middleware/requireAuth.js`, `src/routes/me.js` | Suite 2 & 3 (Tests 2-8) |
| **FR-4**: Emergency Escalation | Alert Engine & Multi-Channel | `alerts`, `alert_deliveries`, `audit_events` | `src/services/alertEngine.js`, `src/routes/alerts.js` | Suite 10 (Tests 32-37) |
| **FR-5**: Medication Reminders | Proactive Reminders & Adherence | `medication_schedules`, `medication_logs` | `src/services/medicationService.js`, `src/services/reminderProvider.js` | Suite 11 (Tests 38-41) |
| **FR-6**: Caregiver Dashboard | Live Scoped Status & Summary | `elderly_users`, `daily_activity` | `src/services/statusService.js`, `src/routes/users.js` | Suite 4 (Tests 9-16) |
| **NFR-1**: Data Privacy | Passive Summaries (No Raw Audio) | `interactions` (transcripts only) | `src/alexa/interceptors/loggingInterceptor.js` | Suite 7 (Test 23) |
| **NFR-2**: Sub-second Alerting | Immediate De-duplication Window | `alerts` (15-min index lookup) | `src/services/alertEngine.js` | Suite 10 (Test 33) |
| **NFR-3**: Security Isolation | Role-Based Access Control | `caregiver_assignments` (tenant isolation) | `src/middleware/requireUserAccess.js` | Suite 4 (Tests 10, 13, 15) |

---

## 4. Quick Start Guide for Evaluators & Reviewers

### Prerequisites
- Node.js (v18+ or v24 LTS)
- PostgreSQL (v14+) running locally on `localhost:5432` with database `elderly_monitoring`
- Python 3.10+ (for standalone FastAPI NLP service)

---

### Step 1: Initialize Database & Run Automated Test Suite

```bash
# 1. Reset and seed database with SDS 2.3 schema
npm run db:reset

# 2. Run all automated unit, integration, and security tests
npm test
```

*Expected output: All 55 automated tests pass across 12 test suites.*

---

### Step 2: Run End-to-End Presentation Walkthrough Script

Verify all 4 core evaluation scenarios in a single command:

```bash
npm run demo:scenarios
```

#### Demo Scenarios Executed:
1. **Scenario 1 (Routine Check-in)**: Simulates Hinglish check-in utterance (*"Aaj main bahut khush hoon"*), verifies continuous mood scoring $\in [-1, 1]$, and checks passive interaction record.
2. **Scenario 2 (Missed Medication)**: Inserts past-due reminder window, runs `checkMissedMedications()`, verifies `missed_medication` alert creation and Push/SMS caregiver delivery stubs.
3. **Scenario 3 (Distress & De-duplication)**: Simulates distress fall utterance (*"Madad karo, main gir gayi"*), checks critical alert creation, and proves duplicate suppression within the 15-minute window.
4. **Scenario 4 (Security Isolation)**: Demonstrates caregiver access boundary (Caregiver A / Samridhi Sharma can only view Shanti Devi; requesting unassigned Ramesh Kumar is rejected with 404).

---

### Step 3: Run Full Stack Services (Live Demo Mode)

```bash
# Terminal 1: Start Express Backend (Port 4000)
npm run backend:dev

# Terminal 2: Start NLP Mood Service (Port 8000)
npm run nlp:dev

# Terminal 3: Start Caregiver React Dashboard (Port 5173)
npm run dev
```

Open browser at `http://127.0.0.1:5173` to interact with the Caregiver Dashboard and live Alexa Voice Simulator.

---

## 5. Directory Structure

```
Presence 2/
├── elderly-monitoring-system/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── alexa/               # ASK SDK Handlers, Interceptors & Simulator
│   │   │   │   ├── handlers/        # Launch, CheckIn, MedicationConfirmation, Distress
│   │   │   │   ├── interceptors/    # Passive interaction & mood logging
│   │   │   │   ├── simulator.js     # Voice interaction envelope builder
│   │   │   │   └── skill.js         # Lambda / ASK SDK Skill export
│   │   │   ├── database/            # pool.js, seed.js, reset.js
│   │   │   ├── middleware/          # requireAuth.js (Cognito), requireUserAccess.js
│   │   │   ├── routes/              # me.js, users.js, alerts.js, alexa.js, voice.js
│   │   │   ├── services/            # alertEngine.js, medicationService.js, nlpClient.js
│   │   │   ├── app.js               # Express application setup
│   │   │   └── server.js            # Server entrypoint (Port 4000)
│   │   ├── scripts/
│   │   │   └── demo-walkthrough.js  # Presentation scenario runner
│   │   └── tests/
│   │       └── api.test.js          # 44 Automated Unit/API tests
│   ├── database/
│   │   └── schema.sql               # SDS 2.3 PostgreSQL Schema (22 tables)
│   └── nlp-service/
│       ├── analyzer.py              # Hinglish/English Sentiment & Distress Lexicon
│       ├── main.py                  # FastAPI server (/analyze, /health)
│       └── requirements.txt         # Python dependencies
├── src/                             # React 19 Frontend Dashboard
│   ├── main.jsx                     # Dashboard UI, Live API Client & Alexa Simulator
│   └── styles.css                   # Custom responsive styling
└── package.json                     # Monorepo root scripts & dependencies
```

---

## 6. Security & Privacy Guarantees

1. **Zero Password Storage**: Identity management is delegated entirely to Amazon Cognito. The backend only verifies signed JWT ID tokens.
2. **Non-Clinical Passive Logging**: Raw audio is never stored on disk or database; only structured transcripts, intent classifications, and numerical mood scores are retained.
3. **Strict Caregiver Scoping**: Every user endpoint verifies caregiver assignments via `requireUserAccess` middleware.
4. **Injection Resistance**: 100% of PostgreSQL queries use parameterized placeholders (`$1, $2, ...`).
