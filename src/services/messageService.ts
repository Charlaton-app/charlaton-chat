import { db } from "../config/firebase";

/**
 * Retrieves all messages from a specific room, ordered by creation time.
 *
 * @param {any} roomId - The ID of the room to fetch messages from
 * @returns {Promise<{messages: Array<any> | null, message: string, success: boolean}>}
 *          Object containing the messages array, status message, and success flag
 * @example
 * const result = await getAllMessagesByRoom("room123");
 * if (result.success) {
 *   console.log(result.messages);
 * }
 */
export const getAllMessagesByRoom = async (roomId: any) => {
  try {
    const snap = await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .orderBy("createAt", "asc")
      .get();

    const messages = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return {
      messages: messages,
      message: "mensajes obtenidos correctamente",
      success: true,
    };
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    return {
      messages: null,
      message: "mensajes no encontrados",
      success: false,
    };
  }
};

/**
 * Retrieves all messages sent by a specific user within a room.
 *
 * @param {any} userId - The ID of the user whose messages to retrieve
 * @param {any} roomId - The ID of the room to search in
 * @returns {Promise<{messages: Array<any> | null, message: string, success: boolean}>}
 *          Object containing the user's messages array, status message, and success flag
 * @example
 * const result = await getAllMessageOfUserInRoom("user123", "room456");
 * if (result.success) {
 *   console.log(`Found ${result.messages.length} messages`);
 * }
 */
export const getAllMessageOfUserInRoom = async (userId: any, roomId: any) => {
  try {
    const snap = await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .where("userId", "==", userId)
      .get();

    const messages = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    if (messages.length === 0)
      return {
        messages: null,
        message: "mensajes no encontrados",
        success: false,
      };

    return {
      messages: messages,
      message: "mensajes obtenidos correctamente",
      success: true,
    };
  } catch (error) {
    console.error("Error al obtener mensajes del usuario:", error);
    return {
      messages: null,
      message: "mensajes no encontrados",
      success: false,
    };
  }
};

/**
 * Checks if a specific user is in the target recipients list for a private message.
 * Used to determine if a private message should be sent to a particular user.
 *
 * @param {Array<{userId: string}>} target - Array of target recipient objects
 * @param {string} userId - The ID of the user to check for
 * @returns {boolean} True if the user is in the target list, false otherwise
 * @example
 * const targets = [{userId: "user1"}, {userId: "user2"}];
 * const shouldSend = sendMessageTo(targets, "user1"); // returns true
 */
export const sendMessageTo = (target: any[], userId: string): boolean => {
  return target.some((t) => t.userId === userId);
};

/**
 * Creates and stores a new message in the database.
 * Supports both public and private messages with optional target recipients.
 *
 * @param {Object} data - The message data object
 * @param {string} data.userId - The ID of the user sending the message
 * @param {string} data.roomId - The ID of the room where the message is sent
 * @param {string} data.content - The content/text of the message
 * @param {('public'|'private')} data.visibility - The visibility type of the message
 * @param {Array<{userId: string}> | null} data.target - Array of target users for private messages
 * @returns {Promise<{user: string, message: any, success: boolean} | {userId: string, success: boolean}>}
 *          Object containing the user ID, created message document, and success flag
 * @example
 * const messageData = {
 *   userId: "user123",
 *   roomId: "room456",
 *   content: "Hello world!",
 *   visibility: "public",
 *   target: null
 * };
 * const result = await createMessage(messageData);
 */
export const createMessage = async (data: any) => {
  const { userId, roomId, content, visibility, target } = data;
  try {
    const messageRef = await db
      .collection("rooms")
      .doc(roomId)
      .collection("messages")
      .add({
        userId,
        roomId,
        content,
        visibility: visibility || "public",
        target: target || null,
        createAt: new Date(),
      });

    const message = await messageRef.get();

    return { user: userId, message: message, success: true };
  } catch (error) {
    console.error("Error al crear mensaje:", error);
    return { userId: userId, success: false };
  }
};
