import express, { Router } from "express";
import prisma from "../db.js";
import log from "../logger.js";
import { validateAuth } from "./auth.js";
// import crypto from "crypto";
import { z } from "zod";
// import zlib from "zlib";
import { formatZodIssue } from "../utils.js";

const app: Router = Router();

app.use(express.json({ limit: "10mb" }));

// export function compressSave(saveData: string): string {
//   return zlib.deflateSync(saveData).toString("base64");
// }
// export function decompressSave(saveData: string): string {
//   return zlib.inflateSync(Buffer.from(saveData, "base64")).toString();
// }

export const SaveSchema = z.object({
  id: z.number().min(1),
  uuid: z.string().uuid(),
  name: z
    .string()
    .max(100, "Name cannot be that long (100)")
    .default("[Unnamed save]"),
  description: z
    .string()
    .max(256, "Description cannot be that long (256)")
    .default(""),
  gameVersion: z.string().default("vUNK"),
  gameId: z.string().uuid({ message: "gameId must be a valid uuid" }),
  charId: z.string().uuid({ message: "charId must be a valid uuid" }),
  ownerId: z
    .number()
    .optional()
    .transform((v) => v ?? -1),
  data: z.string().max(1000000, "A save cannot exceed 1mb"),
  size: z.number(),
  hash: z.string().max(256, "Hash cannot be that long (256)"),
  archived: z.boolean({ coerce: true }).default(false),
  archivedAt: z.date({ coerce: true }).default(new Date(0)),
  updatedAt: z.date({ coerce: true }).default(() => new Date()),
  createdAt: z.date({ coerce: true }).default(() => new Date()),
});
export type SaveObj = z.infer<typeof SaveSchema>;

app.post("/new", async (req, res) => {
  const {
    data: save,
    success,
    error,
  } = SaveSchema.omit({ id: true }).safeParse(req.body);
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
    save.ownerId = auth.userId;
    const createdSave = await prisma.save.create({
      data: save,
    });
    res.status(200).json({
      status: "ok",
      message: "Created a new save",
      data: createdSave,
    });
    log.debug(`User created a new save`, {
      user: auth.userId,
      sessionTokenId: auth.sessionTokenId,
      sessionId: auth.sessionId,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when adding a new save",
    });
    log.error(`Error occurred on save addition. Err: ${err}`, {
      user: auth.userId,
      sessionTokenId: auth.sessionTokenId,
      sessionId: auth.sessionId,
    });
  }
});

const SaveUpdSchema = SaveSchema.omit({ data: true }).merge(
  z.object({ data: z.string().optional() })
);

app.get("/uuid/:saveId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.saveId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }

  const saveId = uuidParse.data;
  const save = await prisma.char.findUnique({
    where: {
      uuid: saveId,
      ownerId: req.auth?.userId,
    },
  });
  if (!save) {
    res.status(404).json({
      status: "error",
      message: "Save not found",
    });
    return;
  }
  res.status(200).json({
    status: "ok",
    message: "Retrieved save",
    data: save,
  });
});

app.patch("/uuid/:saveId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.saveId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }
  const saveId = uuidParse.data;

  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth data",
    });
    return;
  }

  const {
    data: saveData,
    success,
    error,
  } = SaveUpdSchema.omit({ id: true }).safeParse(req.body);
  if (!success) {
    res.status(400).json({
      status: "error",
      message: error.errors.map(formatZodIssue),
    });
    return;
  }

  try {
    saveData.ownerId = auth.userId;
    const save = await prisma.save.upsert({
      where: {
        uuid: saveId,
        ownerId: auth.userId,
      },
      update: saveData,
      create: saveData as SaveObj,
    });
    res.status(200).json({
      status: "ok",
      message: "Save updated",
      data: save,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "An error has occurred when changing a save",
    });
    log.error(`Error occurred on save patch. Err: ${err}`, {
      user: auth.userId,
      sessionTokenId: auth.sessionTokenId,
      sessionId: auth.sessionId,
    });
  }
});

app.patch("/uuid/:saveId", async (req, res) => {
  const uuidParse = z.string().uuid().safeParse(req.params.saveId);
  if (!uuidParse.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid uuid",
    });
    return;
  }
  const saveId = uuidParse.data;

  const { data: auth } = validateAuth(req.auth);
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth data",
    });
    return;
  }

  try {
    await prisma.save.delete({
      where: {
        uuid: saveId,
        ownerId: auth.userId,
      },
    });
    res.status(200).json({
      status: "ok",
      message: "Save deleted",
    });
    log.info(`User (${auth.userId}) deleted a save`);
  } catch (err) {
    res.status(400).json({
      status: "error",
      message: "An error has occurred when deleting a save",
    });
    log.error(`Error occurred on save deletion. Err: ${err}`, {
      user: auth.userId,
      sessionTokenId: auth.sessionTokenId,
      sessionId: auth.sessionId,
    });
  }
});

// app.post("/game/:gameId", async (req, res) => {
//   const { name, gameVersion, description, createdAt, data, charId } = req.body;
//   if (isNaN(Number(req.params.gameId))) {
//     res.status(400).json({
//       status: "error",
//       message: "GameId must be a number",
//     });
//     return;
//   }
//   const gameId = parseInt(req.params.gameId);

//   if (!data) {
//     res.status(400).json({
//       status: "error",
//       message: "You must supply a 'data' property with save data.",
//     });
//     return;
//   }
//   try {
//     const saveObj = await prisma.save.create({
//       data: {
//         ownerId: req.auth?.userId ?? -1,
//         name,
//         data: data,
//         hash: crypto.createHash("md5").update(data).digest("hex"),
//         gameVersion,
//         description,
//         gameId: gameId,
//         charId: charId ?? null,
//         createdAt: createdAt ? new Date(createdAt) : new Date(),
//       },
//     });
//     log.info(`Created a new save. ${saveObj}`);
//     res.status(200).json(saveObj);
//   } catch (err) {
//     res.status(400).json({
//       status: "error",
//       message: "An error has occurred when adding a save",
//     });
//     log.error(
//       `Error occurred on save addition by ${req.auth?.userId}. Err: ${err}`
//     );
//   }
// });

// app.get("/game/:gameId", async (req, res) => {
//   if (isNaN(Number(req.params.gameId))) {
//     res.status(400).json({
//       status: "error",
//       message: "GameId must be a number",
//     });
//     return;
//   }
//   const gameId = parseInt(req.params.gameId);

//   const saves = await prisma.save.findMany({
//     where: {
//       ownerId: req.auth?.userId,
//       gameId: gameId,
//     },
//   });

//   res.status(200).json(saves);
// });

// app.get("/user", async (req, res) => {
//   const saves = await prisma.save.findMany({
//     where: {
//       ownerId: req.auth?.userId,
//     },
//     include: {
//       game: true,
//     },
//   });

//   res.status(200).json(saves);
// });

// app.get("/user/:userId", requireAdmin, async (req, res) => {
//   if (isNaN(Number(req.params.userId))) {
//     res.status(400).json({
//       status: "error",
//       message: "userId must be a number",
//     });
//     return;
//   }
//   const userId = parseInt(req.params.userId);
//   const saves = await prisma.save.findMany({
//     where: {
//       ownerId: userId,
//     },
//     include: {
//       game: true,
//     },
//   });

//   res.status(200).json(saves);
// });

// app.get("/id/:saveId", async (req, res) => {
//   if (isNaN(Number(req.params.saveId))) {
//     res.status(400).json({
//       status: "error",
//       message: "SaveId must be a number",
//     });
//     return;
//   }
//   const saveId = parseInt(req.params.saveId);

//   const save = await prisma.save.findUnique({
//     where: {
//       id: saveId,
//     },
//   });

//   if (save === null) {
//     res.status(404).json({ error: "Save not found." });
//     return;
//   }

//   if (save?.ownerId != req.auth?.userId && req.auth?.role !== "admin") {
//     res
//       .status(401)
//       .json({ error: "You do not have permission to access this save." });
//     return;
//   }

//   res.status(200).json(save);
// });

// app.patch("/id/:saveId", async (req, res) => {
//   if (isNaN(Number(req.params.saveId))) {
//     res.status(400).json({
//       status: "error",
//       message: "SaveId must be a number",
//     });
//     return;
//   }
//   const saveId = parseInt(req.params.saveId);
//   const { name, gameVersion, description, data, charId, archived } = req.body;
//   if (data) {
//     res.status(400).json({
//       status: "error",
//       message: "Amending save data is not supported. Create a new save.",
//     });
//     return;
//   }
//   const updateData: any = {}; // eslint-disable-line
//   if (name !== undefined) updateData.name = name;
//   if (gameVersion !== undefined) updateData.gameVersion = gameVersion;
//   if (description !== undefined) updateData.description = description;
//   if (charId !== undefined) updateData.charId = parseInt(charId);
//   if (archived !== undefined) updateData.archived = !!archived;
//   try {
//     await prisma.save.update({
//       where: {
//         ownerId: req.auth?.userId,
//         id: saveId,
//       },
//       data: updateData,
//     });
//     res.status(200).json({ status: "ok", message: "Save updated" });
//   } catch (err) {
//     res.status(400).json({
//       status: "error",
//       message: "Error when updating a save.",
//     });
//     log.error(
//       `Error occurred on save patch by ${req.auth?.userId}. Err: ${err}`
//     );
//   }
// });

// app.delete("/id/:saveId", async (req, res) => {
//   if (isNaN(Number(req.params.saveId))) {
//     res.status(400).json({
//       status: "error",
//       message: "SaveId must be a number",
//     });
//     return;
//   }
//   const saveId = parseInt(req.params.saveId);
//   try {
//     await prisma.save.delete({
//       where: {
//         ownerId: req.auth?.userId,
//         id: saveId,
//       },
//     });
//     res.status(200).json({ status: "ok", message: "Save deleted" });
//   } catch (err) {
//     res.status(400).json({
//       status: "error",
//       message: "Error when deleting a save.",
//     });
//     log.error(
//       `Error occurred on save deletion by ${req.auth?.userId}. Err: ${err}`
//     );
//   }
// });

export default app;
