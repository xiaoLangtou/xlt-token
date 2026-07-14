import { Router } from "express";

export function createPermissionRouter() {
  const router = Router();

  router.get("/read", (_req, res) => {
    res.json({ action: "read", ok: true });
  });

  router.get("/delete", (_req, res) => {
    res.json({ action: "delete", ok: true });
  });

  router.get("/order-create", (_req, res) => {
    res.json({ action: "order:create", ok: true });
  });

  return router;
}
