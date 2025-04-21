import bodyParser from "body-parser";
import { Router } from "express";
import { basicLimiter, validateAuth, verifyToken } from "./auth";
import prisma from "../db";
import { user_role } from "@prisma/client";

const app: Router = Router();

app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "1mb" }));
app.use(basicLimiter);

app.get("/users", verifyToken, async (req, res) => {
  const { data: auth } = validateAuth(req.auth, "refresh");
  if (!auth) {
    res.status(403).json({
      status: "error",
      message: "Invalid auth token",
    });
    return;
  }
  if (auth.role !== user_role.admin) {
    res.status(403).json({
      status: "error",
      message: "You are not authorized to access this route",
    });
    return;
  }
  const users = await prisma.user.findMany();
  res.status(200).json(users);
});

export default app;
