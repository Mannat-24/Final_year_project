import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { setIo } from "./config/socket.js";

const startServer = async () => {
  await connectDb();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: env.frontendUrl,
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 5000
  });

  setIo(io);

  io.on("connection", (socket) => {
    const { schoolId, userId, studentId } = socket.handshake.auth || socket.handshake.query;

    if (schoolId) {
      socket.join(`school:${schoolId}`);
    }
    if (studentId) {
      socket.join(`student:${studentId}`);
    }
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on("join:school", (payload) => {
      if (payload?.schoolId) {
        socket.join(`school:${payload.schoolId}`);
      }
    });

    socket.on("join:student", (payload) => {
      if (payload?.studentId) {
        socket.join(`student:${payload.studentId}`);
      }
    });

    socket.on("join:user", (payload) => {
      if (payload?.userId) {
        socket.join(`user:${payload.userId}`);
      }
    });

    socket.on("disconnect", () => {
      // No-op: rooms are cleaned up automatically.
    });
  });

  server.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});