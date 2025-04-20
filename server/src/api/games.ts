import express, { Router } from "express";
import prisma from "../db.js";
import log from "../logger.js";
import { RefinementCtx, z } from "zod";
import { validateAuth } from "./auth.js";
import { formatZodIssue } from "../utils.js";
//import { requireAdmin } from "./auth.js";

const app: Router = Router();

app.use(express.json({ limit: "10mb" }));

app.get("/", async (req, res) => {
  const games = await prisma.game.findMany({
    where: { ownerId: req.auth?.userId },
  });
  res.status(200).json(games);
});

app.get("/uuid/:gameId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.gameId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }
  const gameId = uuidParse.data;
  const game = await prisma.game.findUnique({
    where: {
      uuid: gameId,
      ownerId: req.auth?.userId,
    },
  });
  if (!game) {
    res.status(404).json({
      status: "error",
      message: "Game not found",
    });
    return;
  }
  res.status(200).json({
    status: "ok",
    message: "Retrieved game",
    data: game,
  });
});

export const GamePathSchema = z.object({
  name: z.string().max(100).nullable().default(null).optional(),
  url: z.string().max(256).nonempty(),
});

export const GameSchema = z.object({
  id: z.number().int().min(1),
  uuid: z.string().uuid(),
  name: z.string().max(100, "Name cannot be that long (100)"),
  shortname: z
    .string()
    .max(100, "Shortname cannot be that long (100)")
    .default(""),
  description: z
    .string()
    .max(256, "Description cannot be that long (256)")
    .default(""),
  ownerId: z
    .number()
    .optional()
    .transform((v) => v ?? -1),
  paths: z
    .string()
    .default("[]")
    .superRefine((val: string, ctx: RefinementCtx) => {
      try {
        const json = JSON.parse(val);
        z.array(GamePathSchema).parse(json);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_type,
          message:
            "slots must be a valid json array of game paths ({url: string, name?: string|null})",
        } as z.IssueData);
      }
    }),
  archived: z.boolean().default(false),
  archivedAt: z.date({ coerce: true }).default(new Date(0)),
  updatedAt: z.date({ coerce: true }).default(() => new Date()),
  createdAt: z.date({ coerce: true }).default(() => new Date()),
});
export type GameObj = z.infer<typeof GameSchema>;

app.post("/new", async (req, res) => {
  const {
    data: game,
    success,
    error,
  } = GameSchema.omit({ id: true }).safeParse(req.body);
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
  try {
    game.ownerId = auth.userId;
    const createdGame = await prisma.game.create({
      data: game,
    });
    res.status(200).json({
      status: "ok",
      message: "Created a new game",
      data: createdGame,
    });
    log.info(`User (${auth.userId}) created a new game`);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when adding a new game",
    });
    log.error(`Error occurred on game addition. Err: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      sessionTokenId: req.auth?.sessionTokenId,
    });
  }
});

app.patch("/uuid/:gameId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.gameId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }
  const gameId = uuidParse.data;

  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth data",
    });
    return;
  }

  const {
    data: gameData,
    success,
    error,
  } = GameSchema.omit({ id: true }).safeParse(req.body);
  if (!success) {
    res.status(400).json({
      status: "error",
      message: error.errors.map(formatZodIssue),
    });
    return;
  }

  try {
    gameData.ownerId = auth.userId;
    const game = await prisma.game.upsert({
      where: {
        uuid: gameId,
        ownerId: auth.userId,
      },
      update: gameData,
      create: gameData,
    });
    res.status(200).json({
      status: "ok",
      message: "Game updated",
      data: game,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when changing a game",
    });
    log.error(`Error occurred on game patch. Err: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      sessionTokenId: req.auth?.sessionTokenId,
    });
  }
});

app.delete("/uuid/:gameId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.gameId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }
  const gameId = uuidParse.data;

  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth data",
    });
    return;
  }

  try {
    await prisma.game.delete({
      where: {
        uuid: gameId,
        ownerId: auth.userId,
      },
    });
    res.status(200).json({
      status: "ok",
      message: "Game deleted",
    });
    log.info(`User (${auth.userId}) deleted a game`);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when deleting a game",
    });
    log.error(`Error occurred on game deletion. Err: ${err}`, {
      user: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      sessionTokenId: req.auth?.sessionTokenId,
    });
  }
});

export default app;
