# Charlaton Chat Microservice 🚀

Real-time chat microservice for the Charlaton application using **Socket.IO**, **Firebase Admin SDK**, and **TypeScript**.

## Features ✨

- ✅ **Real-time messaging** with Socket.IO
- ✅ **JWT Authentication** for secure connections
- ✅ **Firebase Firestore** for message persistence
- ✅ **Room-based chat** system
- ✅ **Online user tracking** per room
- ✅ **TypeScript** for type safety
- ✅ **Express** REST API endpoints
- ✅ **CORS** configuration for secure frontend access
- ✅ **Environment variables** for flexible configuration

## Tech Stack 🛠️

- **Node.js** + **Express**
- **Socket.IO** for WebSocket connections
- **Firebase Admin SDK** for Firestore
- **JWT** (jsonwebtoken) for authentication
- **TypeScript** for type safety
- **dotenv** for environment variables
- **CORS** for cross-origin requests

## Project Structure 📁

```
charlaton-chat/
├── src/
│   ├── config/
│   │   └── firebase.ts        # Firebase Admin SDK initialization
│   ├── services/
│   │   ├── messageService.ts  # Message CRUD operations
│   │   └── connectionService.ts # Online user management
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   └── index.ts               # Main server file
├── package.json
├── tsconfig.json
├── ENV_VARIABLES.md           # Environment variables documentation
└── README.md
```

## Setup Instructions 🔧

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory. See [ENV_VARIABLES.md](./ENV_VARIABLES.md) for detailed instructions.

**Required variables:**

```bash
PORT=4000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=https://your-frontend-url.vercel.app
ORIGIN=http://localhost:5173

# JWT Secret (must match main backend)
ACCESS_SECRET=your-jwt-access-secret

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

**Important:** The `ACCESS_SECRET` must match the one used in your main Charlaton backend for JWT verification.

### 3. Run the Server

**Development mode (with hot reload):**

```bash
npm run dev
```

**Build for production:**

```bash
npm run build
npm start
```

The server will start on `http://localhost:4000` (or the PORT you specified).

## API Endpoints 🌐

### HTTP REST Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/` | Server status and info | `{ status, service, onlineUsers, version }` |
| `GET` | `/health` | Health check | `{ status: "ok", timestamp, uptime }` |
| `GET` | `/api/messages/:roomId?limit=100` | Get room messages | `{ success, roomId, count, messages }` |
| `GET` | `/api/users/online/:roomId` | Get online users in room | `{ success, roomId, count, users }` |

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `roomId: string` | Join a chat room (requires JWT auth) |
| `sendMessage` | `{ senderId, roomId, text }` | Send a message to a room |
| `leaveRoom` | `{ roomId, userId }` | Leave a room |
| `disconnect` | - | User disconnects (automatic) |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room_success` | `{ success, message, user }` | Successfully joined room |
| `join_room_error` | `{ success, message, user }` | Failed to join room |
| `usersOnline` | `OnlineUser[]` | Updated list of online users in room |
| `newMessage` | `{ id, senderId, roomId, text, createAt }` | New message in room |
| `disconnect` | `{ success, message, user }` | User disconnected from room |

## Usage Example 📝

### Frontend Integration (React + Socket.IO Client)

```typescript
import { io } from "socket.io-client";

// Get JWT token from your auth system
const token = "your-jwt-access-token";

// Connect to chat microservice
const socket = io("http://localhost:4000", {
  auth: {
    token: token, // JWT token for authentication
  },
});

// Join a room
socket.emit("join_room", "room-id-123");

// Listen for successful join
socket.on("join_room_success", (response) => {
  console.log("Joined room:", response.message);
});

// Listen for online users
socket.on("usersOnline", (users) => {
  console.log("Online users:", users);
});

// Send a message
socket.emit("sendMessage", {
  senderId: "user-id",
  roomId: "room-id-123",
  text: "Hello everyone!",
});

// Receive messages
socket.on("newMessage", (message) => {
  console.log("New message:", message);
  // { id, senderId, roomId, text, createAt }
});

// Leave room
socket.emit("leaveRoom", {
  roomId: "room-id-123",
  userId: "user-id",
});

// Disconnect
socket.disconnect();
```

### Authentication Flow

1. User logs in to your main Charlaton backend
2. Backend generates JWT access token
3. Frontend connects to chat microservice with token
4. Chat microservice verifies token using same `ACCESS_SECRET`
5. User joins rooms and sends/receives messages

## Firestore Data Structure 💾

### Messages Collection

```
rooms/{roomId}/messages/{messageId}
```

**Message document:**

```typescript
{
  senderId: string;        // User ID
  text: string;           // Message content
  createAt: Timestamp;    // Firebase timestamp
}
```

This structure is compatible with your main Charlaton backend.

## Deployment 🚀

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Create `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.ts"
    }
  ]
}
```

3. Run: `vercel`
4. Add environment variables in Vercel dashboard

### Render

1. Create a new Web Service
2. Connect your repository
3. Build Command: `npm run build`
4. Start Command: `npm start`
5. Add environment variables in Render dashboard

### Railway

1. Connect your GitHub repository
2. Add environment variables in Railway dashboard
3. Deploy automatically on push

**Important:** Set all environment variables in your deployment platform!

## Security Considerations 🔒

- ✅ JWT authentication required for all Socket.IO connections
- ✅ CORS configured for specific origins
- ✅ Environment variables for sensitive data
- ✅ Firebase Admin SDK for secure Firestore access
- ⚠️ In production, restrict CORS origins to your domains only
- ⚠️ Use HTTPS in production
- ⚠️ Implement rate limiting if needed

## Logging 📊

The server provides detailed logging:

- 🟢 **Connection events:** New connections, authentication
- 🚪 **Room events:** Join, leave
- 📤 **Messages:** Sent, received, saved to Firestore
- 👥 **Online users:** Tracking and updates
- ❌ **Errors:** Authentication, connection, message errors

## Troubleshooting 🔍

### Firebase initialization fails

- Check that all Firebase env variables are set correctly
- Ensure the private key has proper `\n` newline characters
- Verify the service account has Firestore permissions

### CORS errors

- Add your frontend URL to `FRONTEND_URL` or `ORIGIN` env variable
- In production, avoid using `*` for origins

### Authentication errors

- Ensure `ACCESS_SECRET` matches your main backend
- Verify JWT token is being sent in `socket.handshake.auth.token`
- Check token expiration

### Messages not saving

- Check Firebase console for Firestore permissions
- Verify the service account has write access to Firestore
- Ensure room exists before sending messages

## Integration with Main Backend

This microservice is designed to work alongside your main Charlaton backend:

- **Main Backend** (`Charlaton-backend`):
  - User authentication
  - Room management
  - Access control
  - User profiles
  
- **Chat Microservice** (`charlaton-chat`):
  - Real-time messaging
  - Online user tracking
  - Message persistence
  - WebSocket connections

Both services:
- Share the same Firebase project
- Use the same JWT secret for authentication
- Access the same Firestore database

## Development Tips 💡

- Use `npm run dev` for hot-reload during development
- Check logs for detailed connection and message info
- Test with the Socket.IO client in your frontend
- Use tools like [socket-tester.html](./socket-tester.html) for debugging

## License 📄

ISC

---

Built with ❤️ for Charlaton using TypeScript, Socket.IO, and Firebase
