import { Router } from "express";
import { loadProfileUser } from "../middleware/profile-user";

export function createProfileRouter() {
  const router = Router();

  router.get("/me", loadProfileUser, (req, res) => {
    res.json({
      stpLoginId: req.stpLoginId,
      user: (req as typeof req & { user?: Record<string, unknown> }).user,
    });
  });

  return router;
}
