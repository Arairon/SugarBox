import express, { Router } from "express";
import prisma from "../db.js";
import log from "../logger.js";
import { z, ZodError } from "zod";
import { validateAuth } from "./auth.js";
import { formatZodIssue } from "../utils.js";
import { GameObj, GameSchema } from "./games.js";
import { CharObj, CharSchema } from "./chars.js";
import { SaveObj, SaveSchema } from "./saves.js";
//import { requireAdmin } from "./auth.js";

const app: Router = Router();

app.use(express.json({ limit: "50mb" }));

const SyncRequestSchema = z.object({
  cutoffPoint: z.date({ coerce: true }),
  games: z.boolean().default(true),
  chars: z.boolean().default(true),
  saves: z.boolean().default(true),
});

const SyncUpSchema = z.object({
  games: z.array(z.unknown()).default([]),
  chars: z.array(z.unknown()).default([]),
  saves: z.array(z.unknown()).default([]),
});

app.post("/up", async (req, res) => {
  const { data, success, error } = SyncUpSchema.safeParse(req.body);
  if (!success) {
    res.status(400).json({
      status: "error",
      message: error.errors.map(formatZodIssue),
    });
    return;
  }
  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth data",
    });
    return;
  }
  const { games, chars, saves } = data;
  const errors = [] as (ZodError | string)[];
  for (const rawgame of games) {
    const {
      data: game,
      success,
      error,
    } = GameSchema.omit({ id: true }).safeParse(rawgame);
    if (!success) {
      errors.push(error);
      continue;
    }
    game.ownerId = auth.userId;
    try {
      await prisma.game.upsert({
        where: {
          ownerId: auth.userId,
          uuid: game.uuid,
        },
        update: game,
        create: game,
      });
    } catch (err) {
      errors.push("Prisma error on game " + game.uuid);
      log.warn(`Game syncUp err: ${err}`);
    }
  }

  for (const rawchar of chars) {
    const {
      data: char,
      success,
      error,
    } = CharSchema.omit({ id: true }).safeParse(rawchar);
    if (!success) {
      errors.push(error);
      continue;
    }
    char.ownerId = auth.userId;
    try {
      await prisma.char.upsert({
        where: {
          ownerId: auth.userId,
          uuid: char.uuid,
        },
        update: char,
        create: char,
      });
    } catch {
      errors.push("Prisma error on char " + char.uuid);
    }
  }

  for (const rawsave of saves) {
    const {
      data: save,
      success,
      error,
    } = SaveSchema.omit({ id: true }).safeParse(rawsave);
    if (!success) {
      errors.push(error);
      continue;
    }
    save.ownerId = auth.userId;
    try {
      await prisma.save.upsert({
        where: {
          ownerId: auth.userId,
          uuid: save.uuid,
        },
        update: save,
        create: save,
      });
    } catch {
      errors.push("Prisma error on save " + save.uuid);
    }
  }

  log.info(
    `Sync uploaded ${games.length}g, ${chars.length}c, ${saves.length}s. Errors [${errors.length}] ${errors}`,
    {
      user: auth.userId,
      sessionTokenId: auth.sessionTokenId,
      sessionId: auth.sessionId,
    }
  );
  res.status(200).json({
    status: "ok",
    message: "Synced",
    data: {
      errors,
    },
  });
});

app.get("/down", async (req, res) => {
  const {
    data: params,
    success,
    error,
  } = SyncRequestSchema.safeParse(req.query);
  if (!success) {
    res.status(400).json({
      status: "error",
      message: error.errors.map(formatZodIssue),
    });
    return;
  }
  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth data",
    });
    return;
  }
  const { cutoffPoint, games, chars, saves } = params;
  const resp = {
    games: [] as GameObj[],
    chars: [] as CharObj[],
    saves: [] as SaveObj[],
  };
  const archived = cutoffPoint.getTime() === 0 ? false : undefined;
  if (games) {
    resp.games = (
      await prisma.game.findMany({
        where: {
          ownerId: auth.userId,
          archived: archived,
          updatedAt: {
            gte: cutoffPoint,
          },
        },
      })
    ).map((g) => GameSchema.parse(g));
  }
  if (chars) {
    resp.chars = (
      await prisma.char.findMany({
        where: {
          ownerId: auth.userId,
          archived: archived,
          updatedAt: {
            gte: cutoffPoint,
          },
        },
      })
    ).map((g) => CharSchema.parse(g));
  }
  if (saves) {
    resp.saves = (
      await prisma.save.findMany({
        where: {
          ownerId: auth.userId,
          archived: archived,
          updatedAt: {
            gte: cutoffPoint,
          },
        },
      })
    ).map((g) => SaveSchema.parse(g));
  }

  log.info(
    `Sync downloaded ${resp.games.length}g, ${resp.chars.length}c, ${
      resp.saves.length
    }s. [${cutoffPoint.toJSON()}]`,
    {
      user: auth.userId,
      sessionTokenId: auth.sessionTokenId,
      sessionId: auth.sessionId,
    }
  );
  res.status(200).json({
    status: "ok",
    message: "Found data for sync",
    data: resp,
  });
});

export default app;
