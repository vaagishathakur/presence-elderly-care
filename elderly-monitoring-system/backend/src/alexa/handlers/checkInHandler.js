export const CheckInIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "CheckInIntent"
    );
  },
  async handle(handlerInput) {
    const slots = handlerInput.requestEnvelope.request.intent.slots || {};
    const utterance =
      slots.Utterance?.value ||
      slots.Phrase?.value ||
      slots.Statement?.value ||
      handlerInput.requestEnvelope.request.intent.name;

    const speechText =
      "Thank you for sharing with me. It is always good to hear from you. Remember to stay hydrated and take rest whenever you need.";

    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.transcript = utterance;
    sessionAttributes.intentName = "CheckInIntent";
    sessionAttributes.summary = `Routine check-in: "${utterance}"`;
    sessionAttributes.sentiment = "neutral";
    sessionAttributes.moodScore = 0.500;
    sessionAttributes.confidenceScore = 0.850;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("Is there anything else you would like to share?")
      .getResponse();
  },
};
