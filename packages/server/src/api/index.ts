import { Router } from "express";
import swaggerui from "swagger-ui-express";
import { apispecs } from "@/api-docs";
//import log from "./logger";
import games_api from "@/api/games";
import chars_api from "@/api/chars";
import saves_api from "@/api/saves";
import sync_api from "@/api/sync";
import user_api from "@/api/user";
import admin_api from "@/api/admin";
import auth_api, { auth } from "@/api/auth";
import { version } from "@/setup";

const app: Router = Router();

app.get("/", (req, res) => {
  res.send("Hello there!");
});

app.use("/docs", swaggerui.serve, swaggerui.setup(apispecs));

app.use(auth);

app.use("/auth", auth_api);

app.get("/version", (req, res) => {
  res.status(200).json(version);
});

app.use("/games", games_api);
app.use("/chars", chars_api);
app.use("/saves", saves_api);
app.use("/sync", sync_api);
app.use("/user", user_api);
app.use("/admin", admin_api);

export default app;
