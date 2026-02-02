import { db } from "@/db";
import { Router } from "express";
import bodyParser from "body-parser";
import log from "@/logger";
import { basicLimiter, requireAuth } from "./auth";
import env from "@/env";
import argon2 from "argon2";
import { z } from "zod";
import { formatZodIssue } from "@/utils";
import { user_role } from "@/generated/prisma/enums";

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));
app.use(basicLimiter);
app.use(requireAuth);

const quotas: Record<user_role, number> = {
  user: env.STORAGE_QUOTA_USER,
  admin: env.STORAGE_QUOTA_ADMIN,
  limited: 1048576, // just 1mb
};

const UserPatchSchema = z.object({
  displayname: z
    .string({ message: "Username must be a string" })
    .trim()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(64, { message: "Username cannot exceed 64 characters" })
    .optional(),
  username: z
    .string({ message: "Username must be a string" })
    .trim()
    .toLowerCase()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(32, { message: "Username cannot exceed 32 characters" })
    .optional(),
  email: z
    .string({ message: "Email must be a string" })
    .trim()
    .toLowerCase()
    .email({ message: "Email must be a valid email address" })
    .optional(),
  password: z
    .string({ message: "Password must be a string" })
    .trim()
    .min(3, { message: "Password must be at least 3 characters long" })
    .max(256, { message: "Username cannot exceed 256 characters" })
    .optional(),
});

app.delete("/session/:id", async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth token",
      });
      return;
    }
    const sessionId = z.coerce.number().parse(req.params.id);

    const { tokens } = await db.session.update({
      where: {
        id: sessionId,
        userId: auth.userId,
      },
      data: {
        active: false,
      },
      select: {
        tokens: true,
      },
    });

    tokens.map(async (token) => {
      await db.sessionToken.update({
        where: {
          id: token.id,
          userId: auth.userId,
        },
        data: {
          active: false,
        },
      });
    });

    res.status(200).json({
      status: "ok",
      message: "Session invalidated",
    });
  } catch (err) {
    log.error(`Drop session error: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.get("/sessions", async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth token",
      });
      return;
    }
    const sessions = await db.session.findMany({
      where: {
        userId: auth.userId,
        active: true,
      },
      include: {
        tokens: { where: { active: true } },
      },
    });

    res.status(200).json(sessions);
  } catch (err) {
    log.error(`Get sessions error: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.patch("/self", async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth token",
      });
      return;
    }
    const { success, data, error } = UserPatchSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        status: "error",
        message: error.errors.map(formatZodIssue),
      });
      return;
    }
    log.info("User info updated", {
      user: auth.userId,
      sessionId: auth.sessionId,
    });
    if (data.username) {
      const existing = await db.user.findFirst({
        where: {
          username: data.username,
          id: {
            not: auth.userId,
          },
        },
      });
      if (existing) {
        res.status(400).json({
          status: "error",
          message: "Username is already taken",
        });
        return;
      }
    }
    if (data.email) {
      const existing = await db.user.findFirst({
        where: {
          email: data.email,
          id: {
            not: auth.userId,
          },
        },
      });
      if (existing) {
        res.status(400).json({
          status: "error",
          message: "Email is already taken",
        });
        return;
      }
    }
    let password;
    if (data.password) {
      password = data.password;
      delete data.password;
    }
    let user = await db.user.update({
      where: {
        id: auth.userId,
      },
      data,
    });
    if (password) {
      user = await db.user.update({
        where: {
          id: auth.userId,
        },
        data: {
          password: await argon2.hash(
            user.id + password + user.createdAt.toJSON(),
          ),
        },
      });
    }
    res.status(200).json({
      status: "ok",
      message: "Updated your account",
      data: user,
    });
  } catch (err) {
    log.error(`Self patch error: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.get("/quota", async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth token",
      });
      return;
    }

    const saves = await db.save.findMany({
      where: {
        ownerId: auth.userId,
      },
    });
    const totalSavesSize = saves.reduce((a, b) => a + b.size, 0);

    res.status(200).json({
      status: "ok",
      message: "Calculated storage quota",
      data: {
        usage: totalSavesSize,
        quota: quotas[auth.role as user_role],
      },
    });
  } catch (err) {
    log.error(`Refresh error: ${err}`);
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to refresh session",
    });
  }
});

export default app;
