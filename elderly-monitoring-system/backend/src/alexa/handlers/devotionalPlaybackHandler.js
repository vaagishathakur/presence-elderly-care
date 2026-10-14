export const DevotionalPlaybackIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "DevotionalPlaybackIntent"
    );
  },
  async handle(handlerInput) {
    const slots = handlerInput.requestEnvelope.request.intent.slots || {};
    const item =
      slots.DevotionalItem?.value ||
      slots.SongName?.value ||
      slots.Utterance?.value ||
      "peaceful bhajans";

    const speechText =
      `Now playing ${item} for you. Sit back comfortably, relax, and let me know if you would like me to pause or change it.`;

    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.transcript = `Play devotional: ${item}`;
    sessionAttributes.intentName = "DevotionalPlaybackIntent";
    sessionAttributes.summary = `Devotional companion playback: ${item}`;
    sessionAttributes.sentiment = "positive";
    sessionAttributes.moodScore = 0.800;
    sessionAttributes.confidenceScore = 0.900;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("Would you like me to continue playing the devotional music?")
      .getResponse();
  },
};
