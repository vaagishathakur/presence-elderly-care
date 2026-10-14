import re
from typing import Optional, Tuple, Dict, Any

DISTRESS_KEYWORDS = [
    # English
    {"phrase": "help", "category": "emergency", "severity": "critical"},
    {"phrase": "i fell", "category": "fall", "severity": "critical"},
    {"phrase": "i fell down", "category": "fall", "severity": "critical"},
    {"phrase": "i don't feel good", "category": "health", "severity": "high"},
    {"phrase": "i dont feel good", "category": "health", "severity": "high"},
    {"phrase": "not feeling well", "category": "health", "severity": "high"},
    {"phrase": "chest pain", "category": "cardiac", "severity": "critical"},
    {"phrase": "cannot breathe", "category": "respiratory", "severity": "critical"},
    {"phrase": "cant breathe", "category": "respiratory", "severity": "critical"},
    {"phrase": "very dizzy", "category": "health", "severity": "high"},
    # Hinglish & Hindi
    {"phrase": "bachao", "category": "emergency", "severity": "critical"},
    {"phrase": "mujhe theek nahi lag raha", "category": "health", "severity": "high"},
    {"phrase": "theek nahi lag raha", "category": "health", "severity": "high"},
    {"phrase": "theek nahi hu", "category": "health", "severity": "high"},
    {"phrase": "chot lag gayi", "category": "injury", "severity": "critical"},
    {"phrase": "dard ho raha hai", "category": "pain", "severity": "high"},
    {"phrase": "gir gayi", "category": "fall", "severity": "critical"},
    {"phrase": "gir gaya", "category": "fall", "severity": "critical"},
    {"phrase": "madad karo", "category": "emergency", "severity": "critical"},
    {"phrase": "chakkar aa rahe hai", "category": "health", "severity": "high"},
]

POSITIVE_LEXICON = {
    "happy": 0.85, "great": 0.90, "good": 0.65, "fine": 0.50,
    "wonderful": 0.95, "slept well": 0.80, "peaceful": 0.75, "relaxed": 0.70,
    "energetic": 0.85, "khush": 0.85, "theek hu": 0.60, "shanti": 0.75,
    "anand": 0.85, "mast": 0.80, "cheerful": 0.85, "blessed": 0.85,
    "better": 0.60, "loving": 0.80, "enjoying": 0.80, "healthy": 0.75
}

NEGATIVE_LEXICON = {
    "sad": -0.70, "pain": -0.80, "hurt": -0.85, "tired": -0.45,
    "exhausted": -0.65, "lonely": -0.75, "anxious": -0.70, "worried": -0.65,
    "sick": -0.80, "dard": -0.75, "thak": -0.45, "pareshan": -0.70,
    "chinta": -0.65, "udas": -0.75, "dukh": -0.80, "gussa": -0.60,
    "terrible": -0.90, "awful": -0.90, "unwell": -0.70, "dizzy": -0.65
}

GREETINGS = ["namaste", "hello", "hi", "morning", "night", "tea", "breakfast"]

NEGATION_PATTERN = r"\b(?:not|no|never|n't|dont|don't|nahi|nahin|na|cannot|can't)\b"

def is_distress_help(text: str) -> bool:
    clean = re.sub(r"[^\w\s']", " ", text.lower()).strip()
    words = clean.split()
    if "help" not in words:
        return False

    # Filter out conversational non-emergency requests (e.g. "can you help me find the bhajan")
    conversational_patterns = [
        r"\b(?:can|could|would|will|please)\s+you\s+help\s+me\b",
        r"\bhelp\s+me\s+(?:find|play|read|listen|tell|open|with|turn|set|show|explain)\b",
        r"\bhelp\s+with\b",
    ]
    for cp in conversational_patterns:
        if re.search(cp, clean):
            # Only flag if an explicit emergency term is also present
            has_emergency_term = bool(re.search(r"\b(?:fell|emergency|breathe|chest\s+pain|chot|gir|dard|bachao|accident)\b", clean))
            return has_emergency_term

    # Short / standalone utterance: (<= 4 words) like "help", "help me", "please help", "help please"
    if len(words) <= 4:
        return True

    # Longer sentence containing emergency context alongside help
    if re.search(r"\bhelp\b.*?\b(?:fell|emergency|breathe|pain|hurt|bleeding|attack|accident|save|chot|gir)\b", clean) or \
       re.search(r"\b(?:fell|emergency|breathe|pain|hurt|bleeding|attack|accident|save|chot|gir)\b.*?\bhelp\b", clean):
        return True

    return False

def check_distress(text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    normalized = re.sub(r"[^\w\s']", " ", text.lower()).strip()

    # 1. Check specific multi-word distress phrases
    for kw in DISTRESS_KEYWORDS:
        phrase = kw["phrase"]
        if phrase == "help":
            continue
        pattern = r"\b" + re.escape(phrase) + r"\b"
        if re.search(pattern, normalized):
            return True, phrase, kw["severity"]

    # 2. Check "help" with context qualification
    if is_distress_help(normalized):
        return True, "help", "critical"

    return False, None, None

def analyze_sentiment_and_mood(text: str) -> Dict[str, Any]:
    if not text or not text.strip():
        return {
            "mood_score": 0.000,
            "confidence_score": 0.500,
            "sentiment_label": "neutral",
            "distress_detected": False,
            "distress_phrase": None,
            "model_version": "presence-rule-lexicon-v1"
        }

    # Normalize text preserving words and apostrophes
    clean_text = re.sub(r"[^\w\s']", " ", text.lower()).strip()
    distress_found, distress_phrase, severity = check_distress(text)

    score_acc = 0.0
    matches = 0

    # 1. Match positive words with word boundaries and negation checks
    for word, weight in POSITIVE_LEXICON.items():
        word_pattern = r"\b" + re.escape(word) + r"\b"
        if re.search(word_pattern, clean_text):
            # Check if this positive word is negated (e.g., "not good", "never happy", "theek nahi")
            negated_pattern = r"\b(?:not|no|never|n't|dont|don't|nahi|nahin|na|cannot|can't)\s+(?:\w+\s+){0,2}" + re.escape(word) + r"\b"
            if re.search(negated_pattern, clean_text):
                # Negated positive term yields an inverted negative score
                score_acc += -abs(weight)
                matches += 1
            else:
                score_acc += weight
                matches += 1

    # 2. Match negative words with word boundaries and negation checks
    for word, weight in NEGATIVE_LEXICON.items():
        word_pattern = r"\b" + re.escape(word) + r"\b"
        if re.search(word_pattern, clean_text):
            negated_pattern = r"\b(?:not|no|never|n't|dont|don't|nahi|nahin|na|cannot|can't)\s+(?:\w+\s+){0,2}" + re.escape(word) + r"\b"
            if re.search(negated_pattern, clean_text):
                # Negated negative term (e.g. "not sad", "not worried") shifts towards neutral
                score_acc += 0.20
                matches += 1
            else:
                score_acc += weight
                matches += 1

    if matches > 0:
        raw_score = score_acc / matches
        confidence = min(0.70 + (matches * 0.08), 0.98)
    else:
        # Check greetings with whole-word boundaries so 'this' does NOT match 'hi'
        has_greeting = any(re.search(r"\b" + re.escape(g) + r"\b", clean_text) for g in GREETINGS)
        raw_score = 0.35 if has_greeting else 0.0
        confidence = 0.75

    # If distress was detected, enforce severe negative mood
    if distress_found:
        raw_score = min(raw_score, -0.80 if severity == "critical" else -0.65)
        confidence = max(confidence, 0.92)

    # Bound mood_score to [-1.0, 1.0] and confidence to [0.0, 1.0]
    final_mood_score = round(max(-1.0, min(1.0, raw_score)), 3)
    final_confidence = round(max(0.0, min(1.0, confidence)), 3)

    if final_mood_score >= 0.20:
        sentiment_label = "positive"
    elif final_mood_score <= -0.20:
        sentiment_label = "negative"
    else:
        sentiment_label = "neutral"

    return {
        "mood_score": final_mood_score,
        "confidence_score": final_confidence,
        "sentiment_label": sentiment_label,
        "distress_detected": distress_found,
        "distress_phrase": distress_phrase,
        "model_version": "presence-rule-lexicon-v1"
    }
