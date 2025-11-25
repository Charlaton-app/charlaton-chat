/**
 * Connection Service
 * Manages online users and their room connections
 */

import type { OnlineUser } from "../types";

/**
 * In-memory store for online users
 * Format: { socketId, userId, roomId }
 */
let onlineUsers: OnlineUser[] = [];

/**
 * Add or update a user connection
 * If user already exists with same roomId, update their socketId (reconnection)
 * 
 * @param socketId - Socket connection ID
 * @param userId - User ID
 * @param roomId - Room ID they're connected to
 * @returns Updated list of online users
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
 * Remove a user connection by socket ID
 * 
 * @param socketId - Socket connection ID to remove
 * @returns Updated list of online users
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
 * Get all online users in a specific room
 * 
 * @param roomId - Room ID to filter by
 * @returns Array of online users in the specified room
 */
export function getUsersInRoom(roomId: string): OnlineUser[] {
  return onlineUsers.filter((user) => user.roomId === roomId);
}

/**
 * Get all online users (across all rooms)
 * 
 * @returns Array of all online users
 */
export function getAllOnlineUsers(): OnlineUser[] {
  return onlineUsers;
}

/**
 * Check if a user is online in a specific room
 * 
 * @param userId - User ID to check
 * @param roomId - Room ID to check
 * @returns Boolean indicating if user is online in that room
 */
export function isUserInRoom(userId: string, roomId: string): boolean {
  return onlineUsers.some((user) => user.userId === userId && user.roomId === roomId);
}

/**
 * Get the total count of online users
 * 
 * @returns Number of online users
 */
export function getOnlineUserCount(): number {
  return onlineUsers.length;
}

/**
 * Clear all connections (for testing/restart)
 * 
 * @returns Empty array
 */
export function clearAllConnections(): OnlineUser[] {
  console.log("[CONNECTION] 🧹 Clearing all connections");
  onlineUsers = [];
  return onlineUsers;
}

