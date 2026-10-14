import "./config/env.js";
import cors from "cors";
import express from "express";
import { alertsRouter, createAlertsRouter } from "./routes/alerts.js";
import { alexaRouter } from "./routes/alexa.js";
import { healthRouter } from "./routes/health.js";
import { createMeRouter } from "./routes/me.js";
import { createUsersRouter } from "./routes/users.js";
import { voiceRouter } from "./routes/voice.js";
import { createRequireAuth } from "./middleware/requireAuth.js";

export function createApp(verifier = null) {
  const app = express();
  const rawOrigins =
    process.env.ALLOWED_ORIGINS ||
    process.env.FRONTEND_ORIGIN ||
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000,http://localhost:3000";
  const allowedOrigins = rawOrigins.split(",").map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin '${origin}' not allowed.`));
      },
      credentials: true,
    })
  );
  app.use(express.json());

  const authMiddleware = createRequireAuth(verifier);
  const meRouter = createMeRouter(authMiddleware);
  const usersRouter = createUsersRouter(authMiddleware);
  const alertsRouter = createAlertsRouter(authMiddleware);

  app.use("/api/health", healthRouter);
  app.use("/api/me", meRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/voice", voiceRouter);
  app.use("/api/alexa", alexaRouter);

  // 404 handler for unknown routes
  app.use((_request, response) => {
    response.status(404).json({ message: "Route not found." });
  });

  // Centralized error handler
  app.use((error, _request, response, _next) => {
    const isClientError =
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500;

    const statusCode = isClientError ? error.statusCode : 500;

    if (statusCode >= 500) {
      console.error("Internal Server Error:", error);
    }

    response.status(statusCode).json({
      message: isClientError
        ? error.message || "Bad request."
        : "Internal server error.",
    });
  });

  return app;
}

export const app = createApp();