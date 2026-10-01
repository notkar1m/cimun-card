import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import { getCachedImage } from "../../lib/imageCache";
import { resolveLatLngFromText } from "../../lib/googleMapsLink";
import * as offersService from "./offers.service";

const router = Router();

router.get(
  "/offers",
  requireAuth,
  requireRole("USER"),
  asyncHandler(async (_req, res) => {
    const offers = await offersService.listActiveOffers();
    res.json({ offers });
  })
);

router.get(
  "/offers/:id",
  requireAuth,
  requireRole("USER"),
  asyncHandler(async (req, res) => {
    const offer = await offersService.getActiveOfferById(req.params.id);
    res.json({ offer });
  })
);

router.get(
  "/branches",
  requireAuth,
  requireRole("USER"),
  asyncHandler(async (_req, res) => {
    const branches = await offersService.listAllBranches();
    res.json({ branches });
  })
);

router.get(
  "/offers/:id/image",
  requireAuth,
  requireRole("USER"),
  asyncHandler(async (req, res) => {
    const offer = await offersService.getActiveOfferById(req.params.id);
    if (!offer.imageUrl) {
      res.status(404).end();
      return;
    }

    const cached = await getCachedImage(offer.imageUrl);
    if (!cached) {
      res.status(502).end();
      return;
    }

    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("Cache-Control", "public, max-age=604800");
    res.send(cached.buffer);
  })
);

const adminOffersRouter = Router();
adminOffersRouter.use(requireAuth, requireRole("SUPERADMIN"));

adminOffersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const offers = await offersService.adminListOffers();
    res.json({ offers });
  })
);

const bulkImportSchema = z.object({
  csv: z.string().min(1),
});

adminOffersRouter.post(
  "/bulk-import",
  asyncHandler(async (req, res) => {
    const { csv } = bulkImportSchema.parse(req.body);
    const result = await offersService.adminBulkImportOffers(csv);
    res.json(result);
  })
);

const branchSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const resolveMapLinkSchema = z.object({
  input: z.string().min(1).max(2000),
});

adminOffersRouter.post(
  "/maps/resolve",
  asyncHandler(async (req, res) => {
    const { input } = resolveMapLinkSchema.parse(req.body);
    const coords = await resolveLatLngFromText(input);
    if (!coords) {
      res.status(422).json({
        error: {
          code: "UNRESOLVABLE",
          message:
            "That link doesn't carry exact coordinates (short 'Share' links never do). Open it in Google Maps, then either right-click the spot and copy the coordinates shown, or wait for the page to load and copy the URL from the address bar once it contains @lat,lng.",
        },
      });
      return;
    }
    res.json(coords);
  })
);

const resolveBranchesCsvSchema = z.object({
  csv: z.string().min(1).max(200_000),
});

adminOffersRouter.post(
  "/maps/resolve-csv",
  asyncHandler(async (req, res) => {
    const { csv } = resolveBranchesCsvSchema.parse(req.body);
    const result = await offersService.resolveBranchesCsv(csv);
    res.json(result);
  })
);

const createOfferSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  vendorName: z.string().min(1),
  tier: z.enum(["SILVER", "GOLD", "DIAMOND"]).optional(),
  discountPercent: z.number().int().min(1).max(100).optional(),
  imageUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  active: z.boolean().optional(),
  redemptionType: z.enum(["CARD", "PROMO"]).optional(),
  promoCode: z.string().min(1).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  branches: z.array(branchSchema).max(200).optional(),
});

adminOffersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createOfferSchema.parse(req.body);
    const offer = await offersService.adminCreateOffer(input);
    res.status(201).json({ offer });
  })
);

const updateOfferSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  vendorName: z.string().min(1).optional(),
  tier: z.enum(["SILVER", "GOLD", "DIAMOND"]).optional(),
  discountPercent: z.number().int().min(1).max(100).nullable().optional(),
  imageUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  active: z.boolean().optional(),
  redemptionType: z.enum(["CARD", "PROMO"]).optional(),
  promoCode: z.string().min(1).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  branches: z.array(branchSchema).max(200).optional(),
});

adminOffersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateOfferSchema.parse(req.body);
    const offer = await offersService.adminUpdateOffer(req.params.id, input);
    res.json({ offer });
  })
);

const reorderOffersSchema = z.object({
  tier: z.enum(["SILVER", "GOLD", "DIAMOND"]),
  orderedIds: z.array(z.string().min(1)).min(1),
});

adminOffersRouter.post(
  "/reorder",
  asyncHandler(async (req, res) => {
    const { tier, orderedIds } = reorderOffersSchema.parse(req.body);
    await offersService.adminReorderOffers(tier, orderedIds);
    res.status(204).send();
  })
);

adminOffersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await offersService.adminDeleteOffer(req.params.id);
    res.status(204).send();
  })
);

router.use("/admin/offers", adminOffersRouter);

export default router;
