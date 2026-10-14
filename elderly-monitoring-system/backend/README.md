# Presence Backend (Elderly Monitoring System)

Node.js, Express 5, ES Modules backend backed by PostgreSQL and Amazon Cognito for the **Presence: AI-Based Elderly Companion & Monitoring System** (System Design Specification compliance).

---

## 1. Amazon Cognito Setup

1. **Create a User Pool** in AWS Cognito:
   - User Pool Name: e.g. `presence-caregiver-pool`
   - Sign-in attribute: **Email**
   - Custom attributes: Add `custom:amazon_user_id` (String, mutable) to associate a caregiver with their elder's Alexa account identifier.

2. **Create an App Client**:
   - App Client Name: e.g. `presence-dashboard-client`
   - Client Secret: **Do NOT generate a client secret** (public client for SPA / dashboard usage).
   - Auth Flows: Allow `USER_PASSWORD_AUTH` / `ALLOW_USER_SRP_AUTH`.

3. **Create 2 Test Caregiver Users**:
   - **Caregiver A**: `samridhi@example.com` (Set `custom:amazon_user_id` = `amzn1.ask.account.DEMO-SHANTI`).
   - **Caregiver B**: `arjun@example.com` (Set `custom:amazon_user_id` = `amzn1.ask.account.DEMO-RAMESH`).

4. **Copy Cognito Attributes to `.env`**:
   - Retrieve the `sub` (UUID) for Caregiver A and Caregiver B from the AWS Cognito Console and set them in your `.env` as `SEED_CAREGIVER_A_SUB` and `SEED_CAREGIVER_B_SUB`.

---

## 2. Environment Variables

Create `.env` in `elderly-monitoring-system/backend/.env` (or copy from `.env.example`):

```env
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/elderly_monitoring
FRONTEND_ORIGIN=http://127.0.0.1:5173
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VOICE_API_KEY=voice-secret-key-presence-demo
SEED_CAREGIVER_A_SUB=cognito-sub-demo-a
SEED_CAREGIVER_B_SUB=cognito-sub-demo-b
```

---

## 3. Database Commands

From the repository root (or backend folder):

### Reset Database (Drop + Recreate + Seed)
```bash
npm run db:reset
```

### Idempotent Database Init & Seed
```bash
npm run db:init
npm run db:seed
```

### Run Tests
```bash
npm test
```

### Start Development Server
```bash
npm run backend:dev
```

---

## 4. API Endpoints & Example Requests

Caregiver endpoints require a valid Amazon Cognito ID Token in the `Authorization: Bearer <ID_TOKEN>` header.

### A. Fetch Caregiver Profile & Assigned Elders
```bash
curl -X GET http://127.0.0.1:4000/api/me \
  -H "Authorization: Bearer <COGNITO_ID_TOKEN>"
```

### B. Fetch Elderly User Profile (Only if assigned)
```bash
curl -X GET http://127.0.0.1:4000/api/users/1 \
  -H "Authorization: Bearer <COGNITO_ID_TOKEN>"
```

### C. Fetch Elderly User Dashboard Status
```bash
curl -X GET http://127.0.0.1:4000/api/users/1/status \
  -H "Authorization: Bearer <COGNITO_ID_TOKEN>"
```

**Example Response Shape:**
```json
{
  "userId": 1,
  "name": "Shanti Devi",
  "lastActiveAt": "2026-10-06T09:30:00.000Z",
  "activeAlertCount": 0,
  "medicationToday": {
    "taken": 1,
    "total": 2
  },
  "todayMood": {
    "label": "positive",
    "score": 0.750
  },
  "interactionsToday": 2,
  "nextMedication": {
    "scheduleId": 2,
    "medicationName": "Metformin",
    "dosage": "500mg",
    "scheduledTime": "20:00:00"
  }
}
```

### D. Fetch Interaction History (Paged)
```bash
curl -X GET "http://127.0.0.1:4000/api/users/1/interactions?limit=10&offset=0" \
  -H "Authorization: Bearer <COGNITO_ID_TOKEN>"
```

### E. Voice Intent Simulator (Device / Alexa Adapter)
Protected with `x-voice-api-key`:
```bash
curl -X POST http://127.0.0.1:4000/api/voice/intent \
  -H "Content-Type: application/json" \
  -H "x-voice-api-key: voice-secret-key-presence-demo" \
  -d '{
    "userId": 1,
    "sessionId": "session-sim-1",
    "interactionIntent": "daily_check_in",
    "transcript": "Good morning, I had tea and feel well.",
    "response": "Good morning Shanti ji!",
    "summary": "Morning check-in completed.",
    "moodScore": 0.800,
    "confidenceScore": 0.900,
    "sentimentLabel": "positive"
  }'
```

---

## 5. Alexa Skill Endpoints (ASK SDK)

### A. Direct ASK SDK Webhook Endpoint
Target endpoint for AWS Lambda or Alexa Developer Console HTTPS endpoint:
```bash
curl -X POST http://127.0.0.1:4000/api/alexa \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "session": { "new": true, "sessionId": "sess-1", "user": { "userId": "amzn1.ask.account.DEMO-SHANTI" } },
    "request": { "type": "LaunchRequest", "requestId": "r-1", "timestamp": "2026-10-06T10:00:00Z" }
  }'
```

### B. Alexa Request Simulator (Presentation Demos & Local Testing)
Converts typed phrases into full ASK SDK `IntentRequest` payloads, runs handlers, and logs structured interactions passively to PostgreSQL:
```bash
# 1. Routine Check-In
curl -X POST http://127.0.0.1:4000/api/alexa/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "amazonUserId": "amzn1.ask.account.DEMO-SHANTI",
    "transcript": "Namaste, I had breakfast and I feel good today."
  }'

# 2. Medication Confirmation
curl -X POST http://127.0.0.1:4000/api/alexa/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "amazonUserId": "amzn1.ask.account.DEMO-SHANTI",
    "transcript": "I took my Amlodipine"
  }'

# 3. Emergency / Distress Phrase
curl -X POST http://127.0.0.1:4000/api/alexa/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "amazonUserId": "amzn1.ask.account.DEMO-SHANTI",
    "transcript": "Help, I fell down"
  }'
```

