import argon2 from "argon2";
import bodyParser from "body-parser";
import { Router } from "express";
import { basicLimiter, generateAdminToken, requireAuth } from "./auth";
import { db } from "@/db";
import { z } from "zod";
import log from "../logger";
import { user_role } from "@/generated/prisma/enums";

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));
app.use(basicLimiter);

app.get("/users", requireAuth, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(403).json({
      ok: false,
      message: "Invalid auth token",
    });
    return;
  }
  if (auth.role !== user_role.admin) {
    res.status(403).json({
      ok: false,
      message: "You are not authorized to access this route",
    });
    return;
  }
  log.info("[A] Listed all users", {
    user: auth.userId,
    sessionId: auth.sessionId,
    role: auth.role,
  });
  const users = await db.user.findMany();
  res.status(200).json(users);
});

app.post("/resetPassword/:userId", async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(403).json({
      ok: false,
      message: "Invalid auth token",
    });
    return;
  }
  if (auth.role !== user_role.admin) {
    res.status(403).json({
      ok: false,
      message: "You are not authorized to access this route",
    });
    return;
  }
  const { success: idOk, data: id } = z.coerce
    .number()
    .safeParse(req.params.userId);
  const { success: passOk, data } = z
    .object({ password: z.string() })
    .safeParse(req.body);
  if (!idOk || !passOk) {
    res.status(400).json({
      ok: false,
      message: "Invalid userId or password",
    });
    return;
  }
  const user = await db.user.findUnique({
    where: { id },
  });
  if (!user) {
    res.status(400).json({
      ok: false,
      message: "User not found",
    });
    return;
  }
  const hashed_password = await argon2.hash(
    user.id + data.password + user.createdAt.toJSON(),
  );
  await db.user.update({
    where: { id: user.id },
    data: { password: hashed_password },
  });
  log.info(`[A] Updated ${user.username}#${user.id}'s password`, {
    user: auth.userId,
    sessionId: auth.sessionId,
    role: auth.role,
  });

  res.status(200).json({
    ok: true,
    message: "Updated password",
  });
});

app.get("/token", requireAuth, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(403).json({
      ok: false,
      message: "Invalid auth token",
    });
    return;
  }
  if (auth.role !== user_role.admin) {
    res.status(403).json({
      ok: false,
      message: "You are not authorized to access this route",
    });
    return;
  }
  log.info("[A] Generated a new admin token", {
    user: auth.userId,
    sessionId: auth.sessionId,
    role: auth.role,
  });
  res.status(200).json(generateAdminToken(auth.userId));
});

export default app;
