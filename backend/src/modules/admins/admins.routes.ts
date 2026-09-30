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

const createAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  alsoDelegate: z.boolean().optional(),
});

router.post(
  "/",
  requireOwner,
  asyncHandler(async (req, res) => {
    const input = createAdminSchema.parse(req.body);
    const result = await adminsService.createAdmin({
      email: input.email,
      name: input.name,
      alsoDelegate: input.alsoDelegate ?? false,
    });
    res.status(201).json(result);
  })
);

router.delete(
  "/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    await adminsService.deleteAdmin(req.params.id, req.user!.id);
    res.status(204).send();
  })
);

export default router;
