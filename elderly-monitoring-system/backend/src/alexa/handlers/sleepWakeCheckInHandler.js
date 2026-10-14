export const SleepWakeCheckInIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "SleepWakeCheckInIntent"
    );
  },
  async handle(handlerInput) {
    const slots = handlerInput.requestEnvelope.request.intent.slots || {};
    const utterance =
      slots.Utterance?.value ||
      slots.Status?.value ||
      "Routine sleep wake check-in";

    const lower = utterance.toLowerCase();
    const isNight =
      lower.includes("night") ||
      lower.includes("sleep") ||
      lower.includes("so raha") ||
      lower.includes("bedtime");

    const speechText = isNight
      ? "Shubh ratri! Wishing you a peaceful and restful sleep. Your bedtime is logged. Rest well!"
      : "Shubh prabhat! Good morning! Wonderful to see you awake. Have you had your warm water and tea?";

    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.transcript = utterance;
    sessionAttributes.intentName = "SleepWakeCheckInIntent";
    sessionAttributes.summary = `Sleep/wake routine check-in: ${isNight ? "Bedtime" : "Morning wake-up"}`;
    sessionAttributes.sentiment = "positive";
    sessionAttributes.moodScore = 0.700;
    sessionAttributes.confidenceScore = 0.880;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("Is there anything else you need?")
      .getResponse();
  },
};
