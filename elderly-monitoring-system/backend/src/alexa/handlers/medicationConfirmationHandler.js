import { query } from "../../database/pool.js";

export const MedicationConfirmationIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "MedicationConfirmationIntent"
    );
  },
  async handle(handlerInput) {
    const amazonUserId =
      handlerInput.requestEnvelope.session?.user?.userId ||
      handlerInput.requestEnvelope.context?.System?.user?.userId;

    const slots = handlerInput.requestEnvelope.request.intent.slots || {};
    const medNameSlot = slots.MedicationName?.value;
    const utterance =
      slots.Utterance?.value ||
      (medNameSlot ? `I took my ${medNameSlot}` : "I took my medicine");

    let confirmedMedName = null;

    if (amazonUserId) {
      const userRes = await query(
        `SELECT user_id, timezone FROM elderly_users WHERE amazon_user_id = $1`,
        [amazonUserId]
      );

      if (userRes.rowCount > 0) {
        const userId = userRes.rows[0].user_id;
        const tz = userRes.rows[0].timezone || "Asia/Kolkata";

        let pendingLogQuery = `
          SELECT ml.log_id, ms.medication_name
          FROM medication_logs ml
          JOIN medication_schedules ms ON ms.schedule_id = ml.schedule_id
          WHERE ml.user_id = $1
            AND (ml.reminder_time AT TIME ZONE $2)::date = (CURRENT_TIMESTAMP AT TIME ZONE $2)::date
            AND ml.status IN ('pending', 'late')
        `;
        const params = [userId, tz];

        if (medNameSlot) {
          pendingLogQuery += ` AND LOWER(ms.medication_name) LIKE LOWER($3)`;
          params.push(`%${medNameSlot}%`);
        }

        pendingLogQuery += ` ORDER BY ml.reminder_time ASC LIMIT 1`;

        const logRes = await query(pendingLogQuery, params);

        if (logRes.rowCount > 0) {
          const logId = logRes.rows[0].log_id;
          confirmedMedName = logRes.rows[0].medication_name;

          await query(
            `UPDATE medication_logs
             SET status = 'confirmed', confirmation_time = NOW()
             WHERE log_id = $1`,
            [logId]
          );
        }
      }
    }

    const speechText = confirmedMedName
      ? `Thank you for confirming. I have recorded that you took your ${confirmedMedName}. Excellent job!`
      : "Thank you for confirming. I have logged that you took your scheduled medicine.";

    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.transcript = utterance;
    sessionAttributes.intentName = "MedicationConfirmationIntent";
    sessionAttributes.summary = `Medication confirmed: ${confirmedMedName || "routine medication"}`;
    sessionAttributes.sentiment = "positive";
    sessionAttributes.moodScore = 0.700;
    sessionAttributes.confidenceScore = 0.900;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("Is there anything else I can help you with?")
      .getResponse();
  },
};
