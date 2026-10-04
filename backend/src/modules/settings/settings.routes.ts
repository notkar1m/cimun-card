import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { requireOwner } from "../../middleware/requireOwner";
import * as settingsService from "./settings.service";

// Readable by any authenticated account (delegate or admin) — these are
// feature toggles the client needs to render correctly, not secrets.
export const settingsRouter = Router();

settingsRouter.get(
  "/settings",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.getSettings();
    res.json({ settings });
  })
);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAuth, requireRole("SUPERADMIN"));

const updateSettingsSchema = z.object({
  mapTabEnabled: z.boolean().optional(),
  wrappedEnabled: z.boolean().optional(),
});

// Any admin can read these (the public GET above); only the owner changes them.
adminSettingsRouter.patch(
  "/",
  requireOwner,
  asyncHandler(async (req, res) => {
    const input = updateSettingsSchema.parse(req.body);
    const settings = await settingsService.updateSettings(input);
    res.json({ settings });
  })
);
