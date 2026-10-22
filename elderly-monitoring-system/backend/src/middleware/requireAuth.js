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

      const tokenEmail =
        payload.email ||
        (payload["cognito:username"] && payload["cognito:username"].includes("@") ? payload["cognito:username"] : null) ||
        (payload.username && payload.username.includes("@") ? payload.username : null);

      let caregiver = null;

      // 1. Authoritative resolution: If token provides a verified email, look up by email first
      if (tokenEmail) {
        const emailCheck = await query(
          `SELECT caregiver_id, name, email, phone, cognito_sub, is_active
           FROM caregivers
           WHERE email ILIKE $1`,
          [tokenEmail]
        );

        if (emailCheck.rowCount > 0) {
          caregiver = emailCheck.rows[0];
          if (!caregiver.is_active) {
            return response.status(403).json({
              message: "Forbidden: Caregiver account not found or inactive.",
            });
          }
          // Link current sub if not linked, and clear sub from any other record
          if (caregiver.cognito_sub !== sub) {
            await query(`UPDATE caregivers SET cognito_sub = NULL WHERE cognito_sub = $1 AND caregiver_id <> $2`, [sub, caregiver.caregiver_id]);
            await query(`UPDATE caregivers SET cognito_sub = $1 WHERE caregiver_id = $2`, [sub, caregiver.caregiver_id]);
            caregiver.cognito_sub = sub;
          }
        } else if (!tokenEmail.endsWith("@example.com")) {
          // Auto-enroll non-test registered caregivers with verified email
          const displayName = payload.name || tokenEmail.split("@")[0] || "Caregiver";
          const insertRes = await query(
            `INSERT INTO caregivers (name, email, cognito_sub, is_active)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (email) DO UPDATE
               SET cognito_sub = EXCLUDED.cognito_sub, is_active = TRUE
             RETURNING caregiver_id, name, email, phone, cognito_sub, is_active`,
            [displayName, tokenEmail, sub]
          );
          caregiver = insertRes.rows[0];
        }
      }

      // 2. If not resolved by email, try resolving by cognito_sub
      if (!caregiver) {
        const subCheck = await query(
          `SELECT caregiver_id, name, email, phone, cognito_sub, is_active
           FROM caregivers
           WHERE cognito_sub = $1`,
          [sub]
        );

        if (subCheck.rowCount > 0) {
          caregiver = subCheck.rows[0];
        }
      }

      if (!caregiver || !caregiver.is_active) {
        return response.status(403).json({
          message: "Forbidden: Caregiver account not found or inactive.",
        });
      }

      // Auto-assign to default elder (Shanti Devi) if no active assignment exists
      const assignmentCheck = await query(
        `SELECT assignment_id FROM caregiver_assignments WHERE caregiver_id = $1 AND is_active = TRUE LIMIT 1`,
        [caregiver.caregiver_id]
      );

      if (assignmentCheck.rowCount === 0) {
        const defaultElder = await query(`SELECT user_id FROM elderly_users ORDER BY user_id ASC LIMIT 1`);
        if (defaultElder.rowCount > 0) {
          await query(
            `INSERT INTO caregiver_assignments (user_id, caregiver_id, relationship, is_active)
             VALUES ($1, $2, 'primary_caregiver', TRUE)
             ON CONFLICT DO NOTHING`,
            [defaultElder.rows[0].user_id, caregiver.caregiver_id]
          );
        }
      }

      request.caregiver = {
        id: Number(caregiver.caregiver_id),
        name: caregiver.name || payload.name || "Caregiver",
        email: caregiver.email || tokenEmail,
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
