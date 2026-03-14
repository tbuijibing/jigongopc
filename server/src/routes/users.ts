import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { authUsers } from "@jigongai/db/schema/auth";

export function userRoutes(db: Db) {
  const router = Router();

  // GET /users/me - Get current user
  router.get("/me", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, req.actor.userId),
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        timezone: user.timezone,
        locale: user.locale,
        dateFormat: user.dateFormat,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[users] Failed to get current user:", err);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // GET /users/:id - Get user by ID
  router.get("/:id", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params;

    try {
      const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, id),
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        timezone: user.timezone,
        locale: user.locale,
        dateFormat: user.dateFormat,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[users] Failed to get user:", err);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // PUT /users/me - Update current user
  router.put("/me", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { name, timezone, locale, dateFormat } = req.body;

    try {
      const updateData: Partial<typeof authUsers.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (name !== undefined) {
        updateData.name = name;
      }
      if (timezone !== undefined) {
        updateData.timezone = timezone;
      }
      if (locale !== undefined) {
        updateData.locale = locale;
      }
      if (dateFormat !== undefined) {
        updateData.dateFormat = dateFormat;
      }

      await db
        .update(authUsers)
        .set(updateData)
        .where(eq(authUsers.id, req.actor.userId));

      const user = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, req.actor.userId),
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        timezone: user.timezone,
        locale: user.locale,
        dateFormat: user.dateFormat,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      });
    } catch (err) {
      console.error("[users] Failed to update user:", err);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  return router;
}
