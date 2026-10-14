import { Router } from "express";
import { requireAuth as defaultRequireAuth } from "../middleware/requireAuth.js";
import { acknowledgeAlert, resolveAlert } from "../services/alertService.js";

export function createAlertsRouter(authMiddleware = defaultRequireAuth) {
  const router = Router();
  router.use(authMiddleware);

  router.post("/:id/acknowledge", async (request, response, next) => {
    try {
      const alertId = Number(request.params.id);
      if (!Number.isInteger(alertId) || alertId <= 0) {
        return response.status(400).json({ message: "Invalid alert ID." });
      }

      const { note } = request.body || {};
      const updated = await acknowledgeAlert(request.caregiver.id, alertId, note);
      response.json({ message: "Alert acknowledged successfully.", alert: updated });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/resolve", async (request, response, next) => {
    try {
      const alertId = Number(request.params.id);
      if (!Number.isInteger(alertId) || alertId <= 0) {
        return response.status(400).json({ message: "Invalid alert ID." });
      }

      const { note } = request.body || {};
      const updated = await resolveAlert(request.caregiver.id, alertId, note);
      response.json({ message: "Alert resolved successfully.", alert: updated });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const alertsRouter = createAlertsRouter();
