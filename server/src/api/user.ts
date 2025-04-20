import prisma from "../db.js";
import { Router } from "express";
import bodyParser from "body-parser";
import log from "../logger.js";
import { validateAuth, verifyToken } from "./auth.js";
import env from "../env.js";
import argon2 from "argon2";
import { user_role } from "@prisma/client";
import { z } from "zod";
import { formatZodIssue } from "../utils.js";

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));

const quotas = {
  user: env.STORAGE_QUOTA_USER,
  admin: env.STORAGE_QUOTA_ADMIN,
  limited: 1048576, // just 1mb
};

export type UserObj = {
  username: string;
  password: string;
  id: number;
  role: user_role;
  email: string | null;
  createdAt: Date;
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

app.delete("/session/:id", verifyToken, async (req, res) => {
  try {
    const { data: auth } = validateAuth(req.auth);
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth data",
      });
      return;
    }
    const sessionId = z.coerce.number().parse(req.params.id);

    const { tokens } = await prisma.session.update({
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
      await prisma.sessionToken.update({
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
      sessionTokenId: req.auth?.sessionTokenId,
      role: req.auth?.role,
    });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.get("/sessions", verifyToken, async (req, res) => {
  try {
    const { data: auth } = validateAuth(req.auth);
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth data",
      });
      return;
    }
    const sessions = await prisma.session.findMany({
      where: {
        userId: auth.userId,
        active: true,
      },
      include: {
        tokens: true,
      },
    });

    sessions.map((session) => {
      session.tokens = session.tokens.filter((t) => t.active);
    });

    res.status(200).json(sessions);
  } catch (err) {
    log.error(`Get sessions error: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      sessionTokenId: req.auth?.sessionTokenId,
      role: req.auth?.role,
    });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.patch("/self", verifyToken, async (req, res) => {
  try {
    const { data: auth } = validateAuth(req.auth);
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth data",
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
      sessionTokenId: auth.sessionTokenId,
      sessionId: auth.sessionId,
    });
    if (data.username) {
      const existing = await prisma.user.findFirst({
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
      const existing = await prisma.user.findFirst({
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
    let user = await prisma.user.update({
      where: {
        id: auth.userId,
      },
      data,
    });
    if (password) {
      user = await prisma.user.update({
        where: {
          id: auth.userId,
        },
        data: {
          password: await argon2.hash(
            user.id + password + user.createdAt.toJSON()
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
      sessionTokenId: req.auth?.sessionTokenId,
      role: req.auth?.role,
    });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.get("/quota", verifyToken, async (req, res) => {
  try {
    const { data: auth } = validateAuth(req.auth);
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth data",
      });
      return;
    }

    const saves = await prisma.save.findMany({
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
        quota: quotas[auth.role],
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
