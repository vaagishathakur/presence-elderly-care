const DEFAULT_NLP_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000";

// Shared distress keyword list aligned with Python nlp-service analyzer
const LOCAL_DISTRESS_KEYWORDS = [
  // English
  "i fell",
  "i fell down",
  "chest pain",
  "cannot breathe",
  "cant breathe",
  "emergency",
  "i don't feel good",
  "i dont feel good",
  "not feeling well",
  "not feeling good",
  "very dizzy",
  // Hinglish & Hindi
  "bachao",
  "madad karo",
  "mujhe theek nahi lag raha",
  "theek nahi lag raha",
  "theek nahi hu",
  "theek nahi",
  "chot lag gayi",
  "dard ho raha hai",
  "gir gayi",
  "gir gaya",
  "chakkar aa rahe hai",
];

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDistressHelp(cleanText) {
  const words = cleanText.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.includes("help")) return false;

  // Filter out conversational non-emergency requests
  const isConversational =
    /\b(?:can|could|would|will|please)\s+you\s+help\s+me\b/i.test(cleanText) ||
    /\bhelp\s+me\s+(?:find|play|read|listen|tell|open|with|turn|set|show|explain)\b/i.test(cleanText) ||
    /\bhelp\s+with\b/i.test(cleanText);

  if (isConversational) {
    // Only flag if explicit emergency term is also present
    return /\b(?:fell|emergency|breathe|chest\s+pain|chot|gir|dard|bachao|accident)\b/i.test(cleanText);
  }

  // Short/standalone utterance (<= 4 words) like "help", "help me", "please help", "help please"
  if (words.length <= 4) {
    return true;
  }

  // Longer sentence containing emergency context alongside help
  if (
    /\bhelp\b.*?\b(?:fell|emergency|breathe|pain|hurt|bleeding|attack|accident|save|chot|gir)\b/i.test(cleanText) ||
    /\b(?:fell|emergency|breathe|pain|hurt|bleeding|attack|accident|save|chot|gir)\b.*?\bhelp\b/i.test(cleanText)
  ) {
    return true;
  }

  return false;
}

export function getLocalFallbackAnalysis(text = "") {
  const cleanText = (text || "").replace(/[^\w\s']/g, " ").trim();
  let distressFound = false;
  let distressPhrase = null;

  // 1. Check specific multi-word distress phrases
  for (const kw of LOCAL_DISTRESS_KEYWORDS) {
    const pattern = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
    if (pattern.test(cleanText)) {
      distressFound = true;
      distressPhrase = kw;
      break;
    }
  }

  // 2. Check "help" with context qualification (rejects "can you help me find the bhajan")
  if (!distressFound && isDistressHelp(cleanText)) {
    distressFound = true;
    distressPhrase = "help";
  }

  if (distressFound) {
    return {
      moodScore: -0.800,
      confidenceScore: 0.900,
      sentimentLabel: "negative",
      distressDetected: true,
      distressPhrase,
      modelVersion: "presence-local-fallback-v1",
      source: "local_fallback",
    };
  }

  // Check for negation of positive sentiment (e.g. "not good", "not feeling fine", "never happy")
  const isNegatedPositive =
    /\b(?:not|no|never|n't|dont|don't|nahi|nahin|na|cannot|can't)\s+(?:\w+\s+){0,2}(?:happy|good|great|fine|khush|peaceful)\b/i.test(
      cleanText
    );

  const hasPositiveWord =
    /\b(?:happy|good|great|fine|khush|peaceful)\b/i.test(cleanText);

  const hasNegativeWord =
    /\b(?:sad|tired|thak|udas|worried)\b/i.test(cleanText);

  let moodScore = 0.200;
  let sentimentLabel = "neutral";

  if (isNegatedPositive) {
    moodScore = -0.650;
    sentimentLabel = "negative";
  } else if (hasPositiveWord) {
    moodScore = 0.650;
    sentimentLabel = "positive";
  } else if (hasNegativeWord) {
    moodScore = -0.500;
    sentimentLabel = "negative";
  }

  return {
    moodScore,
    confidenceScore: 0.750,
    sentimentLabel,
    distressDetected: false,
    distressPhrase: null,
    modelVersion: "presence-local-fallback-v1",
    source: "local_fallback",
  };
}

export async function analyzeSpeechTranscript(
  text,
  {
    nlpServiceUrl = DEFAULT_NLP_URL,
    timeoutMs = 2500,
    fallbackIfUnavailable = true,
  } = {}
) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return getLocalFallbackAnalysis("");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${nlpServiceUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`NLP service returned HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      moodScore: Number(data.mood_score),
      confidenceScore: Number(data.confidence_score),
      sentimentLabel: data.sentiment_label,
      distressDetected: Boolean(data.distress_detected),
      distressPhrase: data.distress_phrase || null,
      modelVersion: data.model_version || "presence-nlp-v1",
      source: "nlp_service",
    };
  } catch (error) {
    clearTimeout(timer);

    if (fallbackIfUnavailable) {
      return getLocalFallbackAnalysis(text);
    }

    throw error;
  }
}
