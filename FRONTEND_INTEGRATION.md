# Frontend Integration Guide

This guide explains how to integrate the Charlaton Chat Microservice with your frontend application.

## Installation

In your frontend project:

```bash
npm install socket.io-client
```

## Basic Setup

### 1. Create a Chat Service

Create a file `src/services/chat.service.ts` in your frontend:

```typescript
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  OnlineUser,
} from "./chat.types";

// Chat server URL (adjust based on your environment)
const CHAT_SERVER_URL = import.meta.env.VITE_CHAT_SERVER_URL || "http://localhost:4000";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/**
 * Connect to the chat server
 * @param accessToken - JWT access token from your main backend
 */
export function connectToChat(accessToken: string) {
  if (socket && socket.connected) {
    console.log("[CHAT] Already connected");
    return socket;
  }

  console.log(`[CHAT] Connecting to ${CHAT_SERVER_URL}...`);

  socket = io(CHAT_SERVER_URL, {
    auth: {
      token: accessToken,
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[CHAT] ✅ Connected to chat server");
  });

  socket.on("connect_error", (error) => {
    console.error("[CHAT] ❌ Connection error:", error.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[CHAT] ⚠️ Disconnected:", reason);
  });

  return socket;
}

/**
 * Disconnect from the chat server
 */
export function disconnectFromChat() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("[CHAT] Disconnected");
  }
}

/**
 * Join a chat room
 * @param roomId - Room ID to join
 */
export function joinRoom(roomId: string) {
  if (!socket || !socket.connected) {
    throw new Error("Not connected to chat server");
  }
  console.log(`[CHAT] Joining room: ${roomId}`);
  socket.emit("join_room", roomId);
}

/**
 * Leave a chat room
 * @param roomId - Room ID to leave
 * @param userId - Current user ID
 */
export function leaveRoom(roomId: string, userId: string) {
  if (!socket || !socket.connected) {
    throw new Error("Not connected to chat server");
  }
  console.log(`[CHAT] Leaving room: ${roomId}`);
  socket.emit("leaveRoom", { roomId, userId });
}

/**
 * Send a message to a room
 * @param roomId - Room ID
 * @param senderId - Current user ID
 * @param text - Message text
 */
export function sendMessage(roomId: string, senderId: string, text: string) {
  if (!socket || !socket.connected) {
    throw new Error("Not connected to chat server");
  }
  socket.emit("sendMessage", { roomId, senderId, text });
}

/**
 * Listen for new messages
 * @param callback - Function to call when a new message is received
 */
export function onNewMessage(callback: (message: any) => void) {
  if (!socket) return;
  socket.on("newMessage", callback);
}

/**
 * Listen for online users updates
 * @param callback - Function to call when online users list updates
 */
export function onUsersOnline(callback: (users: OnlineUser[]) => void) {
  if (!socket) return;
  socket.on("usersOnline", callback);
}

/**
 * Listen for successful room join
 * @param callback - Function to call when successfully joined a room
 */
export function onJoinRoomSuccess(callback: (response: any) => void) {
  if (!socket) return;
  socket.on("join_room_success", callback);
}

/**
 * Listen for room join errors
 * @param callback - Function to call when room join fails
 */
export function onJoinRoomError(callback: (response: any) => void) {
  if (!socket) return;
  socket.on("join_room_error", callback);
}

/**
 * Get the socket instance
 */
export function getSocket() {
  return socket;
}
```

### 2. Create Type Definitions

Create a file `src/services/chat.types.ts`:

```typescript
export interface OnlineUser {
  socketId: string;
  userId: string;
  roomId: string;
}

export interface Message {
  id?: string;
  senderId: string;
  roomId: string;
  text: string;
  createAt: number | any;
}

export interface RoomActionResponse {
  success: boolean;
  message: string;
  user?: any;
}

export interface ServerToClientEvents {
  usersOnline: (users: OnlineUser[]) => void;
  join_room_success: (response: RoomActionResponse) => void;
  join_room_error: (response: RoomActionResponse) => void;
  newMessage: (message: Message) => void;
  disconnect: (response: RoomActionResponse) => void;
}

export interface ClientToServerEvents {
  join_room: (roomId: string) => void;
  leaveRoom: (payload: { roomId: string; userId: string }) => void;
  sendMessage: (payload: { senderId: string; roomId: string; text: string }) => void;
}
```

### 3. Usage in React Component

Example implementation in a Meeting/Room component:

```typescript
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import {
  connectToChat,
  disconnectFromChat,
  joinRoom,
  leaveRoom,
  sendMessage,
  onNewMessage,
  onUsersOnline,
  onJoinRoomSuccess,
  onJoinRoomError,
} from "../services/chat.service";
import type { Message, OnlineUser } from "../services/chat.types";

export function Meeting() {
  const { user, accessToken } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [messageText, setMessageText] = useState("");
  const roomId = "your-room-id"; // Get from URL params or props

  useEffect(() => {
    // Connect to chat server
    const socket = connectToChat(accessToken);

    // Set up event listeners
    onNewMessage((message) => {
      console.log("[CHAT] New message:", message);
      setMessages((prev) => [...prev, message]);
    });

    onUsersOnline((users) => {
      console.log("[CHAT] Online users:", users);
      setOnlineUsers(users);
    });

    onJoinRoomSuccess((response) => {
      console.log("[CHAT] Join success:", response);
    });

    onJoinRoomError((response) => {
      console.error("[CHAT] Join error:", response);
    });

    // Join the room
    joinRoom(roomId);

    // Cleanup on unmount
    return () => {
      leaveRoom(roomId, user?.id || "");
      disconnectFromChat();
    };
  }, [accessToken, roomId, user]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !user?.id) return;

    sendMessage(roomId, user.id, messageText);
    setMessageText("");
  };

  return (
    <div>
      <h1>Meeting Room: {roomId}</h1>
      
      <div>
        <h2>Online Users ({onlineUsers.length})</h2>
        <ul>
          {onlineUsers.map((user) => (
            <li key={user.socketId}>{user.userId}</li>
          ))}
        </ul>
      </div>

      <div>
        <h2>Messages</h2>
        <div>
          {messages.map((msg, idx) => (
            <div key={msg.id || idx}>
              <strong>{msg.senderId}:</strong> {msg.text}
            </div>
          ))}
        </div>
      </div>

      <div>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
}
```

## Environment Variables

Add to your frontend `.env` file:

```bash
# Chat microservice URL
VITE_CHAT_SERVER_URL=http://localhost:4000

# For production
# VITE_CHAT_SERVER_URL=https://your-chat-server.render.com
```

## Important Notes

### 1. Authentication Flow

1. User logs in to your main backend
2. Main backend returns JWT access token
3. Frontend connects to chat microservice with that token
4. Chat microservice verifies token using the same `ACCESS_SECRET`

### 2. Token Management

- Store the access token in your auth state (e.g., Zustand, Context, Redux)
- If token expires, reconnect to chat after refreshing the token
- Example with token refresh:

```typescript
// In your auth service or store
export async function refreshAccessToken() {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  
  if (response.ok) {
    // Token refreshed successfully
    // Reconnect to chat if needed
    const newToken = getNewAccessToken(); // Implement based on your auth system
    disconnectFromChat();
    connectToChat(newToken);
  }
}
```

### 3. Connection Management

- Connect to chat **after** user authentication
- Disconnect when user logs out or leaves the room
- Handle reconnection on token refresh
- Handle connection errors gracefully

### 4. Message Persistence

- Messages are automatically saved to Firestore: `rooms/{roomId}/messages`
- To load previous messages, fetch them from your main backend or create a REST endpoint in the chat microservice
- Example:

```typescript
async function loadPreviousMessages(roomId: string) {
  const response = await fetch(`${CHAT_SERVER_URL}/api/messages/${roomId}?limit=100`);
  const data = await response.json();
  setMessages(data.messages);
}
```

## Testing

Use the included `socket-tester.html` file to test your chat server:

1. Open `socket-tester.html` in a browser
2. Enter your JWT token (get it from browser DevTools after logging in)
3. Connect to the server
4. Join a room
5. Send messages

## Troubleshooting

### Connection Refused

- Ensure chat server is running on correct port
- Check CORS configuration in chat server
- Verify `VITE_CHAT_SERVER_URL` is correct

### Authentication Errors

- Ensure JWT token is valid and not expired
- Verify `ACCESS_SECRET` matches between main backend and chat microservice
- Check token format in `socket.handshake.auth.token`

### Messages Not Sending

- Ensure you've joined a room before sending messages
- Check Firebase permissions
- Verify room exists in Firestore

## Next Steps

1. Implement message pagination
2. Add typing indicators
3. Add message reactions/emojis
4. Implement file/image sharing
5. Add message editing/deletion
6. Implement read receipts

For more details, see the main [README.md](./README.md).

