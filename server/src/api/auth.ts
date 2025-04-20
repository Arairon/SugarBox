import argon2 from "argon2";
import prisma from "../db.js";
import { user_role } from "@prisma/client";
import { NextFunction, Router, Request, Response } from "express";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import log from "../logger.js";
import env from "../env.js";
import { z } from "zod";
import { formatZodIssue } from "../utils.js";
import ms, { StringValue } from "ms";
import { UserObj } from "./user.js";

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

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));

type SessionTokenObj = {
  id: number;
  createdAt: Date;
  // updatedAt: Date;
  expiresAt: Date;
  userId: number;
  sessionId: number;
};

async function refreshSession(sessionToken: SessionTokenObj) {
  const res = await prisma.sessionToken.findUnique({
    where: {
      id: sessionToken.id,
    },
    select: {
      user: true,
      active: true,
      session: true,
    },
  });
  if (!res) throw new Error("Session not found");
  const { user, active, session } = res;

  if (!session.active) {
    log.info("Invalidated session token used", {
      user: user.id,
      sessionTokenId: sessionToken.id,
      sessionId: sessionToken.sessionId,
      role: user.role,
    });
    return -1;
  }

  if (!active) {
    log.warn("Refresh token reused", {
      user: user.id,
      sessionTokenId: sessionToken.id,
      sessionId: sessionToken.sessionId,
      role: user.role,
    });
    return -1;
  }

  await prisma.sessionToken.update({
    where: {
      id: sessionToken.id,
    },
    data: {
      active: false,
    },
  });

  return createNewSession(user, sessionToken.sessionId);
}

async function createNewSession(
  user: UserObj,
  sessionId: number | null = null
) {
  const accessExpiresAt = new Date(
    Date.now() + ms(env.ACCESS_TOKEN_LIFESPAN as StringValue)
  );
  const refreshExpiresAt = new Date(
    Date.now() + ms(env.REFRESH_TOKEN_LIFESPAN as StringValue)
  );
  if (sessionId === null) {
    const session = await prisma.session.create({
      data: {
        userId: user.id,
      },
    });
    sessionId = session.id;
  }
  const sessionToken = await prisma.sessionToken.create({
    data: {
      userId: user.id,
      expiresAt: refreshExpiresAt,
      sessionId,
    },
  });
  const accesstoken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      sessionTokenId: sessionToken.id,
      sessionId: sessionId,
      type: "access",
    }, // sessionId: session.id
    env.AUTH_SECRET,
    { expiresIn: env.ACCESS_TOKEN_LIFESPAN }
  );
  const refreshtoken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      sessionTokenId: sessionToken.id,
      sessionId: sessionId,
      type: "refresh",
    },
    env.AUTH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_LIFESPAN }
  );
  return {
    sessionTokenId: sessionToken.id,
    sessionId: sessionId,
    accesstoken,
    refreshtoken,
    accessExpiresAt,
    refreshExpiresAt,
  };
}

function assignSessionInfo(sessionId: number, req: Request) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  return prisma.session.update({
    where: {
      id: sessionId,
      userId: req.auth?.userId,
    },
    data: {
      description: ip as string,
    },
  });
}

app.post("/register", async (req, res) => {
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
    const existing_username = await prisma.user.findUnique({
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
    const existing_email = await prisma.user.findUnique({
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
    const hashed_password = await argon2.hash(username + password);
    const user_data = {
      username,
      displayname,
      email,
      password: hashed_password,
      role: env.REGISTERED_USERS_LIMITED ? user_role.limited : user_role.user,
    };
    const user = await prisma.user.create({ data: user_data });
    const session = await createNewSession(user);
    log.info(`User ${username} registered`, {
      user: user.id,
      sessionTokenId: session.sessionTokenId,
      sessionId: session.sessionId,
      role: user.role,
    });
    await assignSessionInfo(session.sessionId, req);
    res.status(201).json({
      status: "ok",
      message: "Successfully registered user",
      data: {
        user: UserReturnSchema.parse(user),
        session,
      },
    });
  } catch (err) {
    log.error(`Register error: ${err}`);
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to complete request",
    });
  }
});

app.get("/refresh", verifyToken, async (req, res) => {
  try {
    const { data: auth } = validateAuth(req.auth, "refresh");
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth data",
      });
      return;
    }
    const user = await prisma.user.findUnique({
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
    const currentSessionToken = await prisma.sessionToken.findUnique({
      where: {
        id: auth.sessionTokenId,
        expiresAt: {
          gte: new Date(),
        },
      },
    });
    if (!currentSessionToken) {
      res.status(403).json({
        status: "error",
        message: "Session does not exist or has expired",
      });
      return;
    }
    const session = await refreshSession(currentSessionToken);
    if (session === -1) {
      res.status(403).json({
        status: "error",
        message: "Invalid refresh token. Either reused or invalidated.",
      });
      return;
    }
    await assignSessionInfo(session.sessionId, req);
    log.info(`User ${user.username} refreshed their session`, {
      user: user.id,
      sessionTokenId: session.sessionTokenId,
      sessionId: session.sessionId,
      role: user.role,
    });
    res.status(200).json({
      status: "ok",
      message: "Refreshed session",
      data: {
        user: UserReturnSchema.parse(user),
        session,
      },
    });
  } catch (err) {
    log.error(`Refresh error: ${err}`, { user: req.auth?.userId ?? -1 });
    res.status(500).json({
      status: "error",
      message: "An error has occurred when trying to refresh session",
    });
  }
});

app.post("/login", async (req, res) => {
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
    let user = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });
    if (!user) {
      user = await prisma.user.findUnique({
        where: {
          email: username,
        },
      });
    }
    if (!user) {
      res.status(404).json({
        status: "error",
        message: "User does not exist",
      });
      return;
    }
    if (!(await argon2.verify(user.password, user.username + password))) {
      res.status(400).json({
        status: "error",
        message: "Invalid password",
      });
      log.warn(`Incorrect password during login as ${username}`);
      return;
    }
    const session = await createNewSession(user);
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
      sessionTokenId: session.sessionTokenId,
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

app.post("/logout", verifyToken, async (req, res) => {
  try {
    const { data: auth } = validateAuth(req.auth);
    if (!auth) {
      res.status(403).json({
        status: "error",
        message: "Invalid auth data",
      });
      return;
    }
    const user = await prisma.user.findUnique({
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
    const currentSession = await prisma.session.findUnique({
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
    } else {
      await prisma.sessionToken.update({
        where: {
          id: auth.sessionTokenId,
        },
        data: {
          active: false,
        },
      });
      await prisma.session.update({
        where: {
          id: currentSession.id,
        },
        data: {
          active: false,
        },
      });
    }
    log.info(`User ${user.username} Logged out`, {
      user: user.id,
      sessionId: auth.sessionTokenId,
      sessionTokenId: auth.sessionId,
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
  const authHeader = req.header("Authorization");
  const token = authHeader?.split(" ")?.at(1);
  if (!token) {
    res.status(401).json({ user: null, role: null });
    return;
  }
  try {
    const decoded: JwtPayload = jwt.verify(
      token,
      env.AUTH_SECRET
    ) as JwtPayload;
    const { userId, role } = decoded;
    res.status(200).json({ user: userId, role: role });
  } catch {
    res.status(401).json({ user: null, role: null });
    return;
  }
});

app.get("/self", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
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
      sessionTokenId: req.auth?.sessionTokenId,
      sessionId: req.auth?.sessionId,
      role: req.auth?.role,
    });
  }
});

export default app;

interface JwtPayload {
  userId: number;
  role: user_role;
  sessionTokenId: number;
  sessionId: number;
  type: string;
}

export const UserAuthObjectSchema = z.object({
  userId: z.number().int(),
  role: z.nativeEnum(user_role),
  sessionTokenId: z.number().int(),
  sessionId: z.number().int(),
  type: z.enum(["access", "refresh"]),
});

export function validateAuth(
  auth: unknown,
  type: "access" | "refresh" = "access"
) {
  return UserAuthObjectSchema.refine((auth) => auth.type === type).safeParse(
    auth
  );
}

export function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.header("Authorization");
  const token = authHeader?.split(" ")?.at(1);
  if (!token) {
    res.status(401).json({
      status: "error",
      message: "You must be authorized to access this route",
    });
    return;
  }
  try {
    const decoded: JwtPayload = jwt.verify(
      token,
      env.AUTH_SECRET
    ) as JwtPayload;
    const { userId, role, sessionTokenId, sessionId, type } = decoded;
    req.auth = {
      userId,
      role,
      sessionTokenId,
      sessionId,
      type,
    } as UserAuthObject;
    next();
  } catch {
    res.status(401).json({
      status: "error",
      message: "Invalid auth token",
    });
    return;
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.auth?.role !== "admin") {
    log.debug("User role: " + req.auth?.role);
    res.status(401).json({
      status: "error",
      message: "You are not authorized to access this endpoint",
    });
    return;
  }
  next();
}
