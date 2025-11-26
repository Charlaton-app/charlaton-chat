/**
 * Types and interfaces for Charlaton Chat Microservice
 */

// ===== User Types =====

/**
 * User representation in online users list
 */
export interface OnlineUser {
  socketId: string;
  userId: string;
  roomId: string;
}

/**
 * JWT User payload from authentication
 */
export interface JWTUser {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ===== Message Types =====

/**
 * Message data structure for room chat
 */
export interface Message {
  senderId: string;
  roomId: string;
  text: string;
  createAt: FirebaseFirestore.Timestamp | number;
}

/**
 * Message stored in Firestore (includes ID)
 */
export interface StoredMessage extends Message {
  id?: string;
}

// ===== Socket Event Payloads =====

/**
 * Payload for sending a message
 */
export interface SendMessagePayload {
  senderId: string;
  roomId: string;
  text: string;
}

/**
 * Payload for receiving a message
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
 * Payload for joining a room
 */
export interface JoinRoomPayload {
  roomId: string;
  userId: string;
}

/**
 * Payload for leaving a room
 */
export interface LeaveRoomPayload {
  roomId: string;
  userId: string;
}

/**
 * Success/Error response for room actions
 */
export interface RoomActionResponse {
  success: boolean;
  message: string;
  user?: JWTUser;
}

// ===== Socket Event Maps for Type Safety =====

/**
 * Events that the server can send to clients
 */
export interface ServerToClientEvents {
  // User connection events
  usersOnline: (users: OnlineUser[]) => void;
  
  // Room events
  join_room_success: (response: RoomActionResponse) => void;
  join_room_error: (response: RoomActionResponse) => void;
  
  // Message events
  newMessage: (message: ReceiveMessagePayload) => void;
  receiveMessage: (message: ReceiveMessagePayload) => void;
  
  // Disconnection events
  disconnect: (response: RoomActionResponse) => void;
}

/**
 * Events that clients can send to the server
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
 * Data stored in socket.data during connection
 */
export interface SocketData {
  user?: JWTUser;
  userId?: string;
  roomId?: string;
}

