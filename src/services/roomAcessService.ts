import { db } from "../config/firebase";

/**
 * Firebase Firestore collection reference for rooms.
 */
const ROOMS = db.collection("rooms");

/**
 * Retrieves the access record for a specific user in a room.
 * Checks if the user has been granted permission to access a private room.
 *
 * @param {any} userId - The ID of the user to check access for
 * @param {any} roomId - The ID of the room to check
 * @returns {Promise<{userId: any, access?: any, success: boolean}>}
 *          Object containing the user ID, access record (if found), and success flag
 * @example
 * const result = await getRoomAccessForUser(123, "room456");
 * if (result.success) {
 *   console.log("User has access:", result.access);
 * }
 */
export const getRoomAccessForUser = async (userId: any, roomId: any) => {
  try {
    const accessSnap = await ROOMS.doc(String(roomId))
      .collection("access")
      .where("userId", "==", Number(userId))
      .get();

    if (accessSnap.empty) return { userId: userId, success: false };

    const access = accessSnap.docs.map((d) => ({ id: d.id, ...d.data() }))[0];

    return { userId: userId, access: access, success: true };
  } catch (error) {
    return { userId: userId, success: false };
  }
};

/**
 * Retrieves all access records for a specific room.
 * Returns a list of all users who have been granted access to a private room.
 *
 * @param {any} roomId - The ID of the room to fetch access records for
 * @returns {Promise<{roomId: any, message: string, success: boolean}>}
 *          Object containing the room ID, status message, and success flag
 * @example
 * const result = await getRoomAccessByRoomId("room123");
 * if (result.success) {
 *   console.log("Access records retrieved successfully");
 * }
 */
export const getRoomAccessByRoomId = async (roomId: any) => {
  try {
    const accessSnap = await ROOMS.doc(roomId).collection("access").get();

    const access = accessSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return {
      roomId: roomId,
      message: "accesos obtenidos correctamente",
      success: true,
    };
  } catch (error) {
    return {
      roomId: roomId,
      message: "error al obtener accesos",
      success: false,
    };
  }
};

/**
 * Creates a new access record for a user to join a private room.
 * Validates that the granter is an admin or the room creator before granting access.
 *
 * @param {any} userId - The ID of the user to grant access to
 * @param {any} roomId - The ID of the room to grant access for
 * @param {any} grantedBy - The ID of the admin or creator granting the access
 * @returns {Promise<{id?: string, grantedBy?: number, grantedAt?: string, roomId: any, message: string, success: boolean}>}
 *          Object containing the created access record details, status message, and success flag
 * @example
 * const result = await createRoomAccess(123, "room456", 789);
 * if (result.success) {
 *   console.log("Access granted with ID:", result.id);
 * }
 */
export const createRoomAccess = async (
  userId: any,
  roomId: any,
  grantedBy: any
) => {
  try {
    const roomRef = ROOMS.doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists || roomDoc.data()?.deletedAt !== null) {
      return { roomId: roomId, message: "Sala no encontrada", success: false }; //res.status(404).json({ error: "Sala no encontrada" });
    }

    const roomData = roomDoc.data();
    const creatorId = roomData?.creatorId;
    const adminsId = roomData?.adminsId;

    if (!adminsId.includes(grantedBy) && grantedBy !== creatorId) {
      return {
        roomId: roomId,
        message: "Solo los admins pueden dar acceso",
        success: false,
      }; //res.status(403).json({ error: "Solo los admins pueden dar acceso" });
    }

    const accessRef = ROOMS.doc(String(roomId)).collection("access").doc();

    const accessData = {
      userId: Number(userId),
      grantedBy: Number(grantedBy),
      grantedAt: new Date().toISOString(),
    };

    await accessRef.set(accessData);

    return {
      id: accessRef.id,
      ...accessData,
      message: "aceso a sala creado correctamente",
      success: true,
    };
  } catch (error) {
    return { roomId: roomId, message: "error al crear acceso", success: false };
  }
};

/**
 * Deletes an access record for a user in a room.
 * Revokes a user's permission to access a private room.
 *
 * @param {any} userId - The ID of the user whose access to revoke
 * @param {any} roomId - The ID of the room to revoke access from
 * @returns {Promise<{access: any | null, message: string, success: boolean}>}
 *          Object containing the deleted access snapshot (if found), status message, and success flag
 * @example
 * const result = await deleteRoomAccess(123, "room456");
 * if (result.success) {
 *   console.log("Access revoked successfully");
 * }
 */
export const deleteRoomAccess = async (userId: any, roomId: any) => {
  try {
    const snap = await ROOMS.doc(String(roomId))
      .collection("access")
      .where("userId", "==", Number(userId))
      .get();

    if (snap.empty)
      return {
        access: null,
        message: "error al eliminar acceso",
        success: false,
      };

    const docId = snap.docs[0].id;

    await ROOMS.doc(String(roomId)).collection("access").doc(docId).delete();

    return { access: snap, message: "acceso eliminado", success: true };
  } catch (error) {
    return {
      access: null,
      message: "error al eliminar acceso",
      success: false,
    };
  }
};
