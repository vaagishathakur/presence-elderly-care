import { getClient, query } from "../database/pool.js";
import { processInteractionForAlerts } from "./alertEngine.js";

export const ALLOWED_SENTIMENT_LABELS = ["positive", "neutral", "negative", "unknown"];

export async function listUserInteractions(userId, { limit = 20, offset = 0 } = {}) {
  const userNum = Number(userId);
  const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const parsedOffset = Math.max(Number(offset) || 0, 0);

  const result = await query(
    `SELECT
       i.interaction_id,
       i.user_id,
       i.session_id,
       i.interaction_intent,
       i.transcript,
       i.response,
       i.summary,
       i.interaction_at,
       m.mood_score,
       m.confidence_score,
       m.sentiment_label,
       m.distress_detected,
       m.distress_phrase,
       m.model_version
     FROM interactions i
     LEFT JOIN mood_analyses m ON m.interaction_id = i.interaction_id
     WHERE i.user_id = $1
     ORDER BY i.interaction_at DESC
     LIMIT $2 OFFSET $3`,
    [userNum, parsedLimit, parsedOffset]
  );

  return result.rows.map((row) => ({
    interactionId: Number(row.interaction_id),
    userId: Number(row.user_id),
    sessionId: row.session_id,
    interactionIntent: row.interaction_intent,
    transcript: row.transcript,
    response: row.response,
    summary: row.summary,
    interactionAt: row.interaction_at,
    moodAnalysis: row.sentiment_label
      ? {
          moodScore: row.mood_score !== null ? Number(row.mood_score) : null,
          confidenceScore: row.confidence_score !== null ? Number(row.confidence_score) : null,
          sentimentLabel: row.sentiment_label,
          distressDetected: row.distress_detected,
          distressPhrase: row.distress_phrase,
          modelVersion: row.model_version,
        }
      : null,
  }));
}

export async function createInteraction(payload = {}) {
  // Support both flat payload and nested { residentName, payload: { ... } } from Alexa Lambda
  const data = (payload && typeof payload.payload === "object" && payload.payload !== null)
    ? { ...payload.payload, residentName: payload.residentName || payload.payload.residentName, resident: payload.resident || payload.payload.resident, ...payload, payload: undefined }
    : { ...payload };

  const {
    userId,
    elderlyUserId,
    residentId,
    amazonUserId,
    residentName,
    resident,
    sessionId = null,
    interactionIntent = "general_check_in",
    intent,
    transcript,
    transcriptSummary,
    utterance,
    response = null,
    summary = null,
    mood = null,
    moodScore = null,
    confidenceScore = null,
    moodConfidence = null,
    sentimentLabel = null,
    moodLabel = null,
    distressDetected = false,
    distressPhrase = null,
    distressLevel = null,
  } = data;

  let targetUserId = userId ?? elderlyUserId ?? residentId;

  // Resolve target resident if not explicitly provided as an ID
  if (targetUserId === undefined || targetUserId === null) {
    if (amazonUserId) {
      const userRes = await query("SELECT user_id FROM elderly_users WHERE amazon_user_id = $1", [amazonUserId]);
      if (userRes.rowCount > 0) {
        targetUserId = userRes.rows[0].user_id;
      }
    }

    if (!targetUserId && (residentName || resident)) {
      const nameToMatch = (residentName || resident).trim();
      const nameRes = await query(
        "SELECT user_id FROM elderly_users WHERE name ILIKE $1 ORDER BY user_id ASC LIMIT 1",
        [`%${nameToMatch}%`]
      );
      if (nameRes.rowCount > 0) {
        targetUserId = nameRes.rows[0].user_id;
      }
    }

    if (!targetUserId) {
      const defaultElder = await query("SELECT user_id FROM elderly_users ORDER BY user_id ASC LIMIT 1");
      if (defaultElder.rowCount > 0) {
        targetUserId = defaultElder.rows[0].user_id;
      }
    }
  }

  const userNum = Number(targetUserId);

  if (targetUserId === undefined || targetUserId === null || !Number.isInteger(userNum) || userNum <= 0) {
    const error = new Error("userId is required and must be a positive integer.");
    error.statusCode = 400;
    throw error;
  }

  const rawTranscript = transcript ?? transcriptSummary ?? utterance ?? summary;
  if (!rawTranscript || typeof rawTranscript !== "string" || rawTranscript.trim().length === 0) {
    const error = new Error("transcript is required.");
    error.statusCode = 400;
    throw error;
  }
  const finalTranscript = rawTranscript.trim();

  const finalIntent = intent || interactionIntent || "general_check_in";

  // Normalize mood inputs
  const rawMood = (mood || moodLabel || "").toString().trim().toLowerCase();
  let finalSentiment = sentimentLabel;
  let finalMoodScore = moodScore;
  let finalDistressPhrase = distressPhrase;

  if (rawMood) {
    if (rawMood === "happy") {
      finalSentiment = finalSentiment || "positive";
      finalMoodScore = finalMoodScore !== null ? finalMoodScore : 0.8;
      finalDistressPhrase = finalDistressPhrase || "happy";
    } else if (rawMood === "sad") {
      finalSentiment = finalSentiment || "negative";
      finalMoodScore = finalMoodScore !== null ? finalMoodScore : -0.5;
      finalDistressPhrase = finalDistressPhrase || "sad";
    } else if (rawMood === "lonely") {
      finalSentiment = finalSentiment || "negative";
      finalMoodScore = finalMoodScore !== null ? finalMoodScore : -0.5;
      finalDistressPhrase = finalDistressPhrase || "lonely";
    } else if (rawMood === "worried") {
      finalSentiment = finalSentiment || "negative";
      finalMoodScore = finalMoodScore !== null ? finalMoodScore : -0.5;
      finalDistressPhrase = finalDistressPhrase || "worried";
    } else if (rawMood === "neutral") {
      finalSentiment = finalSentiment || "neutral";
      finalMoodScore = finalMoodScore !== null ? finalMoodScore : 0;
    }
  }

  let parsedMoodScore = null;
  if (finalMoodScore !== null && finalMoodScore !== undefined) {
    const msNum = Number(finalMoodScore);
    if (typeof finalMoodScore === "boolean" || Number.isNaN(msNum) || msNum < -1.0 || msNum > 1.0) {
      const error = new Error("moodScore must be a number between -1 and 1.");
      error.statusCode = 400;
      throw error;
    }
    parsedMoodScore = msNum;
  }

  let parsedConfidence = null;
  const targetConfidence = confidenceScore ?? moodConfidence;
  if (targetConfidence !== null && targetConfidence !== undefined) {
    const confNum = Number(targetConfidence);
    if (typeof targetConfidence === "boolean" || Number.isNaN(confNum) || confNum < 0.0 || confNum > 1.0) {
      const error = new Error("confidenceScore must be a number between 0 and 1.");
      error.statusCode = 400;
      throw error;
    }
    parsedConfidence = confNum;
  }

  if (finalSentiment && !ALLOWED_SENTIMENT_LABELS.includes(finalSentiment)) {
    const error = new Error(`Invalid sentimentLabel '${finalSentiment}'. Allowed values: ${ALLOWED_SENTIMENT_LABELS.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const interactionResult = await client.query(
      `INSERT INTO interactions (user_id, session_id, interaction_intent, transcript, response, summary)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING interaction_id, user_id, session_id, interaction_intent, transcript, response, summary, interaction_at`,
      [userNum, sessionId, finalIntent, finalTranscript.trim(), response, summary || finalTranscript.trim()]
    );

    const insertedInteraction = interactionResult.rows[0];

    let moodAnalysisRow = null;
    if (parsedMoodScore !== null || parsedConfidence !== null || finalSentiment !== null || distressDetected) {
      const moodResult = await client.query(
        `INSERT INTO mood_analyses (interaction_id, mood_score, confidence_score, sentiment_label, distress_detected, distress_phrase)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING mood_analysis_id, interaction_id, mood_score, confidence_score, sentiment_label, distress_detected, distress_phrase, created_at`,
        [
          insertedInteraction.interaction_id,
          parsedMoodScore,
          parsedConfidence,
          finalSentiment || "unknown",
          Boolean(distressDetected),
          finalDistressPhrase,
        ]
      );
      moodAnalysisRow = moodResult.rows[0];
    }

    await client.query("COMMIT");

    if (moodAnalysisRow || distressDetected) {
      try {
        await processInteractionForAlerts({
          userId: userNum,
          interactionId: insertedInteraction.interaction_id,
          transcript: finalTranscript.trim(),
          moodScore: parsedMoodScore,
          confidenceScore: parsedConfidence,
          distressDetected: Boolean(distressDetected),
          distressPhrase: finalDistressPhrase || (distressDetected ? finalTranscript.trim() : null),
          distressLevel,
        });
      } catch (alertErr) {
        console.error("Alert processing error on createInteraction:", alertErr.message);
      }
    }

    return {
      interaction: insertedInteraction,
      moodAnalysis: moodAnalysisRow,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23503") {
      error.statusCode = 404;
      error.message = "Elderly user not found.";
    } else if (error.code === "23514") {
      error.statusCode = 400;
      error.message = "Constraint validation failed.";
    } else if (error.code === "22003") {
      error.statusCode = 400;
      error.message = "Numeric value is out of range.";
    }

    throw error;
  } finally {
    client.release();
  }
}
