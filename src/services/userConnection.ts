import { db } from "../config/firebase";
import { OnlineUser, storedOnlineUser } from "../types";

/**
 * Firebase Firestore collection reference for rooms.
 */
const ROOMS = db.collection("rooms");
/**
 * Name of the subcollection that stores user connections within each room.
 */
const CON_COLECTION = "connections";

/**
 * Retrieves all active and past connections for a specific room.
 * Returns a list of all user connections including join and leave timestamps.
 *
 * @param {any} roomId - The ID of the room to fetch connections from
 * @returns {Promise<{connections?: Array<any>, message: string, success: boolean}>}
 *          Object containing the connections array (if found), status message, and success flag
 * @example
 * const result = await getConnectionsByRoom("room123");
 * if (result.success) {
 *   console.log(`Found ${result.connections.length} connections`);
 * }
 */
export const getConnectionsByRoom = async (roomId: any) => {
  try {
    const snap = await ROOMS.doc(roomId).collection(CON_COLECTION).get();

    const connections = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return {
      connections: connections,
      message: "conexiones encontradas",
      success: true,
    };
  } catch {
    return { message: "conexiones no encontradas", success: true };
  }
};

/**
 * Creates a new connection or refreshes an existing active connection for a user in a room.
 * If the user already has an active connection (leftAt is null), it updates the joinedAt timestamp.
 * If no active connection exists, creates a new connection record.
 *
 * @param {any} userId - The ID of the user connecting to the room
 * @param {any} roomId - The ID of the room the user is connecting to
 * @returns {Promise<{user: any, connection: any | null, success: boolean}>}
 *          Object containing the user ID, connection data, and success flag
 * @example
 * const result = await createConnection(123, "room456");
 * if (result.success) {
 *   console.log("Connection created:", result.connection);
 * }
 */
export const createConnection = async (userId: any, roomId: any) => {
  try {
    // Buscar conexión anterior
    const snap = await ROOMS.doc(String(roomId))
      .collection(CON_COLECTION)
      .where("userId", "==", Number(userId))
      .where("leftAt", "==", null)
      .get();

    if (!snap.empty) {
      // Refrescar conexión existente
      const id = snap.docs[0].id;

      const updated = {
        joinedAt: new Date().toISOString(),
        leftAt: null,
      };

      await ROOMS.doc(String(roomId))
        .collection(CON_COLECTION)
        .doc(id)
        .update(updated);

      return { user: userId, connection: updated, success: true };
    }

    // Crear nueva conexión
    const ref = ROOMS.doc(String(roomId)).collection(CON_COLECTION).doc();

    const newConn = {
      userId: Number(userId),
      joinedAt: new Date().toISOString(),
      leftAt: null,
    };

    await ref.set(newConn);

    return { user: userId, connection: newConn, success: true };
  } catch {
    return { user: userId, connection: null, success: false };
  }
};

/**
 * Marks a user's connection as ended by setting the leftAt timestamp.
 * Finds the user's active connection (where leftAt is null) and updates it with the current timestamp.
 *
 * @param {any} userId - The ID of the user leaving the room
 * @param {any} roomId - The ID of the room the user is leaving
 * @returns {Promise<{user: any, connection: any | null, success: boolean}>}
 *          Object containing the user ID, updated connection data, and success flag
 * @example
 * const result = await leftConnection(123, "room456");
 * if (result.success) {
 *   console.log("User left the room");
 * }
 */
export const leftConnection = async (userId: any, roomId: any) => {
  try {
    const snap = await ROOMS.doc(String(roomId))
      .collection(CON_COLECTION)
      .where("userId", "==", Number(userId))
      .where("leftAt", "==", null)
      .get();

    if (snap.empty) return { user: userId, connection: null, success: false };

    const docId = snap.docs[0].id;

    const updated = {
      leftAt: new Date().toISOString(),
    };

    const update = await ROOMS.doc(String(roomId))
      .collection(CON_COLECTION)
      .doc(docId)
      .update(updated);

    return { user: userId, connection: update, success: true };
  } catch {
    return { user: userId, connection: null, success: true };
  }
};

/**
 * Retrieves all connection records across all rooms using a collection group query.
 * Useful for getting a global view of all user connections in the system.
 * Each connection includes the room ID, user ID, and join/leave timestamps.
 *
 * @returns {Promise<storedOnlineUser[]>} Array of all connection records across all rooms
 * @example
 * const allConnections = await getAllConnetions();
 * console.log(`Total connections: ${allConnections.length}`);
 * allConnections.forEach(conn => {
 *   console.log(`User ${conn.userId} in room ${conn.roomId}`);
 * });
 */
export const getAllConnetions = async () => {
  try {
    const snap = await db.collectionGroup(CON_COLECTION).get();

    const allConnections = snap.docs.map((doc) => {
      const data = doc.data();
      const roomId = doc.ref.parent.parent?.id;

      return {
        roomId,
        userId: data.userId,
        joinedAt: data.joinedAt,
        leftAt: data.leftAt,
      } as storedOnlineUser;
    });

    return allConnections;
  } catch (error) {
    console.log("Error obteniendo las conexiones");
    return [];
  }
};
