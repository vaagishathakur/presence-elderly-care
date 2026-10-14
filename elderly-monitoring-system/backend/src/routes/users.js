import { Router } from "express";
import { requireAuth as defaultRequireAuth } from "../middleware/requireAuth.js";
import { requireUserAccess } from "../middleware/requireUserAccess.js";
import { listUserAlerts } from "../services/alertService.js";
import { listUserInteractions } from "../services/interactionService.js";
import {
  confirmMedicationDose,
  createMedicationSchedule,
  listUserMedications,
} from "../services/medicationService.js";
import { getElderlyUserStatus } from "../services/statusService.js";
import { getElderlyUserProfile } from "../services/userService.js";

export function createUsersRouter(authMiddleware = defaultRequireAuth) {
  const router = Router();
  router.use(authMiddleware);

  router.get("/:id", requireUserAccess, async (request, response, next) => {
    try {
      const elderlyUser = await getElderlyUserProfile(request.elderlyUserId);
      response.json({ elderlyUser });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/status", requireUserAccess, async (request, response, next) => {
    try {
      const status = await getElderlyUserStatus(request.elderlyUserId);
      response.json(status);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/interactions", requireUserAccess, async (request, response, next) => {
    try {
      const { limit, offset } = request.query;
      const interactions = await listUserInteractions(request.elderlyUserId, { limit, offset });
      response.json({ interactions });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/alerts", requireUserAccess, async (request, response, next) => {
    try {
      const { status } = request.query;
      const alerts = await listUserAlerts(request.caregiver.id, request.elderlyUserId, { status });
      response.json({ alerts });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/medications", requireUserAccess, async (request, response, next) => {
    try {
      const medications = await listUserMedications(request.elderlyUserId);
      response.json(medications);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/medications", requireUserAccess, async (request, response, next) => {
    try {
      const schedule = await createMedicationSchedule(request.elderlyUserId, request.body);
      response.status(201).json({ schedule });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/medications/confirm", requireUserAccess, async (request, response, next) => {
    try {
      const { scheduleId, logId } = request.body;
      const confirmed = await confirmMedicationDose({
        userId: request.elderlyUserId,
        scheduleId,
        logId,
      });
      response.json({ confirmed });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const usersRouter = createUsersRouter();
