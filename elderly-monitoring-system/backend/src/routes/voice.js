import { Router } from "express";
import { requireVoiceApiKey } from "../middleware/requireVoiceApiKey.js";
import { createInteraction } from "../services/interactionService.js";

export const voiceRouter = Router();

voiceRouter.post("/intent", requireVoiceApiKey, async (request, response, next) => {
  try {
    const stored = await createInteraction(request.body);
    response.status(201).json({
      message: "Interaction stored successfully.",
      ...stored,
    });
  } catch (error) {
    next(error);
  }
});
