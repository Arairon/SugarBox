import express, { Router } from "express";
import prisma from "../db.js";
import log from "../logger.js";
import { RefinementCtx, z } from "zod";
// import { zu } from "zod_utilz";
import { basicLimiter, validateAuth } from "./auth.js";
import { formatZodIssue } from "../utils.js";
//import { requireAdmin } from "./auth.js";

const app: Router = Router();

app.use(express.json({ limit: "10mb" }));
app.use(basicLimiter);

app.get("/", async (req, res) => {
  const chars = await prisma.char.findMany({
    where: {
      ownerId: req.auth?.userId,
    },
  });
  res.status(200).json(chars);
});

app.get("/uuid/:charId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.charId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }

  const charId = uuidParse.data;
  const char = await prisma.char.findUnique({
    where: {
      uuid: charId,
      ownerId: req.auth?.userId,
    },
  });
  if (!char) {
    res.status(404).json({
      status: "error",
      message: "Character not found",
    });
    return;
  }
  res.status(200).json({
    status: "ok",
    message: "Retrieved character",
    data: char,
  });
});

// export const CharNewSchema = z.object({
//   uuid: z.string().uuid(),
//   name: z.string(),
//   ownerId: z.any().transform(() => -1), // creating empty field
//   gameId: z.number().int().min(1),
//   slots: z.string().default("[]"),
//   archived: z.boolean({ coerce: true }).default(false),
//   archivedAt: z.date({ coerce: true }).default(new Date(0)),
// });

export const CharSchema = z.object({
  id: z.number().int().min(1),
  uuid: z.string().uuid({ message: "Invalid uuid" }),
  name: z
    .string({ message: "Missing name" })
    .max(100, "Character name cannot be over the long (100)"),
  ownerId: z
    .number()
    .optional()
    .transform((v) => v ?? -1),
  gameId: z.string().uuid({ message: "gameId must be a valid uuid" }),
  slots: z
    .string()
    .default("[]")
    .superRefine((val: string, ctx: RefinementCtx) => {
      try {
        const json = JSON.parse(val);
        z.array(z.union([z.string().uuid(), z.literal("")])).parse(json);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_type,
          message: "slots must be a valid json array of uuids or empty strings",
        } as z.IssueData);
      }
    }),
  //.transform((v) => z.array(z.string().uuid()).parse(JSON.parse(v))),
  archived: z.boolean({ coerce: true }).default(false),
  archivedAt: z.date({ coerce: true }).default(new Date(0)),
  updatedAt: z.date({ coerce: true }).default(() => new Date()),
  createdAt: z.date({ coerce: true }).default(() => new Date()),
});
export type CharObj = z.infer<typeof CharSchema>;

// export const CharFromRemoteSchema = z
//   .object({
//     id: z.any(),
//     uuid: z.string().uuid(),
//     remoteId: z.any(),
//     name: z.string(),
//     ownerId: z.any().transform(() => -1), // creating empty field
//     gameId: z.number().int().min(0),
//     slots: zu.stringToJSON(),
//     archived: z
//       .union([z.literal(0), z.literal(1)])
//       .default(0)
//       .transform((v) => !!v),
//     archivedAt: z
//       .number()
//       .int()
//       .min(0)
//       .transform((v) => new Date(v)),
//   })
//   .omit({ id: true, remoteId: true });

// export const CharToRemoteSchema = z
//   .object({
//     id: z.number().int(),
//     uuid: z.string().uuid(),
//     name: z.string(),
//     ownerId: z.any(),
//     gameId: z.number().int().min(0),
//     slots: z.array(z.number()).transform((v) => JSON.stringify(v)),
//     archived: z.boolean().transform((v) => Number(v)),
//     archivedAt: z.date().transform((v) => v.getTime()),
//   })
//   .omit({ ownerId: true });
//type CharNew = z.infer<typeof CharNewSchema>

app.post("/new", async (req, res) => {
  const {
    data: char,
    success,
    error,
  } = CharSchema.omit({ id: true }).safeParse(req.body);
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
      message: "Invalid auth token",
    });
    return;
  }
  try {
    char.ownerId = auth.userId;
    const createdChar = await prisma.char.create({
      data: char,
    });
    log.info(`User (${auth.userId}) created a new character`);
    res.status(200).json({
      status: "ok",
      message: "Created a new character",
      data: createdChar,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when adding a new character",
    });
    log.error(
      `Error occurred on char addition by ${req.auth?.userId}. Err: ${err}`
    );
  }
});

app.patch("/uuid/:charId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.charId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }
  const charId = uuidParse.data;
  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth token",
    });
    return;
  }

  const {
    data: charData,
    success,
    error,
  } = CharSchema.omit({ id: true }).safeParse(req.body);
  if (!success) {
    res.status(400).json({
      status: "error",
      message: error.errors.map(formatZodIssue),
    });
    return;
  }

  try {
    charData.ownerId = auth.userId;
    const char = await prisma.char.upsert({
      where: {
        uuid: charId,
        ownerId: auth.userId ?? 0,
      },
      update: charData,
      create: charData,
    });
    res.status(200).json({
      status: "ok",
      message: "Character updated",
      data: char,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when changing a character",
    });
    log.error(
      `Error occurred on char patch by ${req.auth?.userId}. Err: ${err}`
    );
  }
});

app.delete("/uuid/:charId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.charId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }
  const charId = uuidParse.data;
  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth token",
    });
    return;
  }
  try {
    // await prisma.char.update({
    //   where: {
    //     uuid: charId,
    //     ownerId: auth.userId ?? 0,
    //   },
    //   data: {
    //     archived: true,
    //     archivedAt: new Date()
    //   }
    // });
    await prisma.char.delete({
      where: {
        uuid: charId,
        ownerId: auth.userId ?? 0,
      },
    });
    res.status(200).json({
      status: "ok",
      message: "Character deleted",
    });
    log.info(`User (${auth.userId}) deleted a character`);
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: "An error has occurred when deleting a character",
    });
    log.error(
      `Error occurred on char deletion by ${req.auth?.userId}. Err: ${err}`
    );
  }
});

export default app;
