import Alexa from "ask-sdk-core";
import https from "node:https";
import { URL } from "node:url";

const BACKEND_URL = (process.env.PRESENCE_BACKEND_URL ||
  "https://elderly-monitoring-backend.onrender.com").replace(/\/+$/, "");
const VOICE_API_KEY = process.env.VOICE_API_KEY || "voice-secret-key-presence-demo";
const RESIDENT_NAME = process.env.RESIDENT_NAME || "Shanti Devi";

function getAmazonUserId(handlerInput) {
  const sessionUser =
    handlerInput &&
    handlerInput.requestEnvelope &&
    handlerInput.requestEnvelope.session &&
    handlerInput.requestEnvelope.session.user;

  return sessionUser && sessionUser.userId ? sessionUser.userId : null;
}

function logToBackend(payload) {
  return new Promise(function (resolve) {
    try {
      const parsedUrl = new URL(BACKEND_URL + "/api/voice/intent");
      const postData = JSON.stringify({
        userId: Number(process.env.USER_ID || payload.userId || 1),
        residentName: RESIDENT_NAME,
        resident: RESIDENT_NAME,
        timestamp: new Date().toISOString(),
        ...payload,
      });

      const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "x-voice-api-key": VOICE_API_KEY,
      };

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + (parsedUrl.search || ""),
        method: "POST",
        headers: headers,
        timeout: 5000,
      };

      const req = https.request(options, function (res) {
        let responseBody = "";
        res.on("data", function (chunk) {
          responseBody += chunk;
        });
        res.on("end", function () {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          if (!success) {
            console.warn("Presence backend non-2xx status:", res.statusCode, responseBody.slice(0, 300));
          }
          let parsedData = null;
          try {
            parsedData = JSON.parse(responseBody);
          } catch (_) {}
          resolve({ success: success, statusCode: res.statusCode, data: parsedData });
        });
      });

      req.on("error", function (err) {
        console.warn("Presence backend network error:", err.message);
        resolve({ success: false, error: err.message });
      });

      req.on("timeout", function () {
        req.destroy(new Error("Backend request timed out"));
        console.warn("Presence backend request timed out after 5s");
        resolve({ success: false, error: "timeout" });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      console.warn("Could not initiate event to Presence backend:", err.message);
      resolve({ success: false, error: err.message });
    }
  });
}

function getIntentName(handlerInput) {
  return Alexa.getIntentName(handlerInput.requestEnvelope);
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.pendingQuestion = null;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "launch",
      transcript: "Shanti Devi opened Presence Elderly Care",
      summary: "Skill launched",
      sentimentLabel: "neutral",
      moodScore: 0,
      distressDetected: false,
    });

    return handlerInput.responseBuilder
      .speak(
        "Namaste, Shanti Devi. Welcome to Presence Elderly Care. I am here to help you stay safe and healthy. You can ask for a daily check-in, a hydration reminder, a medication reminder, or request help."
      )
      .reprompt("Shanti Devi, would you like to start your daily check-in?")
      .getResponse();
  },
};

const DailyCheckInIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "DailyCheckInIntent"
    );
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.pendingQuestion = "wellbeing_checkin";
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "daily_check_in",
      transcript: "Shanti Devi started daily check-in",
      summary: "Daily wellbeing check-in initiated",
      sentimentLabel: "neutral",
      moodScore: 0,
      distressDetected: false,
    });

    return handlerInput.responseBuilder
      .speak(
        "Let's do your daily check-in, Shanti Devi. How are you feeling today? You can say happy, sad, lonely, worried, or not well."
      )
      .reprompt("How are you feeling today, Shanti Devi?")
      .getResponse();
  },
};

const MoodCheckIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "MoodCheckIntent"
    );
  },
  async handle(handlerInput) {
    await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "mood_check",
      transcript: "Shanti Devi requested a mood check",
      summary: "Emotional mood check requested",
      sentimentLabel: "neutral",
      moodScore: 0,
      distressDetected: false,
    });

    return handlerInput.responseBuilder
      .speak("Shanti Devi, how are you feeling today? You can say happy, sad, lonely, or worried.")
      .reprompt("You can say happy, sad, lonely, or worried, Shanti Devi.")
      .getResponse();
  },
};

const MoodResponseIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "MoodResponseIntent"
    );
  },
  async handle(handlerInput) {
    const slots = handlerInput.requestEnvelope.request.intent.slots || {};
    const rawMood = slots.Mood && slots.Mood.value ? slots.Mood.value : "";
    const mood = rawMood.trim().toLowerCase();

    const moodResponses = {
      happy: {
        reply:
          "That's lovely to hear, Shanti Devi! What has made you happy today? You could share the good news with a family member or call someone you love.",
        sentimentLabel: "positive",
        moodScore: 0.8,
        summary: "Shanti Devi reported feeling happy",
      },
      sad: {
        reply:
          "I'm sorry you're feeling sad, Shanti Devi. Would you like to tell me what has been making you feel this way? Talking about it may help. You could also call a family member or someone you trust. I've recorded that you may appreciate some extra support.",
        sentimentLabel: "negative",
        moodScore: -0.5,
        summary: "Shanti Devi reported feeling sad; emotional support noted",
      },
      lonely: {
        reply:
          "I'm sorry you're feeling lonely, Shanti Devi. Would you like to call a family member or friend for a chat? You can also tell me what's on your mind. I've recorded that you may appreciate some company.",
        sentimentLabel: "negative",
        moodScore: -0.5,
        summary: "Shanti Devi reported feeling lonely; companionship recommended",
      },
      worried: {
        reply:
          "I'm here with you, Shanti Devi. Would you like to tell me what's worrying you? It may help to talk to someone you trust. You could also call a family member. I've recorded your feelings for your care circle.",
        sentimentLabel: "negative",
        moodScore: -0.5,
        summary: "Shanti Devi reported feeling worried; reassurance provided",
      },
    };

    const selected = moodResponses[mood];
    if (!selected) {
      return handlerInput.responseBuilder
        .speak("I didn't quite catch that, Shanti Devi. You can say happy, sad, lonely, or worried.")
        .reprompt("How are you feeling, Shanti Devi?")
        .getResponse();
    }

    const backendResult = await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "mood_response",
      transcript: "Shanti Devi reported feeling " + mood,
      summary: selected.summary,
      sentimentLabel: selected.sentimentLabel,
      moodScore: selected.moodScore,
      mood: mood,
      distressDetected: false,
      distressLevel: "none",
      distressPhrase: mood,
    });

    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.pendingQuestion = null;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    let replyText = selected.reply;
    if (!backendResult.success) {
      replyText = replyText.replace(
        /I've recorded [^.]+\./g,
        "I'm listening and here to support you."
      );
    }

    return handlerInput.responseBuilder
      .speak(replyText)
      .reprompt("I'm here if you'd like to share more, Shanti Devi.")
      .getResponse();
  },
};

const FeelingUnwellIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "FeelingUnwellIntent"
    );
  },
  async handle(handlerInput) {
    const backendResult = await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "feeling_unwell",
      transcript: "Shanti Devi reported feeling physically unwell",
      summary: "Shanti Devi reported feeling physically unwell",
      sentimentLabel: "negative",
      moodScore: -0.6,
      distressDetected: true,
      distressLevel: "high",
      distressPhrase: "feeling physically unwell",
    });

    let speechText = "";
    if (backendResult.success) {
      speechText =
        "I'm sorry you're not feeling well, Shanti Devi. I have created a high priority health notice on your caregiver dashboard. Can you tell me what is bothering you? If you feel seriously unwell or need urgent help, please contact your caregiver or local emergency services right away.";
    } else {
      speechText =
        "I'm sorry you're not feeling well, Shanti Devi. I am having trouble connecting to your dashboard right now. If you feel seriously unwell, please contact your caregiver directly or call emergency services immediately.";
    }

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt("Can you tell me a little more about how you're feeling, Shanti Devi?")
      .getResponse();
  },
};

const RequestHelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "RequestHelpIntent"
    );
  },
  async handle(handlerInput) {
    const backendResult = await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "request_help",
      transcript: "Shanti Devi requested help or emergency assistance",
      summary: "Help requested by Shanti Devi through Alexa",
      distressDetected: true,
      distressLevel: "urgent",
      distressPhrase: "request for help",
      sentimentLabel: "negative",
      moodScore: -0.9,
    });

    let speechText = "";
    if (backendResult.success) {
      speechText =
        "Shanti Devi, you have requested help. I have alerted your caregiver and recorded your critical alert on the Presence dashboard. Help is being notified. If this is an emergency, please contact local emergency services immediately.";
    } else {
      speechText =
        "Shanti Devi, you have requested help, but I could not reach the Presence backend. If you are in pain or in danger, please call local emergency services or contact someone near you immediately.";
    }

    return handlerInput.responseBuilder.speak(speechText).getResponse();
  },
};

const HydrationIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "HydrationIntent"
    );
  },
  async handle(handlerInput) {
    await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "hydration_reminder",
      transcript: "Hydration reminder requested",
      summary: "Hydration reminder delivered to Shanti Devi",
      sentimentLabel: "neutral",
      moodScore: 0,
      distressDetected: false,
    });

    return handlerInput.responseBuilder
      .speak("Shanti Devi, this is your hydration reminder. Please drink some water if it is safe for you to do so.")
      .getResponse();
  },
};

const MedicationReminderIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "MedicationReminderIntent"
    );
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.pendingQuestion = "medication_confirmation";
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    await logToBackend({
      amazonUserId: getAmazonUserId(handlerInput),
      interactionIntent: "medication_reminder",
      transcript: "Medication reminder delivered to Shanti Devi",
      summary: "Medication schedule reminder delivered",
      sentimentLabel: "neutral",
      moodScore: 0,
      distressDetected: false,
    });

    return handlerInput.responseBuilder
      .speak(
        "Shanti Devi, this is your medication reminder. Please follow your prescribed medication schedule. Have you taken your medicine today?"
      )
      .reprompt("Shanti Devi, have you taken your medication today? Please say yes or no.")
      .getResponse();
  },
};

const YesIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (getIntentName(handlerInput) === "AMAZON.YesIntent" ||
        getIntentName(handlerInput) === "MedicationConfirmationIntent")
    );
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const pendingQuestion = sessionAttributes.pendingQuestion;

    if (pendingQuestion === "medication_confirmation") {
      await logToBackend({
        amazonUserId: getAmazonUserId(handlerInput),
        interactionIntent: "medication_confirmation",
        transcript: "Shanti Devi confirmed taking medication",
        summary: "Medication dose reported as taken by Shanti Devi",
        sentimentLabel: "neutral",
        moodScore: 0,
        distressDetected: false,
      });
      sessionAttributes.pendingQuestion = null;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      return handlerInput.responseBuilder
        .speak("Thank you for letting me know, Shanti Devi. I've recorded your response about your medication. Remember to stay hydrated.")
        .getResponse();
    }

    if (pendingQuestion === "wellbeing_checkin") {
      await logToBackend({
        amazonUserId: getAmazonUserId(handlerInput),
        interactionIntent: "wellbeing_checkin_positive",
        transcript: "Shanti Devi said she is feeling alright",
        summary: "Positive daily wellbeing check-in",
        sentimentLabel: "positive",
        moodScore: 0.7,
        distressDetected: false,
      });
      sessionAttributes.pendingQuestion = null;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      return handlerInput.responseBuilder
        .speak("I'm glad to hear you're feeling alright, Shanti Devi. Remember to drink water and reach out to your family whenever you'd like a chat.")
        .getResponse();
    }

    return handlerInput.responseBuilder
      .speak("What are you saying yes to, Shanti Devi? You can ask for a daily check-in or a medication reminder.")
      .reprompt("How can I help you, Shanti Devi?")
      .getResponse();
  },
};

const NoIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (getIntentName(handlerInput) === "AMAZON.NoIntent" ||
        getIntentName(handlerInput) === "MedicationNotTakenIntent")
    );
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const pendingQuestion = sessionAttributes.pendingQuestion;

    if (pendingQuestion === "medication_confirmation") {
      await logToBackend({
        amazonUserId: getAmazonUserId(handlerInput),
        interactionIntent: "medication_not_taken",
        transcript: "Shanti Devi said she has not taken her medication",
        summary: "Medication not confirmed as taken",
        sentimentLabel: "neutral",
        moodScore: 0,
        distressDetected: false,
      });
      sessionAttributes.pendingQuestion = null;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      return handlerInput.responseBuilder
        .speak("Thank you for telling me, Shanti Devi. Please follow the medication instructions provided by your healthcare professional. Would you like me to repeat your reminder?")
        .reprompt("Would you like me to repeat your medication reminder?")
        .getResponse();
    }

    if (pendingQuestion === "wellbeing_checkin") {
      sessionAttributes.pendingQuestion = null;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      await logToBackend({
        amazonUserId: getAmazonUserId(handlerInput),
        interactionIntent: "wellbeing_checkin_negative",
        transcript: "Shanti Devi said she is not feeling alright",
        summary: "Negative daily wellbeing check-in; follow-up needed",
        sentimentLabel: "negative",
        moodScore: -0.4,
        distressDetected: true,
        distressLevel: "high",
        distressPhrase: "not feeling alright on check-in",
      });

      return handlerInput.responseBuilder
        .speak("I'm sorry to hear that, Shanti Devi. Would you like to tell me what's wrong? You can say sad, lonely, worried, or not well. If you need urgent help, please ask me for help.")
        .reprompt("What is bothering you, Shanti Devi?")
        .getResponse();
    }

    return handlerInput.responseBuilder
      .speak("All right, Shanti Devi. Let me know if you need anything.")
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Shanti Devi, I can help with your daily check-in, hydration reminders, medication reminders, mood check, or a request for help.")
      .reprompt("What would you like me to do, Shanti Devi?")
      .getResponse();
  },
};

const NavigateHomeIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "NavigateHomeIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Shanti Devi, you are using Presence Elderly Care. How can I help you now?")
      .reprompt("You can ask for a check-in or a reminder, Shanti Devi.")
      .getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput) === "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Sorry, Shanti Devi, I didn't understand that. You can ask for a daily check-in, hydration reminder, medication reminder, or help.")
      .reprompt("How can I help you, Shanti Devi?")
      .getResponse();
  },
};

const StopAndCancelIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      ["AMAZON.StopIntent", "AMAZON.CancelIntent"].includes(getIntentName(handlerInput))
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Thank you for using Presence Elderly Care, Shanti Devi. Take care.")
      .withShouldEndSession(true)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log("Session ended:", handlerInput.requestEnvelope.request.reason);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("Alexa skill error:", error);
    return handlerInput.responseBuilder
      .speak("Sorry, Shanti Devi, something went wrong. Please try again.")
      .reprompt("Please try again, Shanti Devi.")
      .getResponse();
  },
};

export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    DailyCheckInIntentHandler,
    MoodCheckIntentHandler,
    MoodResponseIntentHandler,
    FeelingUnwellIntentHandler,
    RequestHelpIntentHandler,
    HydrationIntentHandler,
    MedicationReminderIntentHandler,
    YesIntentHandler,
    NoIntentHandler,
    HelpIntentHandler,
    NavigateHomeIntentHandler,
    FallbackIntentHandler,
    StopAndCancelIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
