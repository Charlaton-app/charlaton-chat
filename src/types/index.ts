/**
 * Shared TypeScript interfaces for the Charlaton Chat microservice.
 *
 * These types are imported by both the Socket.IO server (`index.ts`) and
 * the service layer, and they define the contract between backend and
 * frontend for all real‑time events and REST payloads.
 */

// ===== User Types =====

/**
 * Lightweight representation of a user that is currently online.
 *
 * This structure is used only for presence tracking and does not contain
 * any PII beyond the user identifier.
 */
export interface OnlineUser {
  socketId: string;
  userId: string;
  roomId: string;
}

/**
 * Minimal JWT payload shape expected after verifying either:
 * - a backend‑issued access token, or
 * - a Firebase ID token (normalized by the auth middleware).
 */
export interface JWTUser {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ===== Message Types =====

/**
 * Base message shape exchanged between client and server.
 *
 * `createAt` can be either a Firestore `Timestamp` (when loaded from
 * the database) or a numeric epoch (when coming directly from Socket.IO).
 */
export interface Message {
  senderId: string;
  roomId: string;
  text: string;
  createAt: FirebaseFirestore.Timestamp | number;
}

/**
 * Message record as stored/read from Firestore.
 *
 * The `id` field is optional because Firestore does not include it
 * inside `doc.data()`; we attach it manually where needed.
 */
export interface StoredMessage extends Message {
  id?: string;
}

// ===== Socket Event Payloads =====

/**
 * Payload emitted by the client when sending a new message via Socket.IO.
 */
export interface SendMessagePayload {
  senderId: string;
  roomId: string;
  text: string;
}

/**
 * Payload delivered by the server when broadcasting a new message.
 *
 * It extends the base `Message` type and may optionally include the
 * persisted `id` and a small user descriptor used by the UI.
 */
export interface ReceiveMessagePayload extends Message {
  id?: string;
  user?: {
    id: string;
    email: string;
    nickname?: string;
    displayName?: string;
  };
}

/**
 * Payload describing a user joining a room.
 *
 * Currently this is not used directly by Socket.IO events (we pass
 * only the `roomId`), but it is kept here to document the shape used
 * by higher‑level services and future REST endpoints.
 */
export interface JoinRoomPayload {
  roomId: string;
  userId: string;
}

/**
 * Payload describing a user leaving a room.
 */
export interface LeaveRoomPayload {
  roomId: string;
  userId: string;
}

/**
 * Generic success/error response used by room‑level events such as
 * `join_room_success`, `join_room_error`, and presence‑related events.
 */
export interface RoomActionResponse {
  success: boolean;
  message: string;
  user?: JWTUser;
}

// ===== Socket Event Maps for Type Safety =====

/**
 * Socket.IO events that the server can emit to connected clients.
 *
 * Keeping this interface in sync with the actual `io.emit`/`socket.emit`
 * calls in `index.ts` gives us end‑to‑end type safety for real‑time flows.
 */
export interface ServerToClientEvents {
  // User connection events
  usersOnline: (users: OnlineUser[]) => void;

  // Room events
  join_room_success: (response: RoomActionResponse) => void;
  join_room_error: (response: RoomActionResponse) => void;
  userLeft: (response: RoomActionResponse) => void;
  userDisconnected: (response: RoomActionResponse) => void;

  // Message events
  newMessage: (message: ReceiveMessagePayload) => void;
  receiveMessage: (message: ReceiveMessagePayload) => void;
}

/**
 * Socket.IO events that clients are allowed to emit to the server.
 */
export interface ClientToServerEvents {
  // User events
  newUser: (userId: string) => void;
  
  // Room events
  join_room: (roomId: string) => void;
  leaveRoom: (payload: LeaveRoomPayload) => void;
  
  // Message events
  sendMessage: (payload: SendMessagePayload) => void;
  
  // Disconnection
  disconnect: () => void;
}

/**
 * Per‑socket metadata stored in `socket.data` during the lifetime
 * of a connection. Populated by the authentication middleware.
 */
export interface SocketData {
  user?: JWTUser;
  userId?: string;
  roomId?: string;
}

