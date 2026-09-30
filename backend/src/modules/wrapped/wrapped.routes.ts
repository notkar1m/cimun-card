import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { ApiError } from "../../lib/ApiError";
import * as settingsService from "../settings/settings.service";
import * as wrappedService from "./wrapped.service";

export const wrappedRouter = Router();

wrappedRouter.get(
  "/wrapped",
  requireAuth,
  requireRole("USER"),
  asyncHandler(async (req, res) => {
    const settings = await settingsService.getSettings();
    if (!settings.wrappedEnabled) {
      throw new ApiError(403, "FEATURE_DISABLED", "Cimun Card Wrapped isn't available right now");
    }

    const stats = await wrappedService.getWrappedStats(req.user!.id);
    res.json({ stats });
  })
);
