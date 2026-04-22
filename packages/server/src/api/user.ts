import { db } from "@/db";
import { Router } from "express";
import bodyParser from "body-parser";
import log from "@/logger";
import { assignSessionInfo, basicLimiter, createNewSession, requireAuth, strictLimiter } from "./auth";
import env from "@/env";
import argon2 from "argon2";
import { z } from "zod";
import { formatZodIssue } from "@/utils";
import { user_role } from "@/generated/prisma/enums";

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));
app.use(basicLimiter);

const quotas: Record<user_role, number> = {
  user: env.STORAGE_QUOTA_USER,
  admin: env.STORAGE_QUOTA_ADMIN,
  limited: 1048576, // just 1mb
};


export const UserRegisterSchema = z.object({
  username: z
    .string({ message: "Username must be a string" })
    .trim()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(32, { message: "Username cannot exceed 32 characters" }),
  email: z
    .string({ message: "Email must be a string" })
    .trim()
    .toLowerCase()
    .email({ message: "Email must be a valid email address" }),
  password: z
    .string({ message: "Password must be a string" })
    .trim()
    .min(3, { message: "Password must be at least 3 characters long" })
    .max(256, { message: "Username cannot exceed 256 characters" }),
});

export const UserLoginSchema = z.object({
  username: z
    .string({ message: "Username/email must be a string" })
    .trim()
    .min(3, { message: "Username/email must be at least 3 characters long" })
    .max(32, { message: "Username/email cannot exceed 256 characters" }),
  password: z
    .string({ message: "Password must be a string" })
    .trim()
    .min(3, { message: "Password must be at least 3 characters long" })
    .max(256, { message: "Username cannot exceed 256 characters" }),
});

export const UserReturnSchema = z.object({
  id: z.number(),
  username: z.string(),
  displayname: z.string(),
  email: z.string().default(""),
  emailConfirmed: z.boolean(),
  role: z.string(),
});

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

app.delete("/session/:id", requireAuth, async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({
        ok: false,
        message: "Unauthorized",
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
      ok: true,
      message: "Session invalidated",
    });
  } catch (err) {
    log.error(`Drop session error: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
    res.status(500).json({
      ok: false,
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.get("/sessions", requireAuth, async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({
        ok: false,
        message: "Unauthorized",
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
      ok: false,
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.post("/register", strictLimiter, async (req, res) => {
  try {
    const { data, success, error } = UserRegisterSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        ok: false,
        message: error.errors.map(formatZodIssue),
      });
      return;
    }
    const { username: displayname, password, email } = data;
    const username = displayname.toLowerCase();
    log.info(`Attempted registration by ${username}`);
    const existing_username = await db.user.findUnique({
      where: {
        username: username,
      },
    });
    if (existing_username) {
      res.status(400).json({
        ok: false,
        message: "Username is already taken",
      });
      return;
    }
    const existing_email = await db.user.findUnique({
      where: {
        email: email,
      },
    });
    if (existing_email) {
      res.status(400).json({
        ok: false,
        message: "Email is already used on another account",
      });
      return;
    }

    const hashed_password = await argon2.hash(password);
    const user = await db.user.create({
      data: {
        username,
        displayname,
        email,
        password: hashed_password,
        role: env.REGISTERED_USERS_LIMITED ? user_role.limited : user_role.user,
      },
    });
    const session = await createNewSession(user);
    log.info(`User ${username} registered`, {
      user: user.id,
      sessionId: session.sessionId,
      role: user.role,
    });
    res.appendHeader("X-Access-Token", session.accessToken);
    res.appendHeader("X-Refresh-Token", session.refreshToken);
    res.cookie("x-access-token", session.accessToken)
    res.cookie("x-refresh-token", session.refreshToken, { expires: session.expiresAt })
    await assignSessionInfo(session.sessionId, req);
    return res.status(201).json({
      ok: true,
      message: "Successfully registered user",
      data: {
        user: UserReturnSchema.parse(user),
        session: session,
      },
    });
  } catch (err) {
    log.error(`Register error: ${err}`);
    return res.status(500).json({
      ok: false,
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.post("/login", strictLimiter, async (req, res) => {
  try {
    const { data, success, error } = UserLoginSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        ok: false,
        message: error.errors.map(formatZodIssue),
      });
      return;
    }
    const { username: displayname, password } = data;
    const username = displayname.toLowerCase();
    log.info(`Attempted login as ${username}`);
    const user = await db.user.findUnique({
      where: {
        username: username,
      },
    });
    if (!user) {
      res.status(404).json({
        ok: false,
        message: "User does not exist",
      });
      return;
    }
    if (!(await argon2.verify(user.password, password))) {
      res.status(400).json({
        ok: false,
        message: "Invalid password",
      });
      log.warn(`Incorrect password during login as ${username}`);
      return;
    }
    const session = await createNewSession(user);
    res.appendHeader("X-Access-Token", session.accessToken);
    res.appendHeader("X-Refresh-Token", session.refreshToken);
    res.cookie("x-access-token", session.accessToken)
    res.cookie("x-refresh-token", session.refreshToken, { expires: session.expiresAt })
    await assignSessionInfo(session.sessionId, req);
    res.status(200).json({
      ok: true,
      message: `Logged in. Welcome, ${username}`,
      data: {
        user: UserReturnSchema.parse(user),
        session,
      },
    });
    log.info(`User ${username} logged in`, {
      user: user.id,
      sessionId: session.sessionId,
      role: user.role,
    });
  } catch (err) {
    log.error(`Login error: ${err}`, { user: req.auth?.userId ?? -1 });
    res.status(400).json({
      ok: false,
      message: "An error has occurred when trying to login",
    });
  }
});

app.post("/logout", requireAuth, async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.sendStatus(401);
      return;
    }
    const user = await db.user.findUnique({
      where: {
        id: auth.userId,
      },
    });
    if (!user) {
      res.status(404).json({
        ok: false,
        message: "User does not exist",
      });
      return;
    }
    const currentSession = await db.session.findUnique({
      where: {
        id: auth.sessionId,
      },
    });
    if (!currentSession) {
      res.status(400).json({
        ok: false,
        message: "Session does not exist",
      });
      return;
    }

    await db.sessionToken.updateMany({
      where: {
        sessionId: currentSession.id,
      },
      data: {
        active: false,
      },
    });
    await db.session.update({
      where: {
        id: currentSession.id,
      },
      data: {
        active: false,
      },
    });

    res.appendHeader("X-Access-Token", "");
    res.appendHeader("X-Refresh-Token", "");
    res.cookie("x-access-token", "", {expires: new Date(0)})
    res.cookie("x-refresh-token", "", {expires: new Date(0)})

    log.info(`User ${user.username} logged out`, {
      user: user.id,
      sessionId: auth.sessionId,
    });
    res.status(200).json({
      ok: true,
      message: "Goodbye",
    });
  } catch (err) {
    log.error(`Logout error: ${err}`, {
      user: req.auth?.userId ?? -1,
    });
    res.status(500).json({
      ok: false,
      message: "An error has occurred when trying to logout",
    });
  }
});


app.get("/", requireAuth, async (req, res) => {
  try {
    const user = await db.user.findUnique({
      where: {
        id: req.auth?.userId ?? 0,
      },
      include: {
        sessions: true,
      },
    });
    if (!user) {
      res.status(404).json({
        ok: false,
        message: "Could not find current user",
      });
      return;
    }
    res.status(200).json({
      ok: true,
      data: UserReturnSchema.parse(user)
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "An error has occurred when trying to get current user",
    });
    log.error(`An error occured on / Err: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
  }
});

app.patch("/self", requireAuth, async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(403).json({
        ok: false,
        message: "Invalid auth token",
      });
      return;
    }
    const { success, data, error } = UserPatchSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        ok: false,
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
          ok: false,
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
          ok: false,
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
      ok: true,
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
      ok: false,
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.get("/quota", requireAuth, async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(403).json({
        ok: false,
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
      ok: true,
      message: "Calculated storage quota",
      data: {
        usage: totalSavesSize,
        quota: quotas[auth.role as user_role],
      },
    });
  } catch (err) {
    log.error(`Refresh error: ${err}`);
    res.status(500).json({
      ok: false,
      message: "An error has occurred when trying to refresh session",
    });
  }
});

export default app;
