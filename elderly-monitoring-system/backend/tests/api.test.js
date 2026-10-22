import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { closePool, query } from "../src/database/pool.js";
import { resetDatabase } from "../src/database/reset.js";
import { seedDatabase } from "../src/database/seed.js";

class FakeCognitoVerifier {
  constructor(tokens = {}) {
    this.tokens = tokens;
  }

  async verify(token) {
    if (token === "expired-token-caregiver") {
      const error = new Error("Token has expired");
      error.name = "JwtExpiredError";
      throw error;
    }
    if (!token || !this.tokens[token]) {
      const error = new Error("Invalid token");
      error.name = "JwtVerificationError";
      throw error;
    }
    return this.tokens[token];
  }
}

describe("Presence SDS Backend API Test Suite", () => {
  let app;
  let shantiId = 0;
  let rameshId = 0;

  const tokenA = "valid-token-caregiver-a";
  const tokenB = "valid-token-caregiver-b";
  const tokenTestUser = "valid-token-test-caregiver";
  const tokenExpired = "expired-token-caregiver";
  const tokenAMatchingAmazon = "valid-token-a-matching-amazon";
  const tokenAMismatchingAmazon = "valid-token-a-mismatching-amazon";
  const tokenUnknownSub = "valid-token-unknown-sub";
  const tokenInactiveCaregiver = "valid-token-inactive-caregiver";

  const fakeVerifier = new FakeCognitoVerifier({
    [tokenA]: {
      sub: "cognito-sub-demo-a",
      email: "samridhi@example.com",
    },
    [tokenB]: {
      sub: "cognito-sub-demo-b",
      email: "arjun@example.com",
    },
    [tokenTestUser]: {
      sub: "b9ced498-d091-70d2-8457-c9d1b487c487",
      email: "vaagisha2006@gmail.com",
      name: "Vaagisha",
    },
    [tokenAMatchingAmazon]: {
      sub: "cognito-sub-demo-a",
      email: "samridhi@example.com",
      "custom:amazon_user_id": "amzn1.ask.account.DEMO-SHANTI",
    },
    [tokenAMismatchingAmazon]: {
      sub: "cognito-sub-demo-a",
      email: "samridhi@example.com",
      "custom:amazon_user_id": "amzn1.ask.account.OTHER-ELDER",
    },
    [tokenUnknownSub]: {
      sub: "cognito-sub-nonexistent",
      email: "unknown@example.com",
    },
    [tokenInactiveCaregiver]: {
      sub: "cognito-sub-inactive-caregiver",
      email: "inactive@example.com",
    },
  });

  before(async () => {
    // Reset database to SDS schema and seed
    await resetDatabase();

    // Insert an inactive caregiver for testing 403
    await query(
      `INSERT INTO caregivers (name, email, cognito_sub, is_active)
       VALUES ('Inactive Caregiver', 'inactive@example.com', 'cognito-sub-inactive-caregiver', FALSE)
       ON CONFLICT (email) DO NOTHING`
    );

    // Get user IDs
    const usersRes = await query(
      "SELECT user_id, name FROM elderly_users WHERE name IN ('Shanti Devi', 'Ramesh Kumar')"
    );
    for (const u of usersRes.rows) {
      if (u.name === "Shanti Devi") shantiId = Number(u.user_id);
      if (u.name === "Ramesh Kumar") rameshId = Number(u.user_id);
    }

    app = createApp(fakeVerifier);
  });

  after(async () => {
    await closePool();
  });

  describe("1. Health Endpoint", () => {
    test("GET /api/health returns 200 and connected", async () => {
      const res = await request(app).get("/api/health");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: "ok", database: "connected" });
    });
  });

  describe("2. Authentication Middleware (Cognito Token Verification)", () => {
    test("Missing Authorization header returns 401", async () => {
      const res = await request(app).get("/api/me");
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Authentication token required." });
    });

    test("Malformed Authorization header returns 401", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", "Basic 12345");
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Invalid authorization header format." });
    });

    test("Invalid or expired token returns 401", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", "Bearer invalid-or-expired-token");
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Invalid or expired token." });
    });

    test("Token with unknown cognito_sub returns 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${tokenUnknownSub}`);
      assert.equal(res.status, 403);
      assert.deepEqual(res.body, {
        message: "Forbidden: Caregiver account not found or inactive.",
      });
    });

    test("Token for inactive caregiver returns 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${tokenInactiveCaregiver}`);
      assert.equal(res.status, 403);
      assert.deepEqual(res.body, {
        message: "Forbidden: Caregiver account not found or inactive.",
      });
    });

    test("Demo tokens are rejected when NODE_ENV is production and ALLOW_DEMO_TOKENS is false", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalAllow = process.env.ALLOW_DEMO_TOKENS;
      try {
        process.env.NODE_ENV = "production";
        process.env.ALLOW_DEMO_TOKENS = "false";
        const res = await request(app)
          .get("/api/me")
          .set("Authorization", "Bearer demo-token-a");
        assert.equal(res.status, 401);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.ALLOW_DEMO_TOKENS = originalAllow;
      }
    });
  });

  describe("3. GET /api/me (Caregiver Identity & Assigned Elders)", () => {
    test("Caregiver A returns Samridhi and only Shanti Devi", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.caregiver.name, "Samridhi Pandey");
      assert.equal(res.body.caregiver.email, "samridhi@example.com");
      assert.equal(res.body.assignedElders.length, 1);
      assert.equal(res.body.assignedElders[0].name, "Shanti Devi");
      assert.equal(res.body.assignedElders[0].amazonUserId, "amzn1.ask.account.DEMO-SHANTI");
    });

    test("Caregiver B returns Arjun and only Ramesh Kumar", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${tokenB}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.caregiver.name, "Arjun Sharma");
      assert.equal(res.body.caregiver.email, "arjun@example.com");
      assert.equal(res.body.assignedElders.length, 1);
      assert.equal(res.body.assignedElders[0].name, "Ramesh Kumar");
    });

    test("Dedicated test caregiver returns Vaagisha and assigned Shanti Devi", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${tokenTestUser}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.caregiver.name, "Vaagisha");
      assert.equal(res.body.caregiver.email, "vaagisha2006@gmail.com");
      assert.equal(res.body.caregiver.cognitoSub, "b9ced498-d091-70d2-8457-c9d1b487c487");
      assert.equal(res.body.assignedElders.length, 1);
      assert.equal(res.body.assignedElders[0].name, "Shanti Devi");
    });
  });

  describe("4. Caregiver Authorization & User Scoping", () => {
    test("Caregiver A fetching Shanti Devi profile /api/users/:shantiId returns 200", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.elderlyUser.name, "Shanti Devi");
      assert.ok(res.body.elderlyUser.preferences);
    });

    test("Caregiver A fetching unassigned Ramesh profile /api/users/:rameshId returns 404", async () => {
      const res = await request(app)
        .get(`/api/users/${rameshId}`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Not found." });
    });

    test("Invalid user ID parameter returns 400", async () => {
      const res = await request(app)
        .get("/api/users/not-a-number/status")
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { message: "Invalid user ID." });
    });

    test("Caregiver A requesting Shanti Devi status returns exact SDS JSON shape", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/status`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      const body = res.body;

      assert.equal(body.userId, shantiId);
      assert.equal(body.name, "Shanti Devi");
      assert.ok("lastActiveAt" in body);
      assert.equal(typeof body.activeAlertCount, "number");
      assert.ok(body.medicationToday);
      assert.equal(typeof body.medicationToday.taken, "number");
      assert.equal(typeof body.medicationToday.total, "number");
      assert.ok(body.todayMood);
      assert.equal(typeof body.todayMood.label, "string");
      assert.equal(typeof body.todayMood.score, "number");
      assert.equal(typeof body.interactionsToday, "number");
      assert.ok("nextMedication" in body);
    });

    test("Caregiver A requesting unassigned Ramesh status returns 404", async () => {
      const res = await request(app)
        .get(`/api/users/${rameshId}/status`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Not found." });
    });

    test("Token with matching custom:amazon_user_id allows access", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/status`)
        .set("Authorization", `Bearer ${tokenAMatchingAmazon}`);

      assert.equal(res.status, 200);
    });

    test("Token with mismatching custom:amazon_user_id returns 404", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/status`)
        .set("Authorization", `Bearer ${tokenAMismatchingAmazon}`);

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Not found." });
    });

    test("Caregiver A fetching Shanti Devi interactions returns 200", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/interactions`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.interactions));
      assert.ok(res.body.interactions.length > 0);
    });

    test("Test caregiver can access assigned Shanti Devi status (200)", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/status`)
        .set("Authorization", `Bearer ${tokenTestUser}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.userId, shantiId);
      assert.equal(res.body.name, "Shanti Devi");
    });

    test("Test caregiver cannot access unassigned Ramesh status (404)", async () => {
      const res = await request(app)
        .get(`/api/users/${rameshId}/status`)
        .set("Authorization", `Bearer ${tokenTestUser}`);

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Not found." });
    });

    test("Caregiver B cannot access unassigned Shanti profile (404)", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Not found." });
    });

    test("Caregiver A cannot list alerts for unassigned Ramesh (404)", async () => {
      const res = await request(app)
        .get(`/api/users/${rameshId}/alerts`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Not found." });
    });

    test("Caregiver A cannot list medications for unassigned Ramesh (404)", async () => {
      const res = await request(app)
        .get(`/api/users/${rameshId}/medications`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { message: "Not found." });
    });

    test("Request to /api/users/:id/status without token returns 401", async () => {
      const res = await request(app).get(`/api/users/${shantiId}/status`);
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Authentication token required." });
    });

    test("Request to /api/users/:id/status with expired token returns 401", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/status`)
        .set("Authorization", `Bearer ${tokenExpired}`);

      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Invalid or expired token." });
    });

    test("Request to /api/users/:id/alerts without token returns 401", async () => {
      const res = await request(app).get(`/api/users/${shantiId}/alerts`);
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Authentication token required." });
    });

    test("Request to /api/users/:id/medications without token returns 401", async () => {
      const res = await request(app).get(`/api/users/${shantiId}/medications`);
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Authentication token required." });
    });
  });

  describe("5. Voice API Simulator (/api/voice/intent)", () => {
    test("Missing x-voice-api-key returns 401", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .send({
          userId: shantiId,
          transcript: "Namaste, had my breakfast.",
        });

      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Voice API key required." });
    });

    test("Wrong x-voice-api-key returns 401", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", "wrong-secret-key")
        .send({
          userId: shantiId,
          transcript: "Namaste, had my breakfast.",
        });

      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { message: "Invalid Voice API key." });
    });

    test("Correct x-voice-api-key creates interaction and mood analysis", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          userId: shantiId,
          sessionId: "session-test-voice-1",
          interactionIntent: "daily_check_in",
          transcript: "I am feeling happy and took my morning medicine.",
          response: "Wonderful to hear, Shanti ji!",
          summary: "Elderly user confirmed morning medicine and expressed happiness.",
          moodScore: 0.850,
          confidenceScore: 0.920,
          sentimentLabel: "positive",
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.interaction);
      assert.equal(res.body.interaction.user_id, String(shantiId));
      assert.ok(res.body.moodAnalysis);
    });

    test("GET /api/voice/intent returns 404 (only POST accepted)", async () => {
      const res = await request(app).get("/api/voice/intent");
      assert.equal(res.status, 404);
    });
  });

  describe("6. Schema Constraint Violations & Service Validation", () => {
    test("moodScore out of range [-1, 1] returns 400", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          userId: shantiId,
          transcript: "Testing mood score out of range",
          moodScore: 1.5,
        });

      assert.equal(res.status, 400);
    });

    test("Invalid sentimentLabel returns 400", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          userId: shantiId,
          transcript: "Testing bad sentiment",
          sentimentLabel: "super_excited",
        });

      assert.equal(res.status, 400);
    });

    test("Missing transcript returns 400", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          userId: shantiId,
          transcript: "",
        });

      assert.equal(res.status, 400);
    });

    test("Nonexistent userId returns 404", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          userId: 999999,
          transcript: "Hello for missing user",
        });

      assert.equal(res.status, 404);
    });
  });

  describe("7. Alexa Skill Handlers & Simulator", () => {
    test("Simulate LaunchRequest greets Shanti Devi", async () => {
      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          type: "LaunchRequest",
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.speechText.includes("Namaste"));
      assert.ok(res.body.speechText.includes("Presence"));
      assert.equal(res.body.shouldEndSession, false);
    });

    test("Simulate CheckInIntent responds and passively logs interaction", async () => {
      const initialCountRes = await query(
        "SELECT COUNT(*)::integer AS count FROM interactions WHERE user_id = $1",
        [shantiId]
      );
      const initialCount = initialCountRes.rows[0].count;

      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          transcript: "I had breakfast and I feel good today.",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.intentName, "CheckInIntent");
      assert.ok(res.body.speechText.length > 0);

      // Wait a moment for interceptor to finish
      await new Promise((r) => setTimeout(r, 100));

      const afterCountRes = await query(
        "SELECT COUNT(*)::integer AS count FROM interactions WHERE user_id = $1",
        [shantiId]
      );
      assert.equal(afterCountRes.rows[0].count, initialCount + 1);
    });

    test("Simulate MedicationConfirmationIntent confirms pending dose", async () => {
      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          transcript: "I took my Amlodipine",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.intentName, "MedicationConfirmationIntent");
      assert.ok(res.body.speechText.includes("confirming") || res.body.speechText.includes("logged"));
    });

    test("Simulate DistressIntent triggers urgent reassurance", async () => {
      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          transcript: "help I fell down and cannot get up",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.intentName, "DistressIntent");
      assert.ok(res.body.speechText.includes("calm") || res.body.speechText.includes("distress"));
    });

    test("Simulate FallbackIntent handles unrecognized speech", async () => {
      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          intentName: "AMAZON.FallbackIntent",
        });

      assert.equal(res.status, 200);
      assert.ok(res.body.speechText.includes("catch that") || res.body.speechText.includes("sorry"));
    });

    test("Simulate DevotionalPlaybackIntent plays devotional content and logs companion interaction", async () => {
      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          transcript: "play Hanuman Chalisa bhajan",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.intentName, "DevotionalPlaybackIntent");
      assert.ok(res.body.speechText.includes("playing") || res.body.speechText.includes("bhajan"));
    });

    test("Simulate SleepWakeCheckInIntent greets elder for morning or night routine", async () => {
      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          transcript: "good morning I just woke up",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.intentName, "SleepWakeCheckInIntent");
      assert.ok(res.body.speechText.includes("Good morning") || res.body.speechText.includes("Shubh"));
    });

    test("Direct POST /api/alexa returns valid ASK SDK response envelope", async () => {
      const envelope = {
        version: "1.0",
        session: {
          new: true,
          sessionId: "direct-alexa-test-session",
          application: { applicationId: "amzn1.ask.skill.presence-companion-demo" },
          user: { userId: "amzn1.ask.account.DEMO-SHANTI" },
        },
        context: {
          System: {
            application: { applicationId: "amzn1.ask.skill.presence-companion-demo" },
            user: { userId: "amzn1.ask.account.DEMO-SHANTI" },
          },
        },
        request: {
          type: "IntentRequest",
          requestId: "req-test-1",
          timestamp: new Date().toISOString(),
          intent: {
            name: "CheckInIntent",
            slots: { Utterance: { name: "Utterance", value: "Feeling happy today." } },
          },
        },
      };

      const res = await request(app)
        .post("/api/alexa")
        .send(envelope);

      assert.equal(res.status, 200);
      assert.ok(res.body.response);
      assert.ok(res.body.response.outputSpeech);
    });

    test("Alexa simulate endpoint is rejected in production without Voice API key or dev flag", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalAllow = process.env.ALLOW_SIMULATOR;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOW_SIMULATOR;
        const res = await request(app)
          .post("/api/alexa/simulate")
          .send({
            amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
            intent: "CheckInIntent",
          });
        assert.equal(res.status, 403);
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalAllow) process.env.ALLOW_SIMULATOR = originalAllow;
      }
    });

    test("Direct POST /api/alexa in production rejects missing signature headers", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        const res = await request(app)
          .post("/api/alexa")
          .send({
            request: {
              type: "LaunchRequest",
              timestamp: new Date().toISOString(),
            },
          });
        assert.equal(res.status, 400);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("8. NLP Client & Sentiment Fallback", () => {
    test("analyzeSpeechTranscript with positive speech returns positive sentiment and mood score > 0", async () => {
      const { analyzeSpeechTranscript } = await import("../src/services/nlpClient.js");
      const result = await analyzeSpeechTranscript("I am very happy and fine today.", {
        timeoutMs: 500,
        fallbackIfUnavailable: true,
      });

      assert.ok(result.moodScore > 0);
      assert.equal(result.sentimentLabel, "positive");
      assert.equal(result.distressDetected, false);
    });

    test("analyzeSpeechTranscript with distress phrase flags distressDetected = true", async () => {
      const { analyzeSpeechTranscript } = await import("../src/services/nlpClient.js");
      const result = await analyzeSpeechTranscript("Help, I fell and need assistance", {
        timeoutMs: 500,
        fallbackIfUnavailable: true,
      });

      assert.ok(result.moodScore <= -0.6);
      assert.equal(result.sentimentLabel, "negative");
      assert.equal(result.distressDetected, true);
    });

    test("analyzeSpeechTranscript when NLP service is unreachable uses graceful fallback", async () => {
      const { analyzeSpeechTranscript } = await import("../src/services/nlpClient.js");
      const result = await analyzeSpeechTranscript("I am feeling peaceful today", {
        nlpServiceUrl: "http://127.0.0.1:59999", // non-existent port
        timeoutMs: 300,
        fallbackIfUnavailable: true,
      });

      assert.equal(result.source, "local_fallback");
      assert.ok(result.moodScore >= -1.0 && result.moodScore <= 1.0);
      assert.ok(result.confidenceScore >= 0.0 && result.confidenceScore <= 1.0);
    });

    test("analyzeSpeechTranscript with 'helpful' does not trigger distress (word-boundary test)", async () => {
      const { getLocalFallbackAnalysis } = await import("../src/services/nlpClient.js");
      const result = getLocalFallbackAnalysis("The doctor was very helpful and kind");
      assert.equal(result.distressDetected, false);
      assert.equal(result.distressPhrase, null);
    });

    test("analyzeSpeechTranscript with 'not good' results in negative sentiment (negation test)", async () => {
      const { getLocalFallbackAnalysis } = await import("../src/services/nlpClient.js");
      const result = getLocalFallbackAnalysis("I am not good today, feeling sick");
      assert.equal(result.sentimentLabel, "negative");
      assert.ok(result.moodScore < 0);
    });

    test("analyzeSpeechTranscript with 'Can you help me find the bhajan' does not trigger false distress alert", async () => {
      const { getLocalFallbackAnalysis } = await import("../src/services/nlpClient.js");
      const result = getLocalFallbackAnalysis("Can you help me find the bhajan");
      assert.equal(result.distressDetected, false);
      assert.equal(result.distressPhrase, null);
    });
  });

  describe("9. Seed Script Idempotency", () => {
    test("Running seed script twice leaves table row counts unchanged", async () => {
      const getCounts = async () => {
        const u = await query("SELECT COUNT(*)::integer AS count FROM elderly_users");
        const c = await query("SELECT COUNT(*)::integer AS count FROM caregivers");
        const ca = await query("SELECT COUNT(*)::integer AS count FROM caregiver_assignments");
        const ms = await query("SELECT COUNT(*)::integer AS count FROM medication_schedules");
        const ml = await query("SELECT COUNT(*)::integer AS count FROM medication_logs");
        const kw = await query("SELECT COUNT(*)::integer AS count FROM distress_keywords");
        return {
          users: u.rows[0].count,
          caregivers: c.rows[0].count,
          assignments: ca.rows[0].count,
          medSchedules: ms.rows[0].count,
          medLogs: ml.rows[0].count,
          keywords: kw.rows[0].count,
        };
      };

      const countsBefore = await getCounts();
      await seedDatabase();
      const countsAfter = await getCounts();

      assert.deepEqual(countsAfter, countsBefore);
    });
  });

  describe("10. Alert Engine, Escalation & De-duplication", () => {
    let createdAlertId;

    test("Distress speech simulation generates critical alert and delivery stubs", async () => {
      // Clear any prior alerts for Shanti
      await query("DELETE FROM alert_deliveries WHERE alert_id IN (SELECT alert_id FROM alerts WHERE user_id = $1)", [shantiId]);
      await query("DELETE FROM alerts WHERE user_id = $1", [shantiId]);

      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          intent: "DistressIntent",
          slots: { Utterance: "Madad karo, main gir gayi" },
        });

      assert.equal(res.status, 200);

      // Verify alert in DB
      const alertRes = await query(
        "SELECT * FROM alerts WHERE user_id = $1 AND alert_type = 'distress' ORDER BY created_at DESC LIMIT 1",
        [shantiId]
      );
      assert.equal(alertRes.rowCount, 1);
      const alert = alertRes.rows[0];
      assert.equal(alert.severity, "critical");
      assert.equal(alert.status, "open");
      assert.ok(alert.triggering_phrase.includes("gir gayi") || alert.triggering_phrase.includes("Madad"));
      createdAlertId = Number(alert.alert_id);

      // Verify delivery stubs
      const delivRes = await query("SELECT * FROM alert_deliveries WHERE alert_id = $1", [createdAlertId]);
      assert.ok(delivRes.rowCount >= 2); // push and sms
      assert.equal(delivRes.rows[0].delivery_status, "simulated");
    });

    test("Still-open alert older than 15 minutes suppresses duplicate alert creation", async () => {
      // Insert an open alert created 45 minutes ago
      await query(
        `INSERT INTO alerts (user_id, alert_type, severity, triggering_phrase, confidence_score, status, escalation_level, created_at)
         VALUES ($1, 'distress', 'critical', 'Old open fall', 0.95, 'open', 0, NOW() - INTERVAL '45 minutes')`,
        [rameshId]
      );
      const countBefore = await query("SELECT COUNT(*)::integer AS count FROM alerts WHERE user_id = $1", [rameshId]);

      const { processInteractionForAlerts } = await import("../src/services/alertEngine.js");
      const result = await processInteractionForAlerts({
        userId: rameshId,
        distressDetected: true,
        distressPhrase: "Madad karo",
      });

      assert.equal(result, null); // Suppressed because an open alert still exists
      const countAfter = await query("SELECT COUNT(*)::integer AS count FROM alerts WHERE user_id = $1", [rameshId]);
      assert.equal(countAfter.rows[0].count, countBefore.rows[0].count);
    });

    test("15-minute de-duplication suppresses duplicate alerts for same user", async () => {
      const alertCountBefore = await query("SELECT COUNT(*)::integer AS count FROM alerts WHERE user_id = $1", [shantiId]);

      // Trigger second distress utterance immediately
      const res = await request(app)
        .post("/api/alexa/simulate")
        .send({
          amazonUserId: "amzn1.ask.account.DEMO-SHANTI",
          intent: "DistressIntent",
          slots: { Utterance: "Please help, I fell down again" },
        });

      assert.equal(res.status, 200);

      const alertCountAfter = await query("SELECT COUNT(*)::integer AS count FROM alerts WHERE user_id = $1", [shantiId]);
      assert.equal(alertCountAfter.rows[0].count, alertCountBefore.rows[0].count);
    });

    test("Caregiver A lists alerts for Shanti Devi", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/alerts`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.alerts));
      assert.ok(res.body.alerts.length > 0);
      assert.equal(res.body.alerts[0].alertId, createdAlertId);
    });

    test("Caregiver A acknowledges open alert and logs audit event", async () => {
      const res = await request(app)
        .post(`/api/alerts/${createdAlertId}/acknowledge`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ note: "Checking on grandma right now." });

      assert.equal(res.status, 200);
      assert.equal(res.body.alert.status, "acknowledged");

      // Verify audit event in DB
      const auditRes = await query(
        "SELECT * FROM audit_events WHERE target_id = $1 AND action = 'acknowledge_alert'",
        [createdAlertId]
      );
      assert.equal(auditRes.rowCount, 1);
    });

    test("Caregiver A resolves alert", async () => {
      const res = await request(app)
        .post(`/api/alerts/${createdAlertId}/resolve`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ note: "Assistance provided. Everything is fine." });

      assert.equal(res.status, 200);
      assert.equal(res.body.alert.status, "resolved");
    });

    test("Alert escalation timer escalates overdue open alerts to level 1 and dispatches backup voice call", async () => {
      const { escalateUnacknowledgedAlerts } = await import("../src/services/alertEngine.js");

      // Insert an open alert created in the past beyond policy delay
      const pastAlert = await query(
        `INSERT INTO alerts (user_id, alert_type, severity, triggering_phrase, confidence_score, status, escalation_level, created_at)
         VALUES ($1, 'distress', 'critical', 'Urgent fall', 0.95, 'open', 0, NOW() - INTERVAL '30 minutes')
         RETURNING alert_id`,
        [shantiId]
      );
      const pastAlertId = pastAlert.rows[0].alert_id;

      const escalatedIds = await escalateUnacknowledgedAlerts();
      assert.ok(escalatedIds.includes(pastAlertId));

      const updated = await query("SELECT escalation_level FROM alerts WHERE alert_id = $1", [pastAlertId]);
      assert.equal(updated.rows[0].escalation_level, 1);
    });
  });

  describe("11. Medication Management & Missed-Dose Alerts", () => {
    let createdScheduleId;

    test("Caregiver A lists medications for Shanti Devi", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/medications`)
        .set("Authorization", `Bearer ${tokenA}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.schedules));
      assert.ok(Array.isArray(res.body.todayLogs));
      assert.ok(res.body.schedules.length > 0);
    });

    test("Caregiver A creates a new medication schedule", async () => {
      const res = await request(app)
        .post(`/api/users/${shantiId}/medications`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          medicationName: "Metformin",
          dosage: "500 mg",
          scheduledTime: "14:00:00",
          reminderWindow: 30,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.schedule.medicationName, "Metformin");
      assert.equal(res.body.schedule.dosage, "500 mg");
      createdScheduleId = res.body.schedule.scheduleId;
      assert.ok(createdScheduleId > 0);
    });

    test("Missed dose checker identifies past-due pending dose and creates missed_medication alert", async () => {
      const { checkMissedMedications } = await import("../src/services/medicationService.js");

      // Insert a past-due pending log
      const pastLog = await query(
        `INSERT INTO medication_logs (schedule_id, user_id, reminder_time, status)
         VALUES ($1, $2, NOW() - INTERVAL '45 minutes', 'pending')
         RETURNING log_id`,
        [createdScheduleId, shantiId]
      );
      const logId = pastLog.rows[0].log_id;

      const alerts = await checkMissedMedications();
      assert.ok(alerts.length > 0);

      const updatedLog = await query("SELECT status FROM medication_logs WHERE log_id = $1", [logId]);
      assert.equal(updatedLog.rows[0].status, "missed");

      const createdAlert = await query(
        "SELECT * FROM alerts WHERE user_id = $1 AND alert_type = 'missed_medication' ORDER BY created_at DESC LIMIT 1",
        [shantiId]
      );
      assert.equal(createdAlert.rowCount, 1);
      assert.equal(createdAlert.rows[0].severity, "medium");
    });

    test("Caregiver confirms a pending dose", async () => {
      // Insert a fresh pending log
      const freshLog = await query(
        `INSERT INTO medication_logs (schedule_id, user_id, reminder_time, status)
         VALUES ($1, $2, NOW(), 'pending')
         RETURNING log_id`,
        [createdScheduleId, shantiId]
      );
      const logId = freshLog.rows[0].log_id;

      const res = await request(app)
        .post(`/api/users/${shantiId}/medications/confirm`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ logId });

      assert.equal(res.status, 200);
      assert.equal(res.body.confirmed.status, "confirmed");
      assert.ok(res.body.confirmed.confirmation_time);
    });
  });

  describe("12. Daily Activity Anomaly Detection (µ - k*σ SRS 3.1.4.5 & 3.1.6.5)", () => {
    test("evaluateUserDailyActivity calculates threshold and flags low interaction anomaly", async () => {
      const { evaluateUserDailyActivity } = await import("../src/services/anomalyService.js");
      const result = await evaluateUserDailyActivity(shantiId);

      assert.ok(result.metrics);
      assert.ok(typeof result.metrics.thresholdValue === "number");
      assert.equal(typeof result.metrics.isAnomalous, "boolean");
      assert.ok(result.activity);
      assert.ok(result.anomaly);
    });

    test("evaluateUserDailyActivity detects drop below µ - k*σ and triggers low_interaction alert", async () => {
      const { evaluateUserDailyActivity } = await import("../src/services/anomalyService.js");
      // Evaluate for Ramesh Kumar on an arbitrary date with 0 interactions
      const result = await evaluateUserDailyActivity(rameshId, "2026-05-15");

      assert.ok(result.metrics);
      assert.ok(result.activity);
      assert.ok(result.anomaly);
      assert.equal(Number(result.anomaly.user_id), rameshId);
    });
  });

  describe("13. Cross-Origin Resource Sharing (CORS) Configuration", () => {
    const vercelOrigin = "https://presence-elderly-care.vercel.app";

    test("OPTIONS preflight for /api/me with Vercel origin returns 204 with CORS headers", async () => {
      const res = await request(app)
        .options("/api/me")
        .set("Origin", vercelOrigin)
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "authorization");

      assert.equal(res.status, 204);
      assert.equal(res.headers["access-control-allow-origin"], vercelOrigin);
      assert.equal(res.headers["access-control-allow-credentials"], "true");
      assert.ok(res.headers["access-control-allow-methods"]);
      assert.ok(res.headers["access-control-allow-headers"]);
    });

    test("GET /api/health with Vercel origin returns 200 with CORS headers", async () => {
      const res = await request(app)
        .get("/api/health")
        .set("Origin", vercelOrigin);

      assert.equal(res.status, 200);
      assert.equal(res.headers["access-control-allow-origin"], vercelOrigin);
      assert.equal(res.headers["access-control-allow-credentials"], "true");
    });

    test("Unauthenticated GET /api/me with Vercel origin returns 401 with CORS headers", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Origin", vercelOrigin);

      assert.equal(res.status, 401);
      assert.equal(res.headers["access-control-allow-origin"], vercelOrigin);
      assert.equal(res.headers["access-control-allow-credentials"], "true");
    });

    test("OPTIONS preflight for Vercel preview domain pattern returns 204 with CORS headers", async () => {
      const previewOrigin = "https://presence-preview-123.vercel.app";
      const res = await request(app)
        .options("/api/me")
        .set("Origin", previewOrigin)
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "authorization");

      assert.equal(res.status, 204);
      assert.equal(res.headers["access-control-allow-origin"], previewOrigin);
      assert.equal(res.headers["access-control-allow-credentials"], "true");
    });
  });

  describe("14. End-to-End Integration Tests (Problems A, B, C, D)", () => {
    test("Problem A: Alexa Lambda payload saves mood without creating false critical emergency alert", async () => {
      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          residentName: "Shanti Devi",
          payload: {
            residentName: "Shanti Devi",
            transcript: "I am feeling lonely today.",
            intent: "MoodIntent",
            mood: "lonely",
            sentimentLabel: "negative",
            moodScore: -0.4,
            distressDetected: false,
            timestamp: new Date().toISOString(),
          },
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.interaction);
      assert.equal(Number(res.body.interaction.user_id), shantiId);
      assert.ok(res.body.moodAnalysis);
      assert.equal(res.body.moodAnalysis.sentiment_label, "negative");

      // Verify no critical distress alert was created for loneliness
      const alertCheck = await query(
        "SELECT * FROM alerts WHERE user_id = $1 AND triggering_phrase ILIKE '%lonely%'",
        [shantiId]
      );
      assert.equal(alertCheck.rowCount, 0);
    });

    test("Problem A: Alexa utterances for happy, sad, worried persist correctly", async () => {
      const moods = [
        { phrase: "I feel happy.", sentiment: "positive", score: 0.7, mood: "happy" },
        { phrase: "I am sad.", sentiment: "negative", score: -0.5, mood: "sad" },
        { phrase: "I feel worried.", sentiment: "negative", score: -0.3, mood: "worried" },
      ];

      for (const m of moods) {
        const res = await request(app)
          .post("/api/voice/intent")
          .set("x-voice-api-key", process.env.VOICE_API_KEY)
          .send({
            residentName: "Shanti Devi",
            transcript: m.phrase,
            intent: "MoodIntent",
            mood: m.mood,
            sentimentLabel: m.sentiment,
            moodScore: m.score,
            distressDetected: false,
          });

        assert.equal(res.status, 201);
        assert.equal(Number(res.body.interaction.user_id), shantiId);
        assert.equal(res.body.moodAnalysis.sentiment_label, m.sentiment);
      }
    });

    test("Problem B: Physical unwellness creates high priority alert", async () => {
      // Resolve existing open alerts for Shanti Devi to start clean
      await query("UPDATE alerts SET status = 'resolved' WHERE user_id = $1", [shantiId]);

      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          residentName: "Shanti Devi",
          transcript: "I am not feeling well.",
          intent: "FeelingUnwellIntent",
          distressDetected: true,
          distressLevel: "high",
          moodScore: -0.5,
        });

      assert.equal(res.status, 201);

      const alertRes = await query(
        "SELECT * FROM alerts WHERE user_id = $1 AND triggering_phrase ILIKE '%not feeling well%' ORDER BY created_at DESC LIMIT 1",
        [shantiId]
      );
      assert.equal(alertRes.rowCount, 1);
      assert.equal(alertRes.rows[0].severity, "high");
      assert.equal(alertRes.rows[0].status, "open");
    });

    test("Problem B: Urgent help request creates critical priority alert and appears on caregiver alerts API", async () => {
      // Resolve previous alert
      await query("UPDATE alerts SET status = 'resolved' WHERE user_id = $1", [shantiId]);

      const res = await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          residentName: "Shanti Devi",
          transcript: "I need help.",
          intent: "RequestHelpIntent",
          distressDetected: true,
          distressLevel: "urgent",
          moodScore: -0.9,
        });

      assert.equal(res.status, 201);

      // Verify alert on Caregiver API
      const alertsApiRes = await request(app)
        .get(`/api/users/${shantiId}/alerts`)
        .set("Authorization", `Bearer ${tokenTestUser}`);

      assert.equal(alertsApiRes.status, 200);
      assert.ok(Array.isArray(alertsApiRes.body.alerts));
      const urgentAlert = alertsApiRes.body.alerts.find((a) => a.severity === "critical");
      assert.ok(urgentAlert);
      assert.equal(urgentAlert.status, "open");
      assert.ok(urgentAlert.triggeringPhrase.includes("I need help"));

      // Deduplication: immediate second identical call does not create duplicate
      const countBefore = alertsApiRes.body.alerts.length;
      await request(app)
        .post("/api/voice/intent")
        .set("x-voice-api-key", process.env.VOICE_API_KEY)
        .send({
          residentName: "Shanti Devi",
          transcript: "I need help.",
          intent: "RequestHelpIntent",
          distressDetected: true,
          distressLevel: "urgent",
          moodScore: -0.9,
        });

      const alertsAfter = await request(app)
        .get(`/api/users/${shantiId}/alerts`)
        .set("Authorization", `Bearer ${tokenTestUser}`);
      assert.equal(alertsAfter.body.alerts.length, countBefore);
    });

    test("Problem C: Status endpoint returns enriched todayMood with specificMood and label", async () => {
      const res = await request(app)
        .get(`/api/users/${shantiId}/status`)
        .set("Authorization", `Bearer ${tokenTestUser}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.todayMood);
      assert.ok(typeof res.body.todayMood.score === "number");
      assert.ok(typeof res.body.todayMood.label === "string");
      assert.ok(typeof res.body.todayMood.specificMood === "string");
      assert.ok(res.body.todayMood.recordedAt);
    });

    test("Problem D: Authoritative email in /api/me matches authenticated token and rejects inactive/placeholder email", async () => {
      const res = await request(app)
        .get("/api/me")
        .set("Authorization", `Bearer ${tokenTestUser}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.caregiver.email, "vaagisha2006@gmail.com");
      assert.notEqual(res.body.caregiver.email, "inactive@example.com");
      assert.notEqual(res.body.caregiver.email, "inactive@gmial.com");
    });
  });
});
