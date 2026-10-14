import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Safely load .env if it exists (e.g., local development)
try {
  dotenv.config({ path: resolve(__dirname, "../../.env") });
} catch {
  // Ignore missing .env file (expected in Lambda production environments)
}

const isLambda = Boolean(
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV
);

// In local Express server mode, warn if auth/API keys are missing instead of crashing Lambda or quick imports
if (process.env.NODE_ENV !== "test" && !isLambda) {
  const missing = [];
  if (!process.env.COGNITO_USER_POOL_ID) missing.push("COGNITO_USER_POOL_ID");
  if (!process.env.COGNITO_CLIENT_ID) missing.push("COGNITO_CLIENT_ID");
  if (!process.env.AWS_REGION) missing.push("AWS_REGION");
  if (!process.env.VOICE_API_KEY) missing.push("VOICE_API_KEY");

  if (missing.length > 0) {
    console.warn(`[config/env] Notice: Missing optional Express environment variables: ${missing.join(", ")}`);
  }
}