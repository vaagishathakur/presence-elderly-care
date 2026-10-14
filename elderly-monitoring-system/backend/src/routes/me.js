import { Router } from "express";
import { requireAuth as defaultRequireAuth } from "../middleware/requireAuth.js";
import { getCaregiverAndAssignedElders } from "../services/userService.js";

export function createMeRouter(authMiddleware = defaultRequireAuth) {
  const router = Router();
  router.use(authMiddleware);

  router.get("/", async (request, response, next) => {
    try {
      const result = await getCaregiverAndAssignedElders(request.caregiver.id);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const meRouter = createMeRouter();
