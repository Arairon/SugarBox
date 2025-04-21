import { Router } from "express";
import swaggerui from "swagger-ui-express";
import prisma from "./db.js";
import { apispecs } from "./api-docs.js";
//import log from "./logger.js";
import games_api from "./api/games.js";
import chars_api from "./api/chars.js";
import saves_api from "./api/saves.js";
import sync_api from "./api/sync.js";
import user_api from "./api/user.js";
import admin_api from "./api/admin.js";
import auth_api, { verifyToken } from "./api/auth.js";

const app: Router = Router();

app.get("/", (req, res) => {
  res.send("Hello there!");
});

app.use("/docs", swaggerui.serve, swaggerui.setup(apispecs));
app.use("/auth", auth_api);

app.use(verifyToken);

app.get("/test", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: {
      id: req.auth?.userId,
    },
  });
  res.send(`Hello there! User: ${user?.username}`);
});

app.use("/games", games_api);
app.use("/chars", chars_api);
app.use("/saves", saves_api);
app.use("/sync", sync_api);
app.use("/user", user_api);
app.use("/admin", admin_api);

export default app;
