import { CognitoJwtVerifier } from "aws-jwt-verify";
import { query } from "../database/pool.js";

export function createRequireAuth(customVerifier = null) {
  let verifier = customVerifier;

  const userPoolId = process.env.COGNITO_USER_POOL_ID || "ap-southeast-2_xoP6IPuBT";
  const knownClients = [
    "4kss7kgqpoeacjt5an70ectvdi",
    "2civh9uuin3idrnhe2ajil405q",
  ];
  const envClients = process.env.COGNITO_CLIENT_ID
    ? process.env.COGNITO_CLIENT_ID.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const clientIds = Array.from(new Set([...envClients, ...knownClients]));

  if (!verifier && userPoolId) {
    try {
      verifier = CognitoJwtVerifier.create({
        userPoolId,
        clientId: clientIds.length === 1 ? clientIds[0] : clientIds,
        tokenUse: "id",
      });
    } catch (err) {
      console.error("[requireAuth] Failed to initialize CognitoJwtVerifier:", err);
    }
  }

  return async function requireAuth(request, response, next) {
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== "string") {
      return response.status(401).json({ message: "Authentication token required." });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return response.status(401).json({ message: "Invalid authorization header format." });
    }

    let payload;
    try {
      // Gate demo tokens behind NODE_ENV !== "production" or explicit ALLOW_DEMO_TOKENS flag
      const allowDemoTokens =
        process.env.ALLOW_DEMO_TOKENS === "true" ||
        (process.env.ALLOW_DEMO_TOKENS !== "false" && process.env.NODE_ENV !== "production");

      if (allowDemoTokens && (token === "demo-token-caregiver-a" || token === "demo-token-a")) {
        payload = {
          sub: process.env.SEED_CAREGIVER_A_SUB || "cognito-sub-demo-a",
          email: "samridhi@example.com",
          name: "Samridhi Sharma",
        };
      } else if (allowDemoTokens && (token === "demo-token-caregiver-b" || token === "demo-token-b")) {
        payload = {
          sub: process.env.SEED_CAREGIVER_B_SUB || "cognito-sub-demo-b",
          email: "arjun@example.com",
          name: "Arjun Mehta",
        };
      } else {
        if (!verifier) {
          throw new Error("No JWT verifier configured.");
        }
        payload = await verifier.verify(token);
      }

      const sub = payload.sub;

      if (!sub) {
        return response.status(401).json({ message: "Invalid token payload: missing sub." });
      }

      let caregiverRes = await query(
        `SELECT caregiver_id, name, email, phone, cognito_sub, is_active
         FROM caregivers
         WHERE cognito_sub = $1`,
        [sub]
      );

      // If not found by sub, match by verified email and auto-link cognito_sub
      if (caregiverRes.rowCount === 0 && payload.email) {
        caregiverRes = await query(
          `UPDATE caregivers
           SET cognito_sub = $1, is_active = TRUE
           WHERE LOWER(email) = LOWER($2)
           RETURNING caregiver_id, name, email, phone, cognito_sub, is_active`,
          [sub, payload.email]
        );
      }

      if (caregiverRes.rowCount === 0 || !caregiverRes.rows[0].is_active) {
        return response.status(403).json({
          message: "Forbidden: Caregiver account not found or inactive.",
        });
      }

      const caregiver = caregiverRes.rows[0];
      request.caregiver = {
        id: Number(caregiver.caregiver_id),
        name: caregiver.name,
        email: caregiver.email,
        phone: caregiver.phone,
        cognitoSub: caregiver.cognito_sub,
        claims: payload,
      };

      next();
    } catch (error) {
      console.warn("[requireAuth] Token verification failed:", error.message);
      return response.status(401).json({ message: "Invalid or expired token." });
    }
  };
}

export const requireAuth = createRequireAuth();
