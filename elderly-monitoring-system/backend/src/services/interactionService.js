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
  const {
    userId,
    elderlyUserId,
    sessionId = null,
    interactionIntent = "general_check_in",
    intent,
    transcript,
    transcriptSummary,
    response = null,
    summary = null,
    moodScore = null,
    confidenceScore = null,
    moodConfidence = null,
    sentimentLabel = null,
    moodLabel = null,
    distressDetected = false,
    distressPhrase = null,
  } = payload;

  const targetUserId = userId ?? elderlyUserId;
  const userNum = Number(targetUserId);

  if (targetUserId === undefined || targetUserId === null || !Number.isInteger(userNum) || userNum <= 0) {
    const error = new Error("userId is required and must be a positive integer.");
    error.statusCode = 400;
    throw error;
  }

  const finalTranscript = transcript || transcriptSummary;
  if (!finalTranscript || typeof finalTranscript !== "string" || finalTranscript.trim().length === 0) {
    const error = new Error("transcript is required.");
    error.statusCode = 400;
    throw error;
  }

  const finalIntent = intent || interactionIntent;

  let parsedMoodScore = null;
  if (moodScore !== null && moodScore !== undefined) {
    const msNum = Number(moodScore);
    if (typeof moodScore === "boolean" || Number.isNaN(msNum) || msNum < -1.0 || msNum > 1.0) {
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

  let finalSentiment = sentimentLabel ?? (moodLabel === "happy" ? "positive" : moodLabel === "sad" ? "negative" : moodLabel === "neutral" ? "neutral" : moodLabel ? "unknown" : null);
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
          distressPhrase,
        ]
      );
      moodAnalysisRow = moodResult.rows[0];
    }

    await client.query("COMMIT");

    if (moodAnalysisRow) {
      try {
        await processInteractionForAlerts({
          userId: userNum,
          interactionId: insertedInteraction.interaction_id,
          transcript: finalTranscript.trim(),
          moodScore: parsedMoodScore,
          confidenceScore: parsedConfidence,
          distressDetected: Boolean(distressDetected),
          distressPhrase,
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
