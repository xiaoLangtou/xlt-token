import { Router } from "express";

export function createWhitelistRouter() {
  const router = Router();

  router.get("/public", (_req, res) => {
    res.json({ mode: "whitelist", access: "public" });
  });

  router.get("/private", (req, res) => {
    res.json({ mode: "whitelist", access: "private", loginId: req.stpLoginId });
  });

  return router;
}
