import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedorigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "https://jishlink.com",
  "https://www.jishlink.com",
  "https://jishlink.onrender.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedorigins.includes(origin)) return callback(null, true);
      callback(new Error("not allowed by cors"));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Health check / root route
app.get("/", (req, res) => {
res.json({ status: "ok", service: "JISHLink API", timestamp: new Date().toISOString() });
});

export default app;
