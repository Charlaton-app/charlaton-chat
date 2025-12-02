/**
 * Charlaton Chat Microservice
 * Real-time chat server using Socket.IO, Firebase Admin SDK, and TypeScript
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";
import "dotenv/config";

// Import Firebase configuration
import { db } from "./config/firebase";

import {
  getRoomAccessForUser,
  createRoomAccess,
} from "./services/roomAcessService";

import { createConnection, leftConnection } from "./services/userConnection";

import { createMessage, sendMessageTo } from "./services/messageService";

import { getAdminsInRoom, existsAdmin } from "./services/roomService";

// Import types
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  JWTUser,
  SendMessagePayload,
  Message,
} from "./types";
import { Socket } from "dgram";

// ===== Initialize Express App =====
/**
 * Express application instance used to expose HTTP APIs for health checks
 * and read-only helpers (messages history, online users, etc.).
 */
const app = express();

/**
 * Node HTTP server wrapping the Express app.
 * This server is also used as the transport layer for Socket.IO.
 */
const httpServer = createServer(app);

// ===== Parse Environment Variables =====
const PORT = Number(process.env.PORT) || 4000;
const ACCESS_SECRET =
  process.env.ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  "default-secret-change-me";

/**
 * Build the list of allowed CORS origins for both Express and Socket.IO.
 *
 * Priority:
 * 1. `FRONTEND_URL` env var (single origin, usually the production frontend).
 * 2. Additional comma‑separated origins from `ORIGIN`.
 * 3. In non‑production environments, common localhost ports are always allowed.
 *
 * @returns Array of normalized origin URLs.
 */
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
      if (
        allowedOrigins.length === 0 &&
        process.env.NODE_ENV !== "production"
      ) {
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

/**
 * Socket.IO server instance responsible for all real‑time communication.
 *
 * - Auth is handled in the `io.use` middleware below.
 * - CORS configuration is shared with the Express app.
 */
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    credentials: true,
  },
});

// ===== HTTP REST Endpoints =====

/**
 * Basic health‑check endpoint for load‑balancers and uptime monitors.
 *
 * Returns a small JSON payload with service metadata and the
 * number of users currently tracked as online.
 */
app.get("/", (_req, res) => {
  res.json({
    status: "online",
    service: "Charlaton Chat Microservice",
    message: "WebSocket chat server is running",
    onlineUsers: io.engine.clientsCount,
    version: "1.0.0",
  });
});

/**
 * Lightweight liveness endpoint exposing process uptime and timestamp.
 *
 * This is intentionally small and unauthenticated so that platforms like
 * Render / Railway can use it for health probes.
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

// ===== Socket.IO Authentication Middleware =====
/**
 * Socket.IO middleware that authenticates every incoming connection.
 *
 * The client is expected to pass a JWT in `socket.handshake.auth.token`.
 * The middleware will:
 * 1. Try to verify it as a backend JWT using `ACCESS_SECRET`.
 * 2. If that fails, fall back to verifying it as a Firebase ID token.
 *
 * On success, a lightweight `JWTUser` is attached to `socket.data`.
 * On failure, the connection is rejected with an authentication error.
 */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.warn(`[AUTH] Connection attempt without token from ${socket.id}`);
      return next(new Error("Authentication token required"));
    }

    // Try to verify as backend JWT first
    try {
      const decoded = jwt.verify(token, ACCESS_SECRET) as JWTUser;

      // Store user data in socket
      socket.data.user = decoded;
      socket.data.userId = decoded.id;

      console.log(
        `[AUTH] Backend JWT verified for user ${decoded.email} (${decoded.id})`
      );
      return next();
    } catch (backendJWTError: any) {
      console.log(
        `[AUTH] Backend JWT verification failed, trying Firebase token...`
      );

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

        console.log(
          `[AUTH] Firebase token verified for user ${decodedFirebaseToken.email} (${decodedFirebaseToken.uid})`
        );
        return next();
      } catch (firebaseError: any) {
        console.error(
          `[AUTH] Both JWT and Firebase token verification failed from ${socket.id}`
        );
        console.error(`[AUTH] Backend JWT error: ${backendJWTError.message}`);
        console.error(`[AUTH] Firebase error: ${firebaseError.message}`);
        return next(new Error("Invalid authentication token"));
      }
    }
  } catch (err: any) {
    console.error(
      `[AUTH] Authentication error from ${socket.id}:`,
      err.message
    );
    return next(new Error("Authentication error"));
  }
});

/**
 * Emits the current state of users in a room to all connected clients.
 * Sends both the count of online users and detailed user information.
 *
 * @param {string} roomId - The ID of the room to emit state for
 * @returns {Promise<void>}
 */
async function emitRoomUsersState(roomId: string) {
  console.log(`[EMIT_USERS] Starting to emit room state for ${roomId}`);

  const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;
  const sockets = await io.in(roomId).fetchSockets();

  console.log(
    `[EMIT_USERS] Room ${roomId} has ${count} sockets, fetching ${sockets.length} socket details`
  );

  // Fetch complete user data from Firebase for each connected socket
  const usersPromises = sockets.map(async (s) => {
    const userId = String(s.data.userId ?? s.data.user?.id);

    if (!userId || userId === "undefined" || userId === "null") {
      console.error(
        `[EMIT_USERS] ❌ Socket ${s.id} has no valid userId. Socket data:`,
        {
          userId: s.data.userId,
          user: s.data.user,
          roomId: s.data.roomId,
        }
      );
      return null; // Return null for invalid users
    }

    console.log(`[EMIT_USERS] 🔍 Fetching Firebase data for userId: ${userId}`);

    try {
      // Get complete user data from Firebase
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        console.warn(
          `[EMIT_USERS] ⚠️ User document not found in Firebase for ${userId}`
        );
      }

      const userData = userDoc.exists ? userDoc.data() : null;

      const userInfo = {
        userId,
        email: userData?.email || s.data.user?.email,
        roomId: s.data.roomId || roomId,
        user: userData
          ? {
              id: userId,
              email: userData.email || s.data.user?.email,
              displayName:
                userData.displayName ||
                userData.nickname ||
                userData.email?.split("@")[0],
              nickname: userData.nickname,
              photoURL: userData.photoURL,
            }
          : {
              id: userId,
              email: s.data.user?.email,
              displayName: s.data.user?.email?.split("@")[0] || "Usuario",
              nickname: null,
              photoURL: null,
            },
      };

      console.log(
        `[EMIT_USERS] ✅ User data prepared for ${userId}:`,
        userInfo.user?.displayName
      );
      return userInfo;
    } catch (error) {
      console.error(
        `[EMIT_USERS] ❌ Error fetching user data for ${userId}:`,
        error
      );
      return {
        userId,
        email: s.data.user?.email,
        roomId: s.data.roomId || roomId,
        user: {
          id: userId,
          email: s.data.user?.email,
          displayName: "Usuario",
          nickname: null,
          photoURL: null,
        },
      };
    }
  });

  const allUsers = await Promise.all(usersPromises);

  // Filter out null entries (invalid users)
  const users = allUsers.filter((u) => u !== null);

  console.log(
    `[EMIT_USERS] 📤 Emitting ${users.length} valid users (filtered from ${allUsers.length} total)`
  );

  io.to(roomId).emit("number_usersOnline", users.length);
  io.to(roomId).emit("usersOnline", users);

  console.log(`[EMIT_USERS] ✅ Room state emitted for ${roomId}`);
}

// ===== Socket.IO Connection Handler =====
/**
 * Main Socket.IO connection handler.
 *
 * Responsible for:
 * - Joining/leaving rooms.
 * - Broadcasting presence updates (`usersOnline`).
 * - Persisting and broadcasting chat messages.
 * - Cleaning up in‑memory connections on disconnect.
 */
io.on("connection", (socket) => {
  console.log(`[CONNECTION] New connection: ${socket.id}`);

  const user = socket.data.user!;

  if (!user) {
    console.error("[CONNECTION] No user data found in socket, disconnecting");
    socket.disconnect(true);
    return;
  }

  // ===== JOIN ROOM EVENT =====
  /**
   * Handler for 'join_room' event.
   * Validates room access permissions and creates user connection in the room.
   * For private rooms, checks if user has been granted access.
   *
   * @event join_room
   * @param {string} roomId - The ID of the room to join
   * @emits join_room_success - When user successfully joins the room
   * @emits join_room_error - When user cannot join (invalid room, no permissions, etc.)
   */
  socket.on("join_room", async (roomId: string) => {
    try {
      console.log(
        `[ROOM] 👤 User ${user.email} (${user.id}) attempting to join room ${roomId}`
      );

      if (!roomId) {
        console.error(`[ROOM] ❌ Invalid room ID for user ${user.email}`);
        socket.emit("join_room_error", {
          success: false,
          message: "Invalid room ID",
          user: user,
        });
        return;
      }

      // Ensure userId is consistently set as string
      const userId = String(socket.data.userId || user.id);
      console.log(`[ROOM] 🔑 Using userId: ${userId}`);

      // Check if room exists
      const roomSnap = await db.collection("rooms").doc(roomId).get();

      if (!roomSnap.exists) {
        console.error(`[ROOM] ❌ Room ${roomId} does not exist`);
        socket.emit("join_room_error", {
          success: false,
          message: "Room does not exist",
          user: user,
        });
        return;
      }

      const roomData = roomSnap.data();
      const isPrivate = roomData?.isPrivate || roomData?.private || false;
      console.log(
        `[ROOM] 🔒 Room ${roomId} is ${isPrivate ? "PRIVATE" : "PUBLIC"}`
      );

      /**
       * Handles the actual joining logic for a room.
       * Creates connection, joins socket room, and emits success events.
       *
       * @returns {Promise<boolean>} True if join was successful, false otherwise
       */
      async function handleJoin() {
        // Set room data BEFORE creating connection
        socket.data.roomId = roomId;
        socket.data.userId = userId;

        console.log(`[ROOM] 🚪 Joining socket to room ${roomId}`);
        socket.join(roomId);

        // Create connection in Firestore with userId as string
        console.log(
          `[ROOM] 💾 Creating Firestore connection for userId: ${userId}`
        );
        const connectionSnap = await createConnection(userId, roomId);

        if (!connectionSnap.success) {
          console.error(`[ROOM] ❌ Failed to create connection for ${userId}`);
          socket.emit("join_room_error", {
            user: socket.data.user,
            message: "error al crear conexión",
            success: false,
          });
          return false;
        }

        console.log(`[ROOM] ✅ Connection created successfully for ${userId}`);

        // Emit success ONLY to the joining user (not to room)
        socket.emit("join_room_success", {
          user: socket.data.user,
          message: "conectado correctamente",
          success: true,
          roomId: roomId,
        });

        // Notify OTHER users in room about new join (not the joining user)
        socket.to(roomId).emit("user_joined", {
          user: {
            id: userId,
            email: socket.data.user.email,
          },
          message: `${socket.data.user.email} se unió a la reunión`,
          roomId: roomId,
        });

        console.log(`[ROOM] 📢 Emitting room state to all users in ${roomId}`);
        await emitRoomUsersState(roomId);

        return true;
      }

      // Handle public vs private room logic
      if (!isPrivate) {
        console.log(`[ROOM] 🌐 Public room - allowing join`);
        await handleJoin();
      } else {
        console.log(`[ROOM] 🔐 Private room - checking access permissions`);
        const accessSnap = await getRoomAccessForUser(userId, roomId);

        if (!accessSnap.success) {
          console.error(
            `[ROOM] ❌ User ${userId} has no access to private room ${roomId}`
          );
          socket.emit("join_room_error", {
            user: user,
            message: "usuario sin permisos para sala privada",
            success: false,
          });

          socket.disconnect(true);
          return;
        }

        console.log(`[ROOM] ✅ Access granted for private room`);
        await handleJoin();
      }
    } catch (error) {
      console.error(`[ROOM] ❌ Error in join_room for ${user.email}:`, error);
      socket.emit("join_room_error", {
        user,
        message: "Error interno del servidor",
        success: false,
      });
      socket.disconnect(true);
    }
  });

  // ===== JOINS_IN_ROOM EVENT =====
  /**
   * Handler for 'joins_in_room' event.
   * Returns a list of all user IDs currently connected to a specific room.
   *
   * @event joins_in_room
   * @param {string} roomId - The ID of the room to query
   * @emits room_users - Array of user IDs in the room
   * @emits joins_in_room_error - When the room has no users or doesn't exist
   */
  socket.on("joins_in_room", async (roomId: string) => {
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    const userId = socket.data.userId;

    if (!socketsInRoom) {
      socket.emit("joins_in_room_error", {
        success: false,
        message: `no hay usuarios en la sala ${roomId}`,
        userId: userId,
      });
      return;
    }

    const users: string[] = [];

    for (const socketId of socketsInRoom) {
      const s = io.sockets.sockets.get(socketId);
      const userId = s?.data.userId;
      if (s && userId) {
        users.push(userId);
      }
    }

    socket.emit("room_users", users);
  });

  // ===== JOINS EVENT =====
  /**
   * Handler for 'joins' event.
   * Returns a list of all users currently connected to the server across all rooms.
   *
   * @event joins
   * @emits joins_users - Array of all connected user objects
   */
  socket.on("joins", async () => {
    const users = [];

    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.user) {
        users.push(socket.data.user);
      }
    }

    socket.emit("joins_users", users);
  });

  // ===== WebRTC SIGNALS =====
  /**
   * Handler for 'webrtc_offer' event.
   * Forwards a WebRTC offer from one user to a specific target user in the same room.
   *
   * @event webrtc_offer
   * @param {Object} payload - The offer payload
   * @param {string} payload.roomId - The room ID where users are connected
   * @param {string} payload.targetUserId - The ID of the user to receive the offer
   * @param {RTCSessionDescriptionInit} payload.sdp - The WebRTC session description
   * @emits webrtc_offer - Forwards the offer to the target user with sender ID
   */
  socket.on("webrtc_offer", ({ roomId, targetUserId, sdp }) => {
    // Buscar socket del target en la sala
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;
    for (const sockId of room) {
      const s = io.sockets.sockets.get(sockId);
      if (s && s.data.userId === targetUserId) {
        s.emit("webrtc_offer", {
          senderId: socket.data.userId,
          sdp,
        });
        break;
      }
    }
  });

  /**
   * Handler for 'webrtc_answer' event.
   * Forwards a WebRTC answer from one user to a specific target user in the same room.
   *
   * @event webrtc_answer
   * @param {Object} payload - The answer payload
   * @param {string} payload.roomId - The room ID where users are connected
   * @param {string} payload.targetUserId - The ID of the user to receive the answer
   * @param {RTCSessionDescriptionInit} payload.sdp - The WebRTC session description
   * @emits webrtc_answer - Forwards the answer to the target user with sender ID
   */
  socket.on("webrtc_answer", ({ roomId, targetUserId, sdp }) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    for (const sockId of room) {
      const s = io.sockets.sockets.get(sockId);

      if (s && s.data.userId === targetUserId) {
        s.emit("webrtc_answer", {
          senderId: socket.data.userId,
          sdp,
        });
        break;
      }
    }
  });

  /**
   * Handler for 'webrtc_ice_candidate' event.
   * Forwards ICE candidates from one user to a specific target user in the same room.
   *
   * @event webrtc_ice_candidate
   * @param {Object} payload - The ICE candidate payload
   * @param {string} payload.roomId - The room ID where users are connected
   * @param {string} payload.targetUserId - The ID of the user to receive the candidate
   * @param {RTCIceCandidate} payload.candidate - The ICE candidate information
   * @emits webrtc_ice_candidate - Forwards the ICE candidate to the target user with sender ID
   */
  socket.on("webrtc_ice_candidate", ({ roomId, targetUserId, candidate }) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    for (const sockId of room) {
      const s = io.sockets.sockets.get(sockId);

      if (s && s.data.userId === targetUserId) {
        s.emit("webrtc_ice_candidate", {
          senderId: socket.data.userId,
          candidate,
        });
        break;
      }
    }
  });

  // ===== SEND MESSAGE EVENT =====
  /**
   * Handler for 'message' event.
   * Processes and broadcasts chat messages. Supports both public and private messages.
   * Validates user connection, message content, and visibility settings.
   *
   * @event message
   * @param {Object} payload - The message payload
   * @param {string} payload.msg - The message content
   * @param {('public'|'private')} payload.visibility - Message visibility type
   * @param {Array<{userId: string}>} payload.target - Array of target users for private messages
   * @emits message_success - When message is successfully sent
   * @emits new_success - Broadcasts new public message to room
   * @emits message_error - When message fails validation or sending
   */
  socket.on("message", async ({ msg, visibility, target }) => {
    if (!socket.data.userId) return;

    const userId = socket.data.userId;
    const roomId = socket.data.roomId;

    if (visibility !== "public" && visibility !== "private") {
      return socket.emit("message_error", {
        message: "visibility inválida",
        success: false,
      });
    }

    if (!msg || typeof msg !== "string") {
      return socket.emit("message_error", {
        message: "mensaje inválido",
        success: false,
      });
    }

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    if (!socket.rooms.has(roomId)) {
      return socket.emit("message_error", {
        message: "No estás en la sala",
        success: false,
      });
    }

    const connection = await db
      .collection("rooms")
      .doc(roomId)
      .collection("connections")
      .where("userId", "==", userId)
      .get();

    if (connection.empty) {
      socket.emit("message_error", {
        message: "el usuario no tiene conexión activa en la sala",
        success: false,
      });

      return;
    }

    // Get user data from Firebase for complete message info
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    const userInfo = {
      id: userId,
      email: userData?.email || socket.data.user?.email || "",
      displayName:
        userData?.displayName ||
        userData?.nickname ||
        userData?.email?.split("@")[0] ||
        // Fallback when Firestore user doc doesn't exist (e.g. OAuth‑only users)
        socket.data.user?.email?.split("@")[0] ||
        "Usuario",
      nickname: userData?.nickname || socket.data.user?.nickname || null,
    };

    console.log(
      `[MESSAGE] User ${userId} (${userInfo.displayName}) sending message`
    );

    const data = {
      userId: userId,
      roomId: roomId,
      content: msg,
      visibility: visibility,
      target: target,
    };

    const message = await createMessage(data);

    if (!message.success) {
      socket
        .to(roomId)
        .emit("message_error", { message: "error", success: false });
      return;
    }

    const messagePayload = {
      id: message.message?.id,
      content: msg,
      userId: userId,
      roomId: roomId,
      visibility: visibility,
      createdAt: new Date().toISOString(),
      user: userInfo,
      success: true,
    };

    if (visibility === "public") {
      // Send to sender with user info
      socket.emit("message_success", messagePayload);
      // Broadcast to others with user info
      socket.to(roomId).emit("new_success", messagePayload);
      console.log(`[MESSAGE] Public message broadcasted to room ${roomId}`);
    }

    if (visibility === "private") {
      for (const socketId of room) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (!clientSocket) continue;

        if (sendMessageTo(target, clientSocket.data.userId)) {
          clientSocket.emit("message_success", messagePayload);
        }
      }
      console.log(
        `[MESSAGE] Private message sent to ${target.length} recipients`
      );
    }
  });

  // ===== MEDIA STATE CHANGE EVENTS =====
  /**
   * Handler for 'media_state_changed' event.
   * Broadcasts microphone and camera state changes to all participants in the room.
   *
   * @event media_state_changed
   * @param {Object} payload - The media state payload
   * @param {boolean} payload.micEnabled - Whether microphone is enabled
   * @param {boolean} payload.cameraEnabled - Whether camera is enabled
   * @emits user_media_changed - Notifies other participants about media state changes
   */
  socket.on("media_state_changed", async ({ micEnabled, cameraEnabled }) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;

    if (!roomId || !userId) return;

    console.log(
      `[MEDIA] User ${userId} changed media state: mic=${micEnabled}, camera=${cameraEnabled}`
    );

    // Broadcast to all other users in room
    socket.to(roomId).emit("user_media_changed", {
      userId,
      micEnabled,
      cameraEnabled,
    });
  });

  // ===== SEND ACCESS EVENT ====
  /**
   * Handler for 'send_access' event.
   * Sends an access request notification to all admins in a room.
   * Used when a user wants to request access to a private room.
   *
   * @event send_access
   * @param {string} roomId - The ID of the room to request access for
   * @emits send_access - Notifies all admins about the access request
   */
  socket.on("send_access", async (roomId) => {
    if (!roomId) return;
    if (!socket.data.userId) return;

    const userId = socket.data.userId;

    const adminsId = await getAdminsInRoom(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    for (const socketId of room) {
      const clientSocket = io.sockets.sockets.get(socketId);
      if (!clientSocket) continue;

      if (adminsId.includes(clientSocket.data.userId)) {
        clientSocket.emit("send_access", {
          userId,
          roomId,
          message: "El usuario solicita acceso",
        });
      }
    }
  });

  // ===== GRANT ACCESS EVENT ====
  /**
   * Handler for 'grant_access' event.
   * Allows room admins or creators to grant access to a user requesting entry to a private room.
   * Validates that the granter is an admin or creator before creating the access permission.
   *
   * @event grant_access
   * @param {Object} payload - The access grant payload
   * @param {string} payload.roomId - The ID of the room to grant access for
   * @param {string} payload.targetUserId - The ID of the user to grant access to
   * @emits access_granted - Notifies the target user that access was granted
   * @emits grant_access_success - Confirms to the admin that access was granted
   * @emits grant_access_error - When granter lacks permissions or validation fails
   */
  socket.on("grant_access", async ({ roomId, targetUserId }) => {
    if (!roomId) return;
    if (!socket.data.userId) return;

    if (!socket.rooms.has(roomId)) {
      return socket.emit("grant_access_error", {
        success: false,
        message: "Debes estar en la sala para otorgar acceso",
      });
    }

    const adminId = socket.data.userId;

    const isAdmin = await existsAdmin(roomId, adminId);
    const roomSnap = await db.collection("rooms").doc(roomId).get();
    const creatorId = roomSnap.data()?.creatorId;

    if (!isAdmin && adminId !== creatorId) {
      return socket.emit("grant_access_error", {
        success: false,
        message: "No eres admin ni creador",
      });
    }

    await createRoomAccess(targetUserId, roomId, adminId);

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    for (const socketId of room) {
      const clientSocket = io.sockets.sockets.get(socketId);
      if (!clientSocket) continue;

      if (clientSocket.data.userId === targetUserId) {
        clientSocket.emit("access_granted", {
          // este es el evento que recibe el usuario
          roomId,
          message: "Tu acceso fue aceptado",
        });
      }
    }

    socket.emit("grant_access_success", {
      success: true,
      message: "Acceso creado",
    });
  });

  // ===== LEAVE ROOM EVENT =====
  /**
   * Handler for 'disconnect' event.
   * Cleans up user connections when they disconnect from the server.
   * Marks the connection as left in the database and notifies other users in the room.
   *
   * @event disconnect
   * @param {string} reason - The reason for disconnection
   * @emits userDisconnected - Notifies room members that a user has disconnected
   */
  socket.on("disconnect", async (reason) => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      console.log(`[DISCONNECT] Socket ${socket.id} disconnected`);

      if (userId && roomId) {
        await leftConnection(userId, roomId);
        socket.to(roomId).emit("userDisconnected", {
          success: true,
          message: `User ${user?.email} disconnected`,
          user: socket.data.user,
        });
      }

      await emitRoomUsersState(roomId);
    } catch (error: any) {
      console.error("[ROOM] Error leaving room:", error.message);
    }
  });

  // ===== DISCONNECT EVENT =====
  /**
   * Handler for 'leaveRoom' event.
   * Allows a user to explicitly leave a room without disconnecting from the server.
   * Updates the connection status and notifies other room members.
   *
   * @event leaveRoom
   * @emits userLeft - Notifies room members that a user has left the room
   * @emits disconect_error - When an error occurs during the leave process
   */
  socket.on("leaveRoom", async () => {
    try {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;

      console.log(`[ROOM] User ${userId} leaving room ${roomId}`);

      if (userId && roomId) {
        await leftConnection(userId, roomId);
        socket.to(roomId).emit("userLeft", {
          success: true,
          message: `User ${user?.email} left the room`,
          user: socket.data.user,
        });
      }

      socket.leave(roomId);

      await emitRoomUsersState(roomId);
    } catch (error: any) {
      socket.emit("disconect_error", {
        user: null,
        message: "Error interno",
        success: false,
      });
      console.error("[DISCONNECT] Error handling disconnect:", error.message);
    }
  });

  // ===== END ROOM (HOST) EVENT =====
  /**
   * Handler for 'end_room' event.
   * Broadcasts a room termination to all participants and forces them to leave.
   * Intended to be emitted by the host when finalizing the meeting.
   *
   * @event end_room
   * @emits room_ended - Notifies room members that the meeting has been ended
   */
  socket.on("end_room", async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    console.log(`[ROOM] 🔚 Ending room ${roomId} by ${socket.data.userId}`);
    // Notify all users
    io.to(roomId).emit("room_ended", {
      success: true,
      roomId,
      message: "La reunión ha sido finalizada por el anfitrión",
    });
    // Make all sockets leave the room
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      for (const socketId of room) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
          clientSocket.leave(roomId);
        }
      }
    }
    console.log(`[ROOM] ✅ Room ${roomId} ended and sockets left`);
  });
});

// ===== Start Server =====
httpServer.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log(
    `[SERVER] 🚀 Charlaton Chat Microservice running on port ${PORT}`
  );
  console.log(
    `[CORS] 🌐 Allowed origins:`,
    allowedOrigins.length > 0 ? allowedOrigins.join(", ") : "All origins (*)"
  );
  console.log(`[FIREBASE] 🔥 Admin SDK initialized`);
  console.log(`[AUTH] 🔐 JWT authentication enabled`);
  console.log("=".repeat(60));
});

/**
 * Export HTTP server instance for deployment platforms.
 * Compatible with Vercel, Railway, Render, and other Node.js hosting services.
 */
export default httpServer;
