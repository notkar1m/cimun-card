import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import * as activationsService from "./activations.service";

const router = Router();

router.post(
  "/offers/:id/redeem",
  requireAuth,
  requireRole("USER"),
  asyncHandler(async (req, res) => {
    const result = await activationsService.redeemOffer(req.params.id, req.user!.id);
    res.status(201).json(result);
  })
);

router.get(
  "/me/activations",
  requireAuth,
  requireRole("USER"),
  asyncHandler(async (req, res) => {
    const activations = await activationsService.listMyActivations(req.user!.id);
    res.json({ activations });
  })
);

export default router;
