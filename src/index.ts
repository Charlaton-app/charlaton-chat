/**
 * Charlaton Chat Microservice
 * Real-time chat server using Socket.IO, Firebase Admin SDK, and TypeScript
 */

import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";
import "dotenv/config";

// Import Firebase configuration
import { db } from "./config/firebase";

// Import services
import { saveMessage, getRoomMessages } from "./services/messageService";
import {
  addUserConnection,
  removeUserConnection,
  getUsersInRoom,
  getAllOnlineUsers,
  getOnlineUserCount,
} from "./services/connectionService";

// Import types
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  JWTUser,
  SendMessagePayload,
  Message,
} from "./types";

// ===== Initialize Express App =====
const app = express();
const httpServer = createServer(app);

// ===== Parse Environment Variables =====
const PORT = Number(process.env.PORT) || 4000;
const ACCESS_SECRET = process.env.ACCESS_SECRET || process.env.JWT_SECRET || "default-secret-change-me";

// Parse CORS origins from environment
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Add frontend URL if provided
  if (process.env.FRONTEND_URL) {
    let frontendUrl = process.env.FRONTEND_URL.trim();
    if (frontendUrl && !frontendUrl.startsWith("http")) {
      frontendUrl = `https://${frontendUrl}`;
    }
    if (frontendUrl.endsWith("/")) {
      frontendUrl = frontendUrl.slice(0, -1);
    }
    origins.push(frontendUrl);
  }

  // Add additional origins from ORIGIN env variable (comma-separated)
  if (process.env.ORIGIN) {
    const additionalOrigins = process.env.ORIGIN.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    origins.push(...additionalOrigins);
  }

  // Always allow localhost in development
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:5173", "http://localhost:3000");
  }

  return origins;
};

const allowedOrigins = getAllowedOrigins();

// ===== Configure CORS for Express =====
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Allow all origins in development if none configured
      if (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] ⚠️ Blocked origin: ${origin}`);
        callback(new Error(`CORS: Not allowed by CORS for origin: ${origin}`));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.use(express.json());

// ===== Initialize Socket.IO =====
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(
  httpServer,
  {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
      credentials: true,
    },
  }
);

// ===== HTTP REST Endpoints =====

/**
 * Health check endpoint
 */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Charlaton Chat Microservice",
    message: "WebSocket chat server is running",
    onlineUsers: getOnlineUserCount(),
    version: "1.0.0",
  });
});

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

/**
 * Get messages from a specific room
 * Query params: limit (optional, default: 100)
 */
app.get("/api/messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: "roomId is required",
      });
    }

    const messages = await getRoomMessages(roomId, limit);

    res.json({
      success: true,
      roomId,
      count: messages.length,
      messages,
    });
  } catch (error: any) {
    console.error("[API] ❌ Error fetching messages:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * Get online users in a specific room
 */
app.get("/api/users/online/:roomId", (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: "roomId is required",
      });
    }

    const users = getUsersInRoom(roomId);
    
    res.json({
      success: true,
      roomId,
      count: users.length,
      users,
    });
  } catch (error: any) {
    console.error("[API] ❌ Error fetching online users:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch online users",
    });
  }
});

// ===== Socket.IO Authentication Middleware =====

io.use(async (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.warn(`[AUTH] ⚠️ Connection attempt without token from ${socket.id}`);
      return next(new Error("Authentication token required"));
    }

    // Try to verify as backend JWT first
    try {
      const decoded = jwt.verify(token, ACCESS_SECRET) as JWTUser;
      
      // Store user data in socket
      socket.data.user = decoded;
      socket.data.userId = decoded.id;
      
      console.log(`[AUTH] ✅ Backend JWT verified for user ${decoded.email} (${decoded.id})`);
      return next();
    } catch (backendJWTError: any) {
      console.log(`[AUTH] ⚠️ Backend JWT verification failed, trying Firebase token...`);
      
      // If backend JWT fails, try Firebase ID Token
      try {
        const admin = (await import("./config/firebase")).default;
        const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
        
        // Store user data from Firebase token
        socket.data.user = {
          id: decodedFirebaseToken.uid,
          email: decodedFirebaseToken.email || "",
        };
        socket.data.userId = decodedFirebaseToken.uid;
        
        console.log(`[AUTH] ✅ Firebase token verified for user ${decodedFirebaseToken.email} (${decodedFirebaseToken.uid})`);
        return next();
      } catch (firebaseError: any) {
        console.error(`[AUTH] ❌ Both JWT and Firebase token verification failed from ${socket.id}`);
        console.error(`[AUTH] Backend JWT error: ${backendJWTError.message}`);
        console.error(`[AUTH] Firebase error: ${firebaseError.message}`);
        return next(new Error("Invalid authentication token"));
      }
    }
  } catch (err: any) {
    console.error(`[AUTH] ❌ Authentication error from ${socket.id}:`, err.message);
    return next(new Error("Authentication error"));
  }
});

// ===== Socket.IO Connection Handler =====

io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => {
  console.log(`[CONNECTION] 🟢 New connection: ${socket.id}`);
  
  const user = socket.data.user;
  
  if (!user) {
    console.error("[CONNECTION] ❌ No user data found in socket, disconnecting");
    socket.disconnect(true);
    return;
  }

  // ===== JOIN ROOM EVENT =====
  socket.on("join_room", async (roomId: string) => {
    try {
      console.log(`[ROOM] 👤 User ${user.email} attempting to join room ${roomId}`);

      if (!roomId || roomId.trim() === "") {
        socket.emit("join_room_error", {
          success: false,
          message: "Invalid room ID",
          user,
        });
        return;
      }

      const userId = socket.data.userId || user.id;
      socket.data.roomId = roomId;

      // Join the Socket.IO room
      socket.join(roomId);

      // Track user connection
      addUserConnection(socket.id, userId, roomId);

      console.log(`[ROOM] ✅ User ${user.email} joined room ${roomId}`);

      // Notify the user
      socket.emit("join_room_success", {
        success: true,
        message: "Successfully joined room",
        user,
      });

      // Notify others in the room
      socket.to(roomId).emit("join_room_success", {
        success: true,
        message: `${user.email} joined the room`,
        user,
      });

      // Broadcast updated online users list for this room
      const roomUsers = getUsersInRoom(roomId);
      io.to(roomId).emit("usersOnline", roomUsers);
    } catch (error: any) {
      console.error("[ROOM] ❌ Error joining room:", error.message);
      socket.emit("join_room_error", {
        success: false,
        message: "Failed to join room",
        user,
      });
    }
  });

  // ===== SEND MESSAGE EVENT =====
  socket.on("sendMessage", async (payload: SendMessagePayload) => {
    try {
      const { senderId, roomId, text } = payload;

      // Validate payload
      if (!senderId || !roomId || !text || text.trim() === "") {
        console.error("[MESSAGE] ❌ Invalid message payload:", payload);
        return;
      }

      // Verify user is in the room
      const userRoomId = socket.data.roomId;
      if (userRoomId !== roomId) {
        console.warn(`[MESSAGE] ⚠️ User ${senderId} trying to send to room ${roomId} but is in ${userRoomId}`);
        return;
      }

      console.log(`[MESSAGE] 📤 From ${senderId} in room ${roomId}: "${text.substring(0, 50)}..."`);

      // Get user information from Firestore
      let userInfo: { id: string; email: string; nickname?: string; displayName?: string } | undefined;
      try {
        const userDoc = await db.collection("users").doc(senderId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userInfo = {
            id: senderId,
            email: userData?.email || "",
            nickname: userData?.nickname,
            displayName: userData?.displayName,
          };
        }
      } catch (userError) {
        console.error(`[MESSAGE] ⚠️ Error fetching user info for ${senderId}:`, userError);
      }

      // Create message object
      const message: Message = {
        senderId,
        roomId,
        text,
        createAt: Date.now(),
      };

      // Save message to Firestore
      const messageId = await saveMessage(message);

      // Broadcast message to all users in the room (including sender) with user info
      io.to(roomId).emit("newMessage", {
        ...message,
        id: messageId,
        user: userInfo, // Include user information
      });

      console.log(`[MESSAGE] ✅ Message broadcast to room ${roomId}`);
    } catch (error: any) {
      console.error("[MESSAGE] ❌ Error sending message:", error.message);
      
      // Send error notification only to sender
      socket.emit("newMessage", {
        senderId: "system",
        roomId: socket.data.roomId || "",
        text: "Error sending message. Please try again.",
        createAt: Date.now(),
      });
    }
  });

  // ===== LEAVE ROOM EVENT =====
  socket.on("leaveRoom", async (payload) => {
    try {
      const { roomId, userId } = payload;
      
      console.log(`[ROOM] 🚪 User ${userId} leaving room ${roomId}`);

      // Leave the Socket.IO room
      socket.leave(roomId);

      // Remove user connection
      const { users: updatedUsers } = removeUserConnection(socket.id);

      // Notify others in the room
      socket.to(roomId).emit("disconnect", {
        success: true,
        message: `User ${user?.email} left the room`,
        user,
      });

      // Update online users list for the room
      const roomUsers = getUsersInRoom(roomId);
      io.to(roomId).emit("usersOnline", roomUsers);

      console.log(`[ROOM] ✅ User ${userId} left room ${roomId}`);
    } catch (error: any) {
      console.error("[ROOM] ❌ Error leaving room:", error.message);
    }
  });

  // ===== DISCONNECT EVENT =====
  socket.on("disconnect", async () => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      console.log(`[DISCONNECT] 🔴 Socket ${socket.id} disconnected`);

      // Remove user connection
      const { disconnectedUser } = removeUserConnection(socket.id);

      if (disconnectedUser && roomId) {
        // Notify others in the room
        socket.to(roomId).emit("disconnect", {
          success: true,
          message: `User ${user?.email} disconnected`,
          user,
        });

        // Update online users list for the room
        const roomUsers = getUsersInRoom(roomId);
        io.to(roomId).emit("usersOnline", roomUsers);
      }
    } catch (error: any) {
      console.error("[DISCONNECT] ❌ Error handling disconnect:", error.message);
    }
  });
});

// ===== Start Server =====
httpServer.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log(`[SERVER] 🚀 Charlaton Chat Microservice running on port ${PORT}`);
  console.log(`[CORS] 🌐 Allowed origins:`, allowedOrigins.length > 0 ? allowedOrigins.join(", ") : "All origins (*)");
  console.log(`[FIREBASE] 🔥 Admin SDK initialized`);
  console.log(`[AUTH] 🔐 JWT authentication enabled`);
  console.log("=".repeat(60));
});

// Export for deployment (Vercel, Railway, Render)
export default httpServer;
