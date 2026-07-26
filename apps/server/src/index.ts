import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@slack-lite/shared";
import { config } from "./config.js";
import { verifySupabaseToken } from "./middleware/auth.js";
import { registerSocketHandlers } from "./socket/handlers.js";

const app = express();
app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: config.clientOrigins,
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      return next(new Error("Unauthorized"));
    }

    const payload = await verifySupabaseToken(token);
    socket.data.userId = payload.sub;
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

httpServer.listen(config.port, () => {
  console.log(`Socket server listening on port ${config.port}`);
});
