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
                                      │ ASK SDK Envelope / HTTPS
                                      ▼
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│  Caregiver Dashboard   │◄─────►│ Express 5 ESM Backend  │◄─────►│ FastAPI NLP / Mood Svc │
│  (React 19 on Vercel)  │ HTTP  │ (Render / Port 4000)   │ HTTP  │ (Port 8000 / Fallback) │
└────────────────────────┘       └───────────┬────────────┘       └────────────────────────┘
            ▲                                │ Parameterized SQL
      Cognito JWT                            ▼
   Token Verification            ┌────────────────────────┐
 (ap-southeast-2 Pool)           │ PostgreSQL (SDS 2.3)   │
                                 │ 22 Normalized Tables   │
                                 └────────────────────────┘
```

#### Production vs. Local Deployment Endpoints:
- **Web Frontend**: Hosted on Vercel (React 19 + Recharts + Lucide)
- **API Backend**: Hosted on Render (`https://elderly-monitoring-backend.onrender.com/api`) and runnable locally (`http://127.0.0.1:4000`)
- **Database**: Hosted PostgreSQL (Render managed Postgres) and local PostgreSQL (`localhost:5432`)
- **Authentication**: Live AWS Cognito User Pool (`ap-southeast-2_xoP6IPuBT`)

---

## 2. 50% Presentation Deliverables Status (Midterm Prototype Scope)

| # | Deliverable | Scope & Implementation | SDS / SRS Ref | Status |
|---|---|---|---|---|
| **D1** | **SDS Data Layer** | 22 PostgreSQL tables matching SDS 2.3 with snake_case, `BIGSERIAL`, `TIMESTAMPTZ`, FKs (`CASCADE`/`SET NULL`), indexes on `(user_id, time)`, and idempotent seed/reset scripts (`npm run db:reset`). | SDS 2.3 | **Completed** |
| **D2** | **Cognito Auth & Scoped Dashboard APIs** | Live AWS Cognito JWT ID token verification (`aws-jwt-verify`, `amazon-cognito-identity-js`), `caregiver_assignments` RBAC, `/api/me`, `/api/users/:id/status`, zero password storage in database. | SRS FR-3, SDS 3.1 | **Completed** |
| **D3** | **Alexa Skill Handlers & Passive Logging** | ASK SDK handlers (`LaunchRequest`, `CheckInIntent`, `DevotionalPlaybackIntent`, `SleepWakeCheckInIntent`, `MedicationConfirmationIntent`, `DistressIntent`, `FallbackIntent`), interaction model JSON, console linter bridge (`ask-index.js`), request simulator, passive transcript logging (zero raw audio). | SRS FR-1, SDS 2.2 | **Completed** |
| **D4** | **NLP & Sentiment Service** | Python FastAPI NLP service with Hinglish & English distress lexicon, continuous mood scoring $\in [-1, 1]$, confidence metrics, conversational help qualification, and Node client with graceful local fallback. | SRS FR-2, SDS 2.4 | **Completed** |
| **D5** | **Alert Engine & Multi-Tier Escalation** | 15-minute distress alert de-duplication window, periodic unacknowledged alert escalation timer, `alerts` and `alert_deliveries` (Twilio SMS HTTP integration with simulated fallback for non-billable test runs), caregiver acknowledgement API (`POST /api/alerts/:id/acknowledge`) with `audit_events`. | SRS FR-4, SDS 2.5 | **Completed** |
| **D6** | **Medication Reminders & Missed-Dose Alerts** | `ReminderProvider` adapter (`SimulatedReminderProvider`, `AlexaRemindersProvider` targeting Alexa Reminders API v1), adherence calculator, expired pending dose detection with automated `missed_medication` alert dispatch. | SRS FR-5, SDS 2.6 | **Completed** |
| **D7** | **Caregiver React Dashboard** | React 19 web dashboard connected to live backend APIs, real-time alert banners with 1-click Acknowledge, live AWS Cognito authentication, and embedded Alexa Voice Simulator. | SRS FR-6, SDS 4.1 | **Completed** |
| **D8** | **E2E Demo Scenarios & Verification** | 4 automated demonstration scripts verifying routine check-in, missed medication alert, distress de-duplication, and cross-caregiver security boundaries (`npm run demo:scenarios`). | SRS Testing | **Completed** |
| **D9** | **Traceability Matrix & Documentation** | Complete SRS/SDS requirement-to-code mapping matrix and quick-start instructions for evaluators. | Capstone Spec | **Completed** |

---

## 3. Requirement Traceability Matrix (SRS & SDS)

| SRS Requirement | SDS Component | Database Table(s) | Backend File / Route | Automated Test Suite |
|---|---|---|---|---|
| **FR-1**: Voice Companionship | Alexa Skill Integration | `interactions`, `mood_analyses` | `src/alexa/handlers/*`, `src/alexa/skill.js`, `POST /api/alexa` | Suite 7 (Tests 36-45) |
| **FR-2**: Emotion & Distress NLP | Hinglish Lexicon & Mood Engine | `distress_keywords`, `mood_analyses` | `nlp-service/analyzer.py`, `src/services/nlpClient.js` | Suite 8 (Tests 46-51) |
| **FR-3**: Caregiver Identity | Amazon Cognito JWT Auth | `caregivers`, `caregiver_assignments` | `src/middleware/requireAuth.js`, `src/routes/me.js` | Suite 2 & 3 (Tests 2-10) |
| **FR-4**: Emergency Escalation | Alert Engine & Multi-Tier Escalation | `alerts`, `alert_deliveries`, `audit_events` | `src/services/alertEngine.js`, `src/routes/alerts.js` | Suite 10 (Tests 53-59) |
| **FR-5**: Medication Reminders | Proactive Reminders & Adherence | `medication_schedules`, `medication_logs` | `src/services/medicationService.js`, `src/services/reminderProvider.js` | Suite 11 (Tests 60-63) |
| **FR-6**: Caregiver Dashboard | Live Scoped Status & Summary | `elderly_users`, `daily_activity` | `src/services/statusService.js`, `src/routes/users.js` | Suite 4 (Tests 11-27) |
| **FR-7**: Anomaly Detection | Daily Activity Anomaly Detection ($\mu - k\sigma$) | `daily_activity`, `alerts` | `src/services/anomalyService.js` | Suite 12 (Tests 64-65) |
| **NFR-1**: Data Privacy | Passive Summaries (No Raw Audio) | `interactions` (transcripts only) | `src/alexa/interceptors/loggingInterceptor.js` | Suite 7 (Test 37) |
| **NFR-2**: Sub-second Alerting | Immediate De-duplication Window | `alerts` (15-min index lookup) | `src/services/alertEngine.js` | Suite 10 (Test 55) |
| **NFR-3**: Security Isolation | Role-Based Access Control | `caregiver_assignments` (tenant isolation) | `src/middleware/requireUserAccess.js` | Suite 4 (Tests 12, 15, 21) |
| **NFR-4**: CORS & Web Security | Origin Isolation & Preflight Handling | - | `src/app.js` | Suite 13 (Tests 66-69) |

---

## 4. Quick Start Guide for Evaluators & Reviewers

### Prerequisites
- Node.js (v18+ or v24 LTS)
- PostgreSQL (v14+) running locally on `localhost:5432` with database `elderly_monitoring` (or Render cloud database)
- Python 3.10+ (for standalone FastAPI NLP service, optional due to Node fallback)

---

### Step 1: Initialize Database & Run Automated Test Suite

```bash
# 1. Reset and seed database with SDS 2.3 schema
npm run db:reset

# 2. Run all automated unit, integration, and security tests
npm test
```

*Expected output: All 69 automated tests pass across 13 test suites (14 suites counting root runner) with 0 failures.*

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

### Step 3: Run Full Stack Services (Local Demo Mode)

```bash
# Terminal 1: Start Express Backend (Port 4000)
npm run backend:dev

# Terminal 2: Start NLP Mood Service (Port 8000, optional: backend has built-in local fallback)
npm run nlp:dev

# Terminal 3: Start Caregiver React Dashboard (Port 5173)
npm run dev
```

Open browser at `http://127.0.0.1:5173` to interact with the Caregiver Dashboard and live Alexa Voice Simulator.

---

## 5. Directory Structure

```
presence/
├── elderly-monitoring-system/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── alexa/               # ASK SDK Handlers, Interceptors & Simulator
│   │   │   │   ├── handlers/        # Launch, CheckIn, MedicationConfirmation, Distress
│   │   │   │   ├── interceptors/    # Passive interaction & mood logging
│   │   │   │   ├── simulator.js     # Voice interaction envelope builder
│   │   │   │   └── skill.js         # Lambda / ASK SDK Skill export
│   │   │   ├── database/            # pool.js, seed.js, reset.js, init.js
│   │   │   ├── middleware/          # requireAuth.js (Cognito), requireUserAccess.js
│   │   │   ├── routes/              # me.js, users.js, alerts.js, alexa.js, voice.js
│   │   │   ├── services/            # alertEngine.js, medicationService.js, nlpClient.js,
│   │   │   │                        # notificationService.js, anomalyService.js, statusService.js
│   │   │   ├── app.js               # Express application & CORS configuration
│   │   │   └── server.js            # Server entrypoint with 60s escalation background scheduler
│   │   ├── scripts/
│   │   │   └── demo-walkthrough.js  # Presentation scenario runner
│   │   └── tests/
│   │       └── api.test.js          # 69 Automated Unit/API tests across 13 suites
│   ├── database/
│   │   └── schema.sql               # SDS 2.3 PostgreSQL Schema (22 tables)
│   ├── docs/                        # Skill interaction model & Lambda deployment assets
│   │   ├── alexa-interaction-model.json # ASK Interaction Model (Intents & Utterances)
│   │   ├── ask-index.js             # Alexa Developer Console code editor handler
│   │   └── lambda-index.mjs         # AWS Lambda entrypoint
│   └── nlp-service/
│       ├── analyzer.py              # Hinglish/English Sentiment & Distress Lexicon
│       ├── main.py                  # FastAPI server (/analyze, /health)
│       └── requirements.txt         # Python dependencies
├── lambda-pkg/                      # Standalone AWS Lambda package bundle
├── src/                             # React 19 Frontend Dashboard
│   ├── auth.js                      # AWS Cognito authentication helper (amazon-cognito-identity-js)
│   ├── api.js                       # Authenticated API client with token persistence
│   ├── main.jsx                     # Dashboard UI, live charts, & Alexa Simulator
│   └── styles.css                   # Custom responsive styling
├── DATABASE_SCHEMA.md               # 22-table data dictionary and schema documentation
├── package.json                     # Monorepo root scripts & dependencies
└── vite.config.js                   # Vite React build configuration
```

---

## 6. Gap Analysis & Production Roadmap

For the 50% midterm evaluation, all nine deliverables (D1–D9) are implemented as a **functional simulated/local end-to-end prototype** with active cloud integrations where indicated below.

| Component | 50% Midterm Implementation Status | Production / Final Phase Roadmap |
|---|---|---|
| **NLP & Distress Engine** | Regex & lexicon rule-based analyzer (`nlp-service/analyzer.py` + JS fallback). Highly predictable, zero cold-start, Hinglish-aware. | Fine-tune a lightweight transformer (e.g. IndicBERT / RoBERTa) on domain elderly Hindi/English conversational transcripts. |
| **Emergency Notifications** | Dual-mode delivery: HTTP Twilio SMS dispatch supported (`notificationService.js`), with structured `simulated` stubs recorded in `alert_deliveries` for safe, cost-free demo execution. | Connect live Twilio webhook callbacks, configure Firebase Cloud Messaging (FCM) via existing `fcm_token` schema, and add SendGrid email escalation. |
| **Alexa Skill Integration** | ASK SDK handlers implemented, full `alexa-interaction-model.json` published in `docs/`, bridged console script (`ask-index.js`), and embedded web simulator. | Complete Amazon Alexa Developer Console publishing, set up skill permissions for Reminders API, and configure Alexa Account Linking with AWS Cognito. |
| **AWS Lambda Deployment** | Lambda handler exported (`skill.js`), standalone package configured (`lambda-pkg/`, `presence-lambda.zip`), Express API running on Render. | Deploy Alexa Skill backend as a serverless AWS Lambda function behind an API Gateway trigger. |
| **Caregiver Authentication** | Full AWS Cognito User Pool integration (`amazon-cognito-identity-js`, pool `ap-southeast-2_xoP6IPuBT`), email/password authentication, JWT ID token verification (`aws-jwt-verify`). | Optional: Add Cognito Hosted UI / Social IdP login (Google/Apple) and MFA SMS challenge. |
| **Real-time Alerting** | Client-side HTTP polling (10-second interval with document visibility check in `src/main.jsx`). | Migrate dashboard alert subscriptions to Server-Sent Events (SSE) or WebSockets. |
| **Multi-Tier Escalation** | 60-second background cron tick (`server.js`) escalates unacknowledged alerts to Level 1 (`escalateUnacknowledgedAlerts()`) and triggers backup contacts (`backup_contact_id`). | Extend to Level 2 (designated clinical emergency line) and multi-channel retry cascades. |

---

## 7. Security & Privacy Guarantees

1. **Zero Password Storage**: Identity management is delegated entirely to Amazon Cognito. The backend only verifies cryptographically signed JWT ID tokens.
2. **Non-Clinical Passive Logging**: Raw audio is never stored on disk or database; only structured transcripts, intent classifications, and numerical mood scores are retained.
3. **Strict Caregiver Scoping**: Every user endpoint verifies caregiver assignments via `requireUserAccess` middleware (tenant isolation).
4. **Injection Resistance**: 100% of PostgreSQL queries use parameterized placeholders (`$1, $2, ...`).
5. **CORS Hardening**: Backend enforces origin isolation for localhost and the deployed Vercel domain.