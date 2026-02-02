import argon2 from "argon2";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { user_role } from "@prisma/client";
import { NextFunction, Router, Request, Response } from "express";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import log from "@/logger";
import env from "@/env";
import { z } from "zod";
import { formatZodIssue } from "../utils";
import ms, { StringValue } from "ms";
import rateLimit from "express-rate-limit";
import { Session, User } from "@/generated/prisma/client";

export const basicLimiter = rateLimit({
  windowMs: 30000,
  max: 30,
  validate: {
    xForwardedForHeader: false,
  },
});

export const strictLimiter = rateLimit({
  windowMs: 120000,
  max: 5,
  validate: {
    xForwardedForHeader: false,
  },
});

export async function createSessionToken() {
  let publicPart = randomBytes(16).toString("hex");
  while (await db.sessionToken.findUnique({ where: { public: publicPart } })) {
    // Handle collisions
    publicPart = randomBytes(20).toString("hex");
  }
  const secret = randomBytes(16).toString("hex");
  const hash = await argon2.hash(secret);

  return {
    publicPart,
    key: `SB_${publicPart}:${secret}`,
    hash,
  };
}

export async function validateSessionToken({
  key,
}: {
  key: string;
  includeUser?: boolean;
}) {
  const [publicPart, secret] = key.slice(3).split(":");

  const token = await db.sessionToken.findUnique({
    where: { public: publicPart, expiresAt: { gt: new Date() }, active: true },
    include: { user: true, session: true },
  });
  if (!token) return null;
  if (!token.session.active) return null;

  const result = await argon2.verify(token.hash, secret);

  if (!result) return false;
  return { user: token.user, session: token.session };
}

async function createNewSession(user: User) {
  const session = await db.session.create({
    data: {
      userId: user.id,
    },
  });

  const res = await refreshSession(session);
  return res as Exclude<typeof res, null>;
}

async function refreshSession(session: Session) {
  if (!session.active) return null;
  await db.sessionToken.updateMany({
    where: {
      active: true,
      sessionId: session.id,
    },
    data: {
      active: false,
    },
  });

  const refreshExpiresAt = new Date(
    Date.now() + ms(env.REFRESH_TOKEN_LIFESPAN as StringValue),
  );

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;

  const token = await createSessionToken();
  await db.sessionToken.create({
    data: {
      userId: user.id,
      public: token.publicPart,
      hash: token.hash,
      expiresAt: refreshExpiresAt,
      sessionId: session.id,
    },
  });

  const authData = {
    userId: user.id,
    role: user.role,
    sessionId: session.id,
  };
  const accessToken = jwt.sign(authData, env.AUTH_SECRET, {
    expiresIn: env.ACCESS_TOKEN_LIFESPAN as StringValue,
  });

  log.info(`${user.username} refreshed session`, {
    user: user.id,
    sessionId: session.id,
  });

  return {
    accessToken,
    authData,
    refreshToken: token.key,
    sessionId: session.id,
  };
}

export function generateAdminToken(userId: number | null = null) {
  return jwt.sign(
    {
      userId: userId ?? -1,
      role: "admin",
      sessionId: -1,
    }, // sessionId: session.id
    env.AUTH_SECRET,
    { expiresIn: "30m" },
  );
}

function assignSessionInfo(sessionId: number, req: Request) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  return db.session.update({
    where: {
      id: sessionId,
      userId: req.auth?.userId,
    },
    data: {
      description: ip as string,
    },
  });
}

export async function auth(req: Request, res: Response, next: NextFunction) {
  const refreshToken = req.headers["x-refresh-token"] || req.cookies["x-refresh-token"];
  const accessToken =
    req.headers["x-access-token"] ||
    req.headers.authorization?.split(" ")[1] ||
    req.cookies["x-access-token"] ||
    null;

  // console.log("U:", refreshToken, accessToken,
  //   "\nH:", req.headers["x-refresh-token"], req.headers["x-access-token"],
  //   "\nC:", req.cookies["x-refresh-token"], req.cookies["x-access-token"])

  res.setHeader('Access-Control-Expose-Headers', 'X-Access-Token, X-Refresh-Token');

  if (!accessToken && !refreshToken) return next();
  if (Array.isArray(accessToken) || Array.isArray(refreshToken)) return next();

  if (accessToken) {
    try {
      const authData = jwt.verify(accessToken, env.AUTH_SECRET);
      if (!authData) throw new Error("Invalid or expired token");
      const auth = UserAuthObjectSchema.parse(authData);
      req.auth = auth;
      return next();
    } catch {
      res.appendHeader("X-Auth-Error", "Invalid or expired access token");
    }
  }
  if (refreshToken) {
    const data = await validateSessionToken({ key: refreshToken });
    if (!data) {
      res.appendHeader("X-Auth-Error", "Invalid refresh token");
      return next();
    }
    const session = await refreshSession(data.session);
    if (!session) {
      res.appendHeader("X-Auth-Error", "Session does not exist");
      return next();
    }
    req.auth = session.authData;
    res.appendHeader("X-Access-Token", session.accessToken);
    res.appendHeader("X-Refresh-Token", session.refreshToken);
    res.cookie("x-access-token", session.accessToken)
    res.cookie("x-refresh-token", session.refreshToken)
  }
  return next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.sendStatus(401);
  }
  return next();
}

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));

app.use(basicLimiter);

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

app.post("/register", strictLimiter, async (req, res) => {
  try {
    const { data, success, error } = UserRegisterSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        status: "error",
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
        status: "error",
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
        status: "error",
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
    res.cookie("x-refresh-token", session.refreshToken)
    await assignSessionInfo(session.sessionId, req);
    return res.status(201).json({
      status: "ok",
      message: "Successfully registered user",
      data: {
        user: UserReturnSchema.parse(user),
        session: session,
      },
    });
  } catch (err) {
    log.error(`Register error: ${err}`);
    return res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.post("/login", strictLimiter, async (req, res) => {
  try {
    const { data, success, error } = UserLoginSchema.safeParse(req.body);
    if (!success) {
      res.status(400).json({
        status: "error",
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
        status: "error",
        message: "User does not exist",
      });
      return;
    }
    if (!(await argon2.verify(user.password, password))) {
      res.status(400).json({
        status: "error",
        message: "Invalid password",
      });
      log.warn(`Incorrect password during login as ${username}`);
      return;
    }
    const session = await createNewSession(user);
    res.appendHeader("X-Access-Token", session.accessToken);
    res.appendHeader("X-Refresh-Token", session.refreshToken);
    res.cookie("x-access-token", session.accessToken)
    res.cookie("x-refresh-token", session.refreshToken)
    await assignSessionInfo(session.sessionId, req);
    res.status(200).json({
      status: "ok",
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
      status: "error",
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
        status: "error",
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
        status: "error",
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

    log.info(`User ${user.username} logged out`, {
      user: user.id,
      sessionId: auth.sessionId,
    });
    res.status(200).json({
      status: "ok",
      message: "Goodbye",
    });
  } catch (err) {
    log.error(`Logout error: ${err}`, {
      user: req.auth?.userId ?? -1,
    });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to logout",
    });
  }
});

app.patch("/user", async (req, res) => {
  /*Update user to new values (pwd,username,etc. self or adminside)*/
  log.error("Received patch to /user");
  res.status(500).json({
    status: "error",
    message: "Not implemented yet",
  });
});

app.get("/", (req, res) => {
  const auth = req.auth
  if (!auth) {
    res.status(401).send("")
    return;
  }
  try {
    res.status(200).json(auth);
  } catch {
    res.status(401).send("")
    return;
  }
});

app.get("/self", requireAuth, async (req, res) => {
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
        status: "error",
        message: "Could not find current user",
      });
      return;
    }
    res.status(200).json(UserReturnSchema.parse(user));
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to get current user",
    });
    log.error(`An error occured on /self Err: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
  }
});

export default app;

export const UserAuthObjectSchema = z.object({
  userId: z.number().int(),
  role: z.nativeEnum(user_role),
  sessionId: z.number().int(),
});

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.auth?.role !== user_role.admin) {
    log.warn("Admin request from a non-admin user", {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
    res.status(401).json({
      status: "error",
      message: "You are not authorized to access this endpoint",
    });
    return;
  }
  next();
}
