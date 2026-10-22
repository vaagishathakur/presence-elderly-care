import crypto from "node:crypto";
import { Router } from "express";
import { SkillRequestSignatureVerifier, TimestampVerifier } from "ask-sdk-express-adapter";
import { simulateAlexaUtterance } from "../alexa/simulator.js";
import { invokeSkill } from "../alexa/skill.js";

export const alexaRouter = Router();

const signatureVerifier = new SkillRequestSignatureVerifier();
const timestampVerifier = new TimestampVerifier();

/**
 * Middleware gating the simulator behind a valid Voice API Key or a development/demo flag.
 */
function verifySimulatorAccess(request, response, next) {
  const isDevFlagAllowed =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SIMULATOR === "true";

  const providedKey = request.headers["x-voice-api-key"];
  const configuredKey = process.env.VOICE_API_KEY;
  const defaultKey = "voice-secret-key-presence-demo";

  let hasValidApiKey = false;
  if (providedKey && typeof providedKey === "string") {
    const providedBuffer = Buffer.from(providedKey);

    const isConfiguredMatch =
      Boolean(configuredKey) &&
      providedBuffer.length === Buffer.byteLength(configuredKey) &&
      crypto.timingSafeEqual(providedBuffer, Buffer.from(configuredKey));

    const isDefaultMatch =
      providedBuffer.length === Buffer.byteLength(defaultKey) &&
      crypto.timingSafeEqual(providedBuffer, Buffer.from(defaultKey));

    hasValidApiKey = isConfiguredMatch || isDefaultMatch;
  }

  // Allow if valid Voice API key is provided OR dev flag/non-production mode is active
  if (hasValidApiKey || isDevFlagAllowed) {
    return next();
  }

  return response.status(403).json({
    message: "Forbidden: Alexa simulator is disabled in production without a valid Voice API key or dev flag.",
  });
}

// 1. Direct ASK SDK Webhook Endpoint with Signature and Timestamp Verification
alexaRouter.post("/", async (request, response, next) => {
  try {
    const serializedBody =
      typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body);

    const hasCertHeaders = Boolean(
      request.headers["signaturecertchainurl"] && request.headers["signature"]
    );
    const requireVerification =
      process.env.NODE_ENV === "production" ||
      process.env.VERIFY_ALEXA_SIGNATURE === "true";

    if (requireVerification || hasCertHeaders) {
      if (!hasCertHeaders) {
        return response.status(400).json({
          message: "Missing Alexa signature or certificate headers.",
        });
      }
      await signatureVerifier.verify(serializedBody, request.headers);
      await timestampVerifier.verify(serializedBody);
    } else if (request.body?.request?.timestamp) {
      // Non-production: still verify timestamp freshness if timestamp is present
      await timestampVerifier.verify(serializedBody);
    }

    const envelope =
      typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const responseEnvelope = await invokeSkill(envelope);
    response.json(responseEnvelope);
  } catch (error) {
    if (
      error.name?.includes("AskSdk") ||
      error.message?.includes("Timestamp") ||
      error.message?.includes("Certificate") ||
      error.message?.includes("Signature")
    ) {
      return response.status(400).json({ message: error.message });
    }
    next(error);
  }
});

// 2. Presentation / Local Test Simulator Endpoint (gated behind voice API key or dev flag)
alexaRouter.post("/simulate", verifySimulatorAccess, async (request, response, next) => {
  try {
    const {
      amazonUserId,
      transcript,
      intent,
      intentName,
      type,
      slots,
    } = request.body || {};

    const simulationResult = await simulateAlexaUtterance({
      amazonUserId,
      transcript,
      intentName: intent || intentName,
      type,
      slots,
    });

    response.json(simulationResult);
  } catch (error) {
    next(error);
  }
});
