import crypto from "node:crypto";

export function requireVoiceApiKey(request, response, next) {
  const providedKey = request.headers["x-voice-api-key"];

  if (!providedKey || typeof providedKey !== "string") {
    return response.status(401).json({ message: "Voice API key required." });
  }

  const expectedKey = process.env.VOICE_API_KEY || "";
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return response.status(401).json({ message: "Invalid Voice API key." });
  }

  next();
}
