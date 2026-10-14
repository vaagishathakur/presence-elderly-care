import { invokeSkill } from "./skill.js";

function cleanSpeech(outputSpeech) {
  if (!outputSpeech) return "";
  if (outputSpeech.ssml) {
    return outputSpeech.ssml.replace(/<[^>]*>/g, "").trim();
  }
  if (outputSpeech.text) {
    return outputSpeech.text.trim();
  }
  return "";
}

export function buildAlexaEnvelope({
  amazonUserId = "amzn1.ask.account.DEMO-SHANTI",
  sessionId = `session-sim-${Date.now()}`,
  type = "IntentRequest",
  intentName = "CheckInIntent",
  transcript = "",
  slots = {},
}) {
  const finalSlots = {};
  for (const [key, val] of Object.entries(slots || {})) {
    if (typeof val === "string") {
      finalSlots[key] = { name: key, value: val, confirmationStatus: "NONE" };
    } else if (val && typeof val === "object") {
      finalSlots[key] = val;
    }
  }

  if (transcript && !finalSlots.Utterance) {
    finalSlots.Utterance = {
      name: "Utterance",
      value: transcript,
      confirmationStatus: "NONE",
    };
  }

  const baseEnvelope = {
    version: "1.0",
    session: {
      new: true,
      sessionId,
      application: {
        applicationId: "amzn1.ask.skill.presence-companion-demo",
      },
      user: {
        userId: amazonUserId,
      },
    },
    context: {
      System: {
        application: {
          applicationId: "amzn1.ask.skill.presence-companion-demo",
        },
        user: {
          userId: amazonUserId,
        },
        device: {
          deviceId: "simulated-echo-dot-device",
        },
      },
    },
    request:
      type === "LaunchRequest"
        ? {
            type: "LaunchRequest",
            requestId: `request-sim-${Date.now()}`,
            timestamp: new Date().toISOString(),
            locale: "en-IN",
          }
        : {
            type: "IntentRequest",
            requestId: `request-sim-${Date.now()}`,
            timestamp: new Date().toISOString(),
            locale: "en-IN",
            intent: {
              name: intentName,
              confirmationStatus: "NONE",
              slots: finalSlots,
            },
          },
  };

  return baseEnvelope;
}

export async function simulateAlexaUtterance({
  amazonUserId = "amzn1.ask.account.DEMO-SHANTI",
  transcript = "",
  intentName,
  type = "IntentRequest",
  slots = {},
}) {
  // Infer intent from transcript if not explicitly specified
  let inferredIntent = intentName;
  if (!inferredIntent) {
    const lower = (transcript || "").toLowerCase();
    if (type === "LaunchRequest" || lower.includes("open presence") || lower.includes("start presence")) {
      type = "LaunchRequest";
      inferredIntent = "LaunchRequest";
    } else if (
      lower.includes("medicine") ||
      lower.includes("tablet") ||
      lower.includes("amlodipine") ||
      lower.includes("metformin") ||
      lower.includes("dawa")
    ) {
      inferredIntent = "MedicationConfirmationIntent";
      if (!slots.MedicationName) {
        if (lower.includes("amlodipine")) {
          slots.MedicationName = { name: "MedicationName", value: "Amlodipine" };
        } else if (lower.includes("metformin")) {
          slots.MedicationName = { name: "MedicationName", value: "Metformin" };
        }
      }
    } else if (
      lower.includes("bhajan") ||
      lower.includes("aarti") ||
      lower.includes("mantra") ||
      lower.includes("devotional") ||
      lower.includes("geeta") ||
      lower.includes("prayer")
    ) {
      inferredIntent = "DevotionalPlaybackIntent";
      if (!slots.DevotionalItem) {
        slots.DevotionalItem = { name: "DevotionalItem", value: transcript };
      }
    } else if (
      lower.includes("sleep") ||
      lower.includes("bedtime") ||
      lower.includes("good night") ||
      lower.includes("good morning") ||
      lower.includes("woke up") ||
      lower.includes("so raha")
    ) {
      inferredIntent = "SleepWakeCheckInIntent";
    } else if (
      (lower.includes("help") &&
        !lower.includes("help me find") &&
        !lower.includes("help me play") &&
        !lower.includes("help me with")) ||
      lower.includes("fell") ||
      lower.includes("bachao") ||
      lower.includes("emergency") ||
      lower.includes("not feeling good") ||
      lower.includes("theek nahi lag raha")
    ) {
      inferredIntent = "DistressIntent";
    } else if (lower.includes("stop") || lower.includes("cancel") || lower.includes("bye")) {
      inferredIntent = "AMAZON.StopIntent";
    } else if (lower.includes("what can you do")) {
      inferredIntent = "AMAZON.HelpIntent";
    } else {
      inferredIntent = "CheckInIntent";
    }
  }

  const envelope = buildAlexaEnvelope({
    amazonUserId,
    type,
    intentName: inferredIntent,
    transcript,
    slots,
  });

  const responseEnvelope = await invokeSkill(envelope);
  const speechText = cleanSpeech(responseEnvelope?.response?.outputSpeech);
  const shouldEndSession = Boolean(responseEnvelope?.response?.shouldEndSession);

  return {
    speechText,
    shouldEndSession,
    intentName: inferredIntent,
    requestEnvelope: envelope,
    responseEnvelope,
  };
}
