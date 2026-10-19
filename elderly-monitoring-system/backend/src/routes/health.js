import { Router } from "express";
import { query } from "../database/pool.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response, next) => {
  try {
    await query("SELECT 1");
    response.setHeader("x-presence-build", "v2-auth-vaagisha");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});
