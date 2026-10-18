const Alexa = require("ask-sdk-core");
const https = require("https");
const { URL } = require("url");

const BACKEND_URL = process.env.PRESENCE_BACKEND_URL || "https://elderly-monitoring-backend.onrender.com";
const VOICE_API_KEY = process.env.VOICE_API_KEY || "voice-secret-key-presence-demo";

/**
 * Safely extracts amazonUserId without using optional chaining (?.)
 */
function getAmazonUserId(handlerInput) {
  if (
    handlerInput &&
    handlerInput.requestEnvelope &&
    handlerInput.requestEnvelope.session &&
    handlerInput.requestEnvelope.session.user &&
    handlerInput.requestEnvelope.session.user.userId
  ) {
    return handlerInput.requestEnvelope.session.user.userId;
  }
  return null;
}

/**
 * Sends intent events directly to the live Presence backend using Node's
 * built-in https module (works in all Node versions, no fetch needed).
 */
function logToBackend(payload) {
  return new Promise(function (resolve) {
    try {
      const parsedUrl = new URL(BACKEND_URL + "/api/voice/intent");
      const postData = JSON.stringify(payload);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          "x-voice-api-key": VOICE_API_KEY,
        },
        timeout: 5000,
      };

      const req = https.request(options, function (res) {
        let responseBody = "";
        res.on("data", function (chunk) {
          responseBody += chunk;
        });
        res.on("end", function () {
          console.log("Presence backend response code:", res.statusCode);
          resolve();
        });
      });

      req.on("error", function (err) {
        console.warn("Presence backend connection note (non-blocking):", err.message);
        resolve();
      });

      req.on("timeout", function () {
        req.destroy();
        console.warn("Presence backend request timed out after 5s");
        resolve();
      });

      req.write(postData);
      req.end();
    } catch (err) {
      console.warn("Presence backend unexpected error:", err.message);
      resolve();
    }
  });
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "launch",
      transcript: "User opened Presence Elderly Care",
      summary: "Skill launched",
      sentimentLabel: "positive",
      moodScore: 0.5,
    });

    return handlerInput.responseBuilder
      .speak("Welcome to Presence Elderly Care. I am here to help you stay safe and healthy. You can ask for a daily check-in, hydration reminder, medication reminder, or request help.")
      .reprompt("Would you like to start your daily check-in?")
      .getResponse();
  }
};

const DailyCheckInIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "DailyCheckInIntent";
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "daily_check_in",
      transcript: "User started daily check-in",
      summary: "Daily check-in initiated",
      sentimentLabel: "positive",
      moodScore: 0.75,
    });

    return handlerInput.responseBuilder
      .speak("Let's do your daily check-in. Are you feeling alright today?")
      .reprompt("Please tell me how you are feeling.")
      .getResponse();
  }
};

const RequestHelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "RequestHelpIntent";
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    // CRITICAL: Triggers immediate caregiver dashboard alert & notification stubs
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "request_help",
      transcript: "User requested help or emergency assistance",
      summary: "EMERGENCY: User requested help via Alexa voice",
      distressDetected: true,
      distressPhrase: "I need help",
      sentimentLabel: "negative",
      moodScore: -0.9,
    });

    return handlerInput.responseBuilder
      .speak("You have requested help. I am alerting your configured caregiver immediately. If this is an emergency, please contact local emergency services right away.")
      .getResponse();
  }
};

const HydrationIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "HydrationIntent";
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "hydration_reminder",
      transcript: "Hydration reminder requested",
      summary: "Hydration prompt delivered",
      sentimentLabel: "neutral",
      moodScore: 0.2,
    });

    return handlerInput.responseBuilder
      .speak("This is your hydration reminder. Please drink some water if it is safe for you to do so.")
      .getResponse();
  }
};

const MedicationReminderIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "MedicationReminderIntent";
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "medication_reminder",
      transcript: "Medication reminder prompt",
      summary: "Medication schedule reminder delivered",
      sentimentLabel: "neutral",
      moodScore: 0.3,
    });

    return handlerInput.responseBuilder
      .speak("This is your medication reminder. Please follow your prescribed medication schedule. Have you taken your medicine today?")
      .reprompt("Did you take your medication today? Say yes or no.")
      .getResponse();
  }
};

const MoodCheckIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "MoodCheckIntent";
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "mood_check",
      transcript: "Mood check prompt",
      summary: "Emotional mood check",
      sentimentLabel: "neutral",
      moodScore: 0.3,
    });

    return handlerInput.responseBuilder
      .speak("How are you feeling emotionally today? You can tell me if you feel happy, sad, lonely, or worried.")
      .reprompt("How would you describe your mood today?")
      .getResponse();
  }
};

const YesIntentHandler = {
  canHandle(handlerInput) {
    const requestType = Alexa.getRequestType(handlerInput.requestEnvelope);
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    return requestType === "IntentRequest" &&
      (intentName === "AMAZON.YesIntent" || intentName === "MedicationConfirmationIntent");
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "medication_confirmation",
      transcript: "Yes, I took my medication and feel fine.",
      summary: "Medication dose confirmed taken by elder",
      sentimentLabel: "positive",
      moodScore: 0.8,
    });

    return handlerInput.responseBuilder
      .speak("I am glad to hear that. I have recorded your medicine as taken. Remember to stay hydrated and take care of yourself.")
      .getResponse();
  }
};

const NoIntentHandler = {
  canHandle(handlerInput) {
    const requestType = Alexa.getRequestType(handlerInput.requestEnvelope);
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    return requestType === "IntentRequest" &&
      (intentName === "AMAZON.NoIntent" || intentName === "MedicationNotTakenIntent");
  },
  async handle(handlerInput) {
    const amazonUserId = getAmazonUserId(handlerInput);
    await logToBackend({
      amazonUserId: amazonUserId,
      interactionIntent: "medication_not_taken",
      transcript: "No, I have not taken it or I am not feeling well.",
      summary: "Medication missed or negative check-in response",
      sentimentLabel: "negative",
      moodScore: -0.4,
    });

    return handlerInput.responseBuilder
      .speak("I am sorry to hear that. Would you like to tell me what is wrong, or would you like to request help?")
      .reprompt("You can tell me what is wrong or ask me to request help.")
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent";
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("I can help with your daily check-in, hydration reminders, medication reminders, and mood check. You can also ask me for help.")
      .reprompt("What would you like me to do?")
      .getResponse();
  }
};

const NavigateHomeIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "NavigateHomeIntent";
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("You are using Presence Elderly Care. How can I help you now?")
      .reprompt("You can ask for a check-in or a reminder.")
      .getResponse();
  }
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.FallbackIntent";
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Sorry, I did not understand that. You can ask for a check-in, hydration reminder, medication reminder, or help.")
      .reprompt("How can I help you?")
      .getResponse();
  }
};

const StopAndCancelIntentHandler = {
  canHandle(handlerInput) {
    const requestType = Alexa.getRequestType(handlerInput.requestEnvelope);
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);

    return requestType === "IntentRequest" &&
      ["AMAZON.StopIntent", "AMAZON.CancelIntent"].includes(intentName);
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Thank you for using Presence Elderly Care. Take care.")
      .withShouldEndSession(true)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log("Session ended:", handlerInput.requestEnvelope.request.reason);
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("Error handled:", error.message);
    return handlerInput.responseBuilder
      .speak("Sorry, something went wrong. Please try again.")
      .reprompt("Please try again.")
      .getResponse();
  }
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    DailyCheckInIntentHandler,
    RequestHelpIntentHandler,
    HydrationIntentHandler,
    MedicationReminderIntentHandler,
    MoodCheckIntentHandler,
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
