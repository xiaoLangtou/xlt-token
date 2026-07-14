import { Router } from "express";

export function createRoleRouter() {
  const router = Router();

  router.get("/admin-only", (_req, res) => {
    res.json({ action: "admin-only", ok: true });
  });

  router.get("/admin-or-super", (_req, res) => {
    res.json({ action: "admin-or-super", ok: true });
  });

  return router;
}
