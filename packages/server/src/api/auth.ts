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

  if (!publicPart || !secret) return null

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

export async function createNewSession(user: User) {
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
    expiresAt: refreshExpiresAt
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

export function assignSessionInfo(sessionId: number, req: Request) {
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
    res.cookie("x-refresh-token", session.refreshToken, { expires: session.expiresAt })
  }
  return next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized"
    });
  }
  return next();
}

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));

app.use(basicLimiter);

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
      ok: false,
      message: "You are not authorized to access this endpoint",
    });
    return;
  }
  next();
}
