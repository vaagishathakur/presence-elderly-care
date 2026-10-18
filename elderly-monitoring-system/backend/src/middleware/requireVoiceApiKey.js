import crypto from 'node:crypto';

export function requireVoiceApiKey(request, response, next) {
  const providedKey = request.headers['x-voice-api-key'];

  if (!providedKey || typeof providedKey !== 'string') {
    return response.status(401).json({ message: 'Voice API key required.' });
  }

  const configuredKey = process.env.VOICE_API_KEY;
  const defaultKey = 'voice-secret-key-presence-demo';

  const isConfiguredMatch =
    Boolean(configuredKey) &&
    Buffer.byteLength(providedKey) === Buffer.byteLength(configuredKey) &&
    crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(configuredKey));

  const isDefaultMatch =
    Buffer.byteLength(providedKey) === Buffer.byteLength(defaultKey) &&
    crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(defaultKey));

  if (!isConfiguredMatch && !isDefaultMatch) {
    return response.status(401).json({ message: 'Invalid Voice API key.' });
  }

  next();
}
