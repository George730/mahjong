// Server entry point — Express app with auth routes, health check, and Socket.IO

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "node:http";
import { config } from "./config.js";
import { authRouter } from "./auth/auth-router.js";
import { createSocketServer } from "./socket/index.js";

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

export { app, httpServer };
