/**
 * Connection Service
 *
 * This module maintains an in‑memory registry of online users and the rooms
 * they are currently connected to. It is intentionally simple and stateless
 * (no persistence) because:
 *
 * - Socket.IO already handles transport‑level presence.
 * - The registry only needs to live for the lifetime of a single Node process.
 *
 * If you scale this microservice horizontally you will need to replace this
 * in‑memory store with a shared backend (e.g. Redis) so all instances have
 * a consistent view of online users.
 */

import type { OnlineUser } from "../types";

/**
 * In‑memory store for online users.
 *
 * Each record links a Socket.IO connection (`socketId`) with a logical
 * application user (`userId`) and a room (`roomId`).
 *
 * Shape: `{ socketId, userId, roomId }`
 */
let onlineUsers: OnlineUser[] = [];

/**
 * Add or update a user connection.
 *
 * If the user is already present in `onlineUsers` for the same `roomId`,
 * this function treats the call as a reconnection and simply updates
 * the `socketId` (e.g. the user refreshed the page).
 *
 * @param socketId - Active Socket.IO connection ID.
 * @param userId   - Application‑level user identifier.
 * @param roomId   - Room the user is joining.
 * @returns Updated list of all online users.
 */
export function addUserConnection(
  socketId: string,
  userId: string,
  roomId: string
): OnlineUser[] {
  // Check if user is already in this room
  const existingUserIndex = onlineUsers.findIndex(
    (user) => user.userId === userId && user.roomId === roomId
  );

  if (existingUserIndex !== -1) {
    // Update socket ID (user reconnected)
    console.log(`[CONNECTION] 🔄 User ${userId} reconnected to room ${roomId} with new socket ${socketId}`);
    onlineUsers[existingUserIndex].socketId = socketId;
  } else {
    // Add new connection
    onlineUsers.push({ socketId, userId, roomId });
    console.log(`[CONNECTION] ✅ User ${userId} connected to room ${roomId} | Total online: ${onlineUsers.length}`);
  }

  return onlineUsers;
}

/**
 * Remove a user connection by socket ID.
 *
 * Used from both the explicit `leaveRoom` handler and the low‑level
 * `disconnect` event to keep the registry in sync with Socket.IO.
 *
 * @param socketId - Socket.IO connection ID to remove.
 * @returns Object containing the updated list of users and (optionally)
 *          the user that was disconnected.
 */
export function removeUserConnection(socketId: string): {
  users: OnlineUser[];
  disconnectedUser: OnlineUser | undefined;
} {
  const disconnectedUser = onlineUsers.find((user) => user.socketId === socketId);
  
  onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
  
  if (disconnectedUser) {
    console.log(
      `[CONNECTION] ❌ User ${disconnectedUser.userId} disconnected from room ${disconnectedUser.roomId} | Remaining: ${onlineUsers.length}`
    );
  } else {
    console.log(`[CONNECTION] ⚠️ Unregistered socket ${socketId} disconnected`);
  }

  return { users: onlineUsers, disconnectedUser };
}

/**
 * Get all online users in a specific room.
 *
 * @param roomId - Room identifier to filter by.
 * @returns Array of users currently registered as online in that room.
 */
export function getUsersInRoom(roomId: string): OnlineUser[] {
  return onlineUsers.filter((user) => user.roomId === roomId);
}

/**
 * Get all online users across all rooms.
 *
 * @returns Shallow copy of the internal `onlineUsers` array.
 */
export function getAllOnlineUsers(): OnlineUser[] {
  return onlineUsers;
}

/**
 * Check whether a user is currently online in a given room.
 *
 * @param userId - User identifier to look for.
 * @param roomId - Room identifier to scope the lookup.
 * @returns `true` if a matching record exists, otherwise `false`.
 */
export function isUserInRoom(userId: string, roomId: string): boolean {
  return onlineUsers.some((user) => user.userId === userId && user.roomId === roomId);
}

/**
 * Get the total number of online user connections across all rooms.
 *
 * @returns Count of items in the `onlineUsers` registry.
 */
export function getOnlineUserCount(): number {
  return onlineUsers.length;
}

/**
 * Clear the entire in‑memory connection registry.
 *
 * Primarily useful in automated tests or when programmatically resetting
 * the service without restarting the Node process.
 *
 * @returns The now‑empty `onlineUsers` array.
 */
export function clearAllConnections(): OnlineUser[] {
  console.log("[CONNECTION] 🧹 Clearing all connections");
  onlineUsers = [];
  return onlineUsers;
}

