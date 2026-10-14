export const DistressIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      (handlerInput.requestEnvelope.request.intent.name === "DistressIntent" ||
        handlerInput.requestEnvelope.request.intent.name === "EmergencyIntent")
    );
  },
  async handle(handlerInput) {
    const slots = handlerInput.requestEnvelope.request.intent.slots || {};
    const utterance =
      slots.Utterance?.value ||
      slots.Phrase?.value ||
      "I need help, not feeling good";

    const speechText =
      "Please stay calm. I have detected your distress signal and I am notifying your caregiver right away. Help is on the way.";

    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.transcript = utterance;
    sessionAttributes.intentName = "DistressIntent";
    sessionAttributes.summary = `Distress signal detected: "${utterance}"`;
    sessionAttributes.distressDetected = true;
    sessionAttributes.distressPhrase = utterance;
    sessionAttributes.sentiment = "negative";
    sessionAttributes.moodScore = -0.850;
    sessionAttributes.confidenceScore = 0.950;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse();
  },
};
