export const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    const speechText =
      "I am sorry, I did not catch that clearly. You can tell me how you are feeling, or confirm if you took your medicine.";

    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.transcript = "Unrecognized utterance";
    sessionAttributes.intentName = "AMAZON.FallbackIntent";
    sessionAttributes.summary = "Fallback triggered on unrecognized speech.";
    sessionAttributes.sentiment = "unknown";
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("How are you feeling right now?")
      .getResponse();
  },
};
