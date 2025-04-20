import winston, { format } from "winston";
import env from "./env.js";

const f = format.combine(
  format.colorize(),
  format.timestamp(),
  format.align(),
  format.printf(
    (info) =>
      `${info.timestamp} ${info.level} [${info.user}.${info.sessionId}.${info.sessionTokenId}]: ${info.message}`
  )
);

const log = winston.createLogger({
  level: env.LOG_LEVEL,
  format: f,
  defaultMeta: { user: 0, sessionId: 0, sessionTokenId: 0, role: "" },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "log/action.log" }),
  ],
});

export default log;
