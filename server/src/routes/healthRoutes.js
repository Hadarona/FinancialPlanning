import { Router } from "express";

const router = Router();
const startedAt = Date.now();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
});

export default router;
