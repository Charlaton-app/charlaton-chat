/**
 * Message Service
 *
 * Provides a thin abstraction over Firestore to store and retrieve chat
 * messages for Charlaton rooms. Messages are stored under:
 *
 * `rooms/{roomId}/messages/{messageId}`
 *
 * All helpers in this module are safe to call from Socket.IO handlers
 * and REST endpoints.
 */

import { db } from "../config/firebase";
import type { StoredMessage, Message } from "../types";
import admin from "firebase-admin";

/**
 * Persist a new chat message in Firestore.
 *
 * The message is stored inside the room's `messages` sub‑collection and
 * enriched with a server‑side timestamp.
 *
 * @param message - Message payload containing at least `roomId`, `senderId` and `text`.
 * @returns Promise that resolves to the generated Firestore document ID.
 */
export async function saveMessage(message: Message): Promise<string> {
  try {
    const { roomId, senderId, text } = message;

    // Validate required fields
    if (!roomId || !senderId || !text) {
      throw new Error("Missing required message fields: roomId, senderId, text");
    }

    // Create message document in room's messages subcollection
    const messageData = {
      senderId,
      text,
      createAt: admin.firestore.Timestamp.now(),
    };

    const messageRef = await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .add(messageData);

    console.log(`[MESSAGE] ✅ Message saved: ${messageRef.id} in room ${roomId}`);
    return messageRef.id;
  } catch (error: any) {
    console.error("[MESSAGE] ❌ Error saving message:", error.message);
    throw error;
  }
}

/**
 * Fetch recent messages for a given room.
 *
 * Data is loaded from the `rooms/{roomId}/messages` sub‑collection, ordered
 * by `createAt` descending, then reversed so the caller receives messages
 * in chronological order (oldest first).
 *
 * @param roomId - Room identifier to fetch messages from.
 * @param limit  - Maximum number of messages to retrieve (default: 100).
 * @returns Promise resolving to an array of `StoredMessage` objects.
 */
export async function getRoomMessages(
  roomId: string,
  limit: number = 100
): Promise<StoredMessage[]> {
  try {
    if (!roomId) {
      throw new Error("roomId is required");
    }

    const messagesRef = db
      .collection("rooms")
      .doc(roomId)
      .collection("messages");

    const snapshot = await messagesRef
      .orderBy("createAt", "desc")
      .limit(limit)
      .get();

    const messages: StoredMessage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        senderId: data.senderId,
        roomId: roomId,
        text: data.text,
        createAt: data.createAt,
      });
    });

    console.log(`[MESSAGE] 📥 Retrieved ${messages.length} messages from room ${roomId}`);
    return messages.reverse(); // Return oldest first
  } catch (error: any) {
    console.error("[MESSAGE] ❌ Error retrieving messages:", error.message);
    throw error;
  }
}

/**
 * Delete a single message from a room.
 *
 * @param roomId    - Room identifier that owns the message.
 * @param messageId - Firestore document ID of the message to delete.
 */
export async function deleteMessage(roomId: string, messageId: string): Promise<void> {
  try {
    if (!roomId || !messageId) {
      throw new Error("roomId and messageId are required");
    }

    await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .doc(messageId)
      .delete();

    console.log(`[MESSAGE] 🗑️ Message ${messageId} deleted from room ${roomId}`);
  } catch (error: any) {
    console.error("[MESSAGE] ❌ Error deleting message:", error.message);
    throw error;
  }
}

/**
 * Count how many messages exist in a given room.
 *
 * This performs a lightweight collection read and returns `snapshot.size`.
 *
 * @param roomId - Room identifier to count messages for.
 * @returns Promise resolving to the number of messages in that room.
 */
export async function getMessageCount(roomId: string): Promise<number> {
  try {
    if (!roomId) {
      throw new Error("roomId is required");
    }

    const snapshot = await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .get();

    return snapshot.size;
  } catch (error: any) {
    console.error("[MESSAGE] ❌ Error counting messages:", error.message);
    throw error;
  }
}

