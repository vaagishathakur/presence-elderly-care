import { query } from "../../database/pool.js";
import { processInteractionForAlerts } from "../../services/alertEngine.js";
import { analyzeSpeechTranscript } from "../../services/nlpClient.js";

function cleanSpeech(outputSpeech) {
  if (!outputSpeech) return "";
  if (outputSpeech.ssml) {
    return outputSpeech.ssml.replace(/<[^>]*>/g, "").trim();
  }
  if (outputSpeech.text) {
    return outputSpeech.text.trim();
  }
  return "";
}

export const PassiveInteractionLoggingInterceptor = {
  async process(handlerInput, response) {
    try {
      const amazonUserId =
        handlerInput.requestEnvelope.session?.user?.userId ||
        handlerInput.requestEnvelope.context?.System?.user?.userId;

      if (!amazonUserId) {
        return;
      }

      const userRes = await query(
        `SELECT user_id FROM elderly_users WHERE amazon_user_id = $1`,
        [amazonUserId]
      );

      if (userRes.rowCount === 0) {
        return;
      }

      const userId = userRes.rows[0].user_id;
      const sessionId = handlerInput.requestEnvelope.session?.sessionId || "alexa-session";
      const requestType = handlerInput.requestEnvelope.request.type;
      const intentName =
        requestType === "IntentRequest"
          ? handlerInput.requestEnvelope.request.intent?.name
          : requestType;

      const sessionAttributes =
        handlerInput.attributesManager.getSessionAttributes() || {};

      const transcript =
        sessionAttributes.transcript ||
        (requestType === "LaunchRequest"
          ? "Open Presence"
          : intentName);

      const speechResponse = cleanSpeech(response?.outputSpeech);
      const summary =
        sessionAttributes.summary ||
        `Alexa interaction for ${intentName}`;

      const interactionRes = await query(
        `INSERT INTO interactions (user_id, session_id, interaction_intent, transcript, response, summary)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING interaction_id`,
        [userId, sessionId, intentName, transcript, speechResponse, summary]
      );

      const interactionId = interactionRes.rows[0]?.interaction_id;

      if (interactionId) {
        let nlpResult = null;
        if (
          sessionAttributes.moodScore !== undefined &&
          sessionAttributes.confidenceScore !== undefined
        ) {
          nlpResult = {
            moodScore: sessionAttributes.moodScore,
            confidenceScore: sessionAttributes.confidenceScore,
            sentimentLabel: sessionAttributes.sentiment || "neutral",
            distressDetected: Boolean(sessionAttributes.distressDetected),
            distressPhrase: sessionAttributes.distressPhrase || null,
            modelVersion: "presence-skill-attributed-v1",
          };
        } else {
          nlpResult = await analyzeSpeechTranscript(transcript, {
            timeoutMs: 1500,
            fallbackIfUnavailable: true,
          });
        }

        await query(
          `INSERT INTO mood_analyses (
             interaction_id, mood_score, confidence_score, sentiment_label,
             distress_detected, distress_phrase, model_version
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (interaction_id) DO NOTHING`,
          [
            interactionId,
            nlpResult.moodScore,
            nlpResult.confidenceScore,
            nlpResult.sentimentLabel,
            nlpResult.distressDetected,
            nlpResult.distressPhrase,
            nlpResult.modelVersion || "presence-hybrid-sentiment-v1",
          ]
        );

        // Evaluate interaction against alert engine for immediate dispatch and de-duplication
        await processInteractionForAlerts({
          userId,
          interactionId,
          transcript,
          moodScore: nlpResult.moodScore,
          confidenceScore: nlpResult.confidenceScore,
          distressDetected: nlpResult.distressDetected,
          distressPhrase: nlpResult.distressPhrase,
        });
      }
    } catch (err) {
      console.error("Passive interaction logging error:", err.message);
    }
  },
};
