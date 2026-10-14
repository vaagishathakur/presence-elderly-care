import { query } from "../../database/pool.js";

export const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "LaunchRequest";
  },
  async handle(handlerInput) {
    const amazonUserId =
      handlerInput.requestEnvelope.session?.user?.userId ||
      handlerInput.requestEnvelope.context?.System?.user?.userId;

    let greetingName = "there";

    if (amazonUserId) {
      const userRes = await query(
        `SELECT u.name, p.preferred_name
         FROM elderly_users u
         LEFT JOIN user_preferences p ON p.user_id = u.user_id
         WHERE u.amazon_user_id = $1`,
        [amazonUserId]
      );
      if (userRes.rowCount > 0) {
        greetingName =
          userRes.rows[0].preferred_name || userRes.rows[0].name;
      }
    }

    const speechText = `Namaste ${greetingName}! I am Presence, your daily companion. How are you feeling today?`;
    const repromptText = "You can tell me how your day is going, or let me know if you took your medicine.";

    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.transcript = "Open Presence companion";
    sessionAttributes.intentName = "LaunchRequest";
    sessionAttributes.summary = "Elderly user launched Presence companion skill.";
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .getResponse();
  },
};
