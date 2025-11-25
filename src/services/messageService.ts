/**
 * Message Service
 * Handles message persistence and retrieval from Firestore
 * Compatible with Charlaton's room-based message structure: rooms/{roomId}/messages
 */

import { db } from "../config/firebase";
import type { StoredMessage, Message } from "../types";
import admin from "firebase-admin";

/**
 * Save a new message to Firestore
 * Messages are stored in subcollection: rooms/{roomId}/messages
 * 
 * @param message - Message data to save
 * @returns Promise with message ID
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
 * Get all messages from a specific room
 * Retrieves from: rooms/{roomId}/messages
 * 
 * @param roomId - Room ID to fetch messages from
 * @param limit - Maximum number of messages to retrieve (default: 100)
 * @returns Promise with array of messages sorted by timestamp (oldest first)
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
 * Delete a message by ID from a specific room
 * 
 * @param roomId - Room ID containing the message
 * @param messageId - Message document ID to delete
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
 * Get the count of messages in a room
 * 
 * @param roomId - Room ID to count messages from
 * @returns Promise with message count
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

