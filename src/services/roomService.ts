import { db } from "../config/firebase";

/**
 * Firebase Firestore collection reference for rooms.
 */
const ROOMS = db.collection("rooms");

/**
 * Verifies if a specific admin exists in a room.
 * Checks whether a user ID is listed as an admin in the room's admin list.
 * Returns false if the room doesn't exist or has been deleted.
 *
 * @param {string} roomId - The ID of the room to check
 * @param {string} adminId - The ID of the admin to verify
 * @returns {Promise<boolean>} True if the user is an admin in the room, false otherwise
 * @example
 * const isAdmin = await existsAdmin("room123", "user456");
 * if (isAdmin) {
 *   console.log("User is an admin");
 * }
 */
export const existsAdmin = async (
  roomId: string,
  adminId: string
): Promise<boolean> => {
  try {
    const roomDoc = await ROOMS.doc(roomId).get();

    // Sala no encontrada o eliminada
    if (!roomDoc.exists || roomDoc.data()?.deletedAt !== null) {
      return false;
    }

    const admins = roomDoc.data()?.adminId || [];

    // Convertir a Set para búsqueda O(1)
    const adminSet = new Set<string>(admins);

    return adminSet.has(adminId);
  } catch (error) {
    console.error("Error verificando admin:", error);
    return false;
  }
};

/**
 * Retrieves the list of admin IDs for a specific room.
 * Returns an empty array if the room doesn't exist.
 *
 * @param {string} roomId - The ID of the room to fetch admins from
 * @returns {Promise<number[]>} Array of admin user IDs (as numbers)
 * @example
 * const admins = await getAdminsInRoom("room123");
 * console.log(`Room has ${admins.length} admins`);
 */
export const getAdminsInRoom = async (roomId: string) => {
  const roomSnap = await db.collection("rooms").doc(roomId).get();
  if (!roomSnap.exists) return [];

  const adminIds: number[] = roomSnap.data()?.adminsId || [];

  return [...adminIds];
};
