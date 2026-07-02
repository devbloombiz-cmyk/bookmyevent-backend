/* eslint-disable @typescript-eslint/no-explicit-any */
import pino from "pino";
import fs from "fs";
import path from "path";
import pretty from "pino-pretty";

const isDevelopment = process.env.NODE_ENV !== "production";
const logDir = path.resolve(process.cwd(), "logs");

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Development pretty console stream
const devConsoleStream = pretty({
  colorize: true,
  translateTime: "SYS:standard",
});

// Primary application logger stream config
const mainStreams: any = [
  {
    level: "info",
    stream: isDevelopment ? devConsoleStream : process.stdout,
  },
  {
    level: "info",
    stream: fs.createWriteStream(path.join(logDir, "app.log"), { flags: "a" }),
  },
  {
    level: "error",
    stream: fs.createWriteStream(path.join(logDir, "error.log"), { flags: "a" }),
  },
];

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
  },
  pino.multistream(mainStreams),
);

// Access logger for HTTP request metrics
export const accessLogger = pino(
  {
    level: "info",
  },
  pino.multistream([
    {
      level: "info",
      stream: fs.createWriteStream(path.join(logDir, "access.log"), { flags: "a" }),
    },
    ...(isDevelopment ? [{ level: "info" as const, stream: devConsoleStream }] : []),
  ]),
);

// MongoDB logger for connection and query diagnostics
export const mongoLogger = pino(
  {
    level: "info",
  },
  pino.multistream([
    {
      level: "info",
      stream: fs.createWriteStream(path.join(logDir, "mongodb.log"), { flags: "a" }),
    },
    ...(isDevelopment ? [{ level: "info" as const, stream: devConsoleStream }] : []),
  ]),
);
