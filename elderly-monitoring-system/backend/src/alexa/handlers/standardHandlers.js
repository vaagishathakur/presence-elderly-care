export const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speechText =
      "I am Presence, your daily companion. You can tell me how your day is going, confirm your medicines, or ask for assistance.";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("How can I help you today?")
      .getResponse();
  },
};

export const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      (handlerInput.requestEnvelope.request.intent.name === "AMAZON.CancelIntent" ||
        handlerInput.requestEnvelope.request.intent.name === "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speechText = "Take good care of yourself. I am always here if you need me. Goodbye!";

    return handlerInput.responseBuilder.speak(speechText).getResponse();
  },
};

export const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "SessionEndedRequest";
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  },
};

export const CustomErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("Alexa Skill Error:", error.message);
    const speechText = "I encountered a momentary problem. Please try speaking to me again.";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("Please try again.")
      .getResponse();
  },
};
