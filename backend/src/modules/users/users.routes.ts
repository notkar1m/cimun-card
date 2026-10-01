import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import * as usersService from "./users.service";

const router = Router();

router.use(requireAuth, requireRole("SUPERADMIN"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await usersService.listUsers();
    res.json({ users });
  })
);

const bulkImportSchema = z.object({
  csv: z.string().min(1),
});

router.post(
  "/bulk-import",
  asyncHandler(async (req, res) => {
    const { csv } = bulkImportSchema.parse(req.body);
    const result = await usersService.bulkImportUsers(csv);
    res.json(result);
  })
);

const LOGIN_ID_SCHEMA = z.string().regex(/^\d{4}$/, "Must be exactly 4 digits");

const createUserSchema = z.object({
  name: z.string().min(1),
  loginId: LOGIN_ID_SCHEMA,
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createUserSchema.parse(req.body);
    const user = await usersService.createUser(input);
    res.status(201).json({ user });
  })
);

const updateUserSchema = z.object({
  phone: z.string().min(1).optional(),
  loginId: LOGIN_ID_SCHEMA.optional(),
  name: z.string().min(1).optional(),
});

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    const user = await usersService.updateUser(req.params.id, input);
    res.json({ user });
  })
);

router.post(
  "/:id/reset-password",
  asyncHandler(async (req, res) => {
    const result = await usersService.resetUserPassword(req.params.id);
    res.json(result);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await usersService.deleteUser(req.params.id);
    res.status(204).send();
  })
);

export default router;
