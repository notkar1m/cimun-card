import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { requireOwner } from "../../middleware/requireOwner";
import * as adminsService from "./admins.service";

const router = Router();

router.use(requireAuth, requireRole("SUPERADMIN"));

// Any admin can see who else has access — only the owner can change it.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const admins = await adminsService.listAdmins();
    res.json({ admins });
  })
);

const promoteAdminSchema = z.object({
  loginId: z.string().regex(/^\d{4}$/, "Must be exactly 4 digits"),
});

router.post(
  "/",
  requireOwner,
  asyncHandler(async (req, res) => {
    const input = promoteAdminSchema.parse(req.body);
    const account = await adminsService.promoteToAdmin(input.loginId);
    res.status(201).json({ account });
  })
);

router.delete(
  "/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    await adminsService.demoteAdmin(req.params.id, req.user!.id);
    res.status(204).send();
  })
);

export default router;
