import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import * as broadcastService from "./broadcast.service";

const router = Router();

router.use(requireAuth, requireRole("SUPERADMIN"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const recipientCount = await broadcastService.getDelegateCount();
    res.json({ recipientCount });
  })
);

const sendSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(10000),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { subject, message } = sendSchema.parse(req.body);
    const recipientCount = await broadcastService.broadcastToDelegates(subject, message);
    res.status(202).json({ recipientCount });
  })
);

export default router;
