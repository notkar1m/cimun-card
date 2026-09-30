import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import offersRoutes from "./modules/offers/offers.routes";
import activationsRoutes from "./modules/activations/activations.routes";
import usersRoutes from "./modules/users/users.routes";
import adminsRoutes from "./modules/admins/admins.routes";
import { settingsRouter, adminSettingsRouter } from "./modules/settings/settings.routes";
import { wrappedRouter } from "./modules/wrapped/wrapped.routes";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());

  if (env.NODE_ENV !== "production") {
    app.use(cors({ origin: "http://localhost:5173", credentials: true }));
  }

  app.use("/api/auth", authRoutes);
  app.use("/api", offersRoutes);
  app.use("/api", activationsRoutes);
  app.use("/api", settingsRouter);
  app.use("/api", wrappedRouter);
  app.use("/api/admin/users", usersRoutes);
  app.use("/api/admin/admins", adminsRoutes);
  app.use("/api/admin/settings", adminSettingsRouter);

  // Only present when the frontend was built into this image (the
  // single-service deploy). When the frontend is hosted separately (e.g.
  // Cloudflare Pages) this directory doesn't exist, and the API simply
  // doesn't register these routes — no dangling sendFile() to a missing
  // index.html.
  const publicDir = path.join(__dirname, "public");
  if (fs.existsSync(publicDir)) {
    // Vite content-hashes everything under /assets, so those files never
    // change under a given URL — safe to cache for a year. index.html
    // (served below) references the current hashes and must always be
    // revalidated, so it deliberately isn't covered by this.
    app.use(
      "/assets",
      express.static(path.join(publicDir, "assets"), { maxAge: "1y", immutable: true })
    );
    app.use(express.static(publicDir));
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
