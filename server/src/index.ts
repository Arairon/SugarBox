import express, { Express, Request, Response } from "express";
import logger from "morgan";
//import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import api from "./api.js";
import env from "./env.js";
import fs from "fs";
import path from "path";

const app: Express = express();
const port = env.PORT;

app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(express.json({ limit: "100mb" }));
app.use(
  cors({
    origin: "*",
    optionsSuccessStatus: 200,
  })
);
if (!fs.existsSync("log")) fs.mkdirSync("log");
const accessLogStream = fs.createWriteStream(path.join("log", "access.log"), {
  flags: "a",
});
app.set("trust proxy", 2);
app.use(logger("combined", { stream: accessLogStream }));
app.use(logger("dev"));
app.use(cookieParser());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello there!");
});

app.use("/api", api);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
