# Quick Start Guide 🚀

Get your Charlaton Chat Microservice running in 5 minutes!

## Prerequisites

- Node.js v18+ installed
- Firebase project set up
- JWT access token from your main Charlaton backend

## Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

Create a `.env` file in the root directory:

```bash
# Server
PORT=4000
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:5173
ORIGIN=http://localhost:5173

# JWT (must match your main backend)
ACCESS_SECRET=your-jwt-access-secret

# Firebase (get from Firebase Console)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**Getting Firebase credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Project Settings → Service Accounts
3. Generate New Private Key
4. Copy values from downloaded JSON

### 3. Start the Server

**Development (with hot reload):**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm start
```

Server will run on `http://localhost:4000`

### 4. Test the Connection

Open `socket-tester.html` in your browser:

1. Enter server URL: `http://localhost:4000`
2. Enter your JWT token (from main backend after login)
3. Click "Connect"
4. Enter a room ID (e.g., `test-room`)
5. Click "Join Room"
6. Send a test message

### 5. Integrate with Frontend

See [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) for complete integration guide.

**Quick example:**

```typescript
import { io } from "socket.io-client";

// Connect
const socket = io("http://localhost:4000", {
  auth: { token: "your-jwt-token" }
});

// Join room
socket.emit("join_room", "room-id");

// Send message
socket.emit("sendMessage", {
  senderId: "user-id",
  roomId: "room-id",
  text: "Hello!"
});

// Receive messages
socket.on("newMessage", (message) => {
  console.log("New message:", message);
});
```

## Verify It's Working

1. ✅ Server starts without errors
2. ✅ Visit `http://localhost:4000` → See status page
3. ✅ Visit `http://localhost:4000/health` → See `{"status":"ok"}`
4. ✅ Socket.IO tester connects successfully
5. ✅ Can join a room and send messages

## Common Issues

### Port already in use

```bash
# Find process using port 4000
lsof -i :4000

# Kill it
kill -9 <PID>

# Or use a different port in .env
PORT=4001
```

### Firebase auth error

- Check all three Firebase env variables are set
- Verify `FIREBASE_PRIVATE_KEY` has proper format with quotes and `\n`
- Ensure service account has Firestore permissions

### JWT authentication fails

- Ensure `ACCESS_SECRET` matches your main backend
- Check token format and expiration
- Verify token is sent in `socket.handshake.auth.token`

### CORS errors

- Add your frontend URL to `FRONTEND_URL` and `ORIGIN`
- Ensure URLs don't have trailing slashes
- In development, `localhost:5173` should work automatically

## Next Steps

- [ ] Read [README.md](./README.md) for full documentation
- [ ] Review [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) for frontend setup
- [ ] Check [DEPLOYMENT.md](./DEPLOYMENT.md) when ready to deploy
- [ ] See [ENV_VARIABLES.md](./ENV_VARIABLES.md) for all configuration options

## Project Structure

```
charlaton-chat/
├── src/
│   ├── config/
│   │   └── firebase.ts          # Firebase Admin SDK setup
│   ├── services/
│   │   ├── messageService.ts    # Message CRUD operations
│   │   └── connectionService.ts # Online user tracking
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   └── index.ts                # Main server (Socket.IO + Express)
├── dist/                       # Compiled JavaScript (after build)
├── socket-tester.html          # Testing tool
├── package.json
├── tsconfig.json
└── .env                        # Your environment variables
```

## Help & Support

- Check the logs in terminal for detailed error messages
- Use `socket-tester.html` for debugging connections
- Review [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) for frontend examples
- Check Firebase Console for database permissions

---

Happy coding! 🎉

