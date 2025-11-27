import { db } from "../config/firebase";
import { OnlineUser, storedOnlineUser } from "../types";

const ROOMS = db.collection("rooms");
const CON_COLECTION = "connections"

/**
 * Obtener conexiones de una sala
 */
export const getConnectionsByRoom = async (roomId: any) => {
  try {

    const snap = await ROOMS.doc(roomId).collection(CON_COLECTION).get();

    const connections = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return {connections: connections, message: "conexiones encontradas", success: true};
  } catch {
    return {message: "conexiones no encontradas", success: true};
  }
};

/**
 * Crear o refrescar conexión
 */
export const createConnection = async (userId: any , roomId: any) => {
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

      return {user: userId, connection: updated, success: true};
    }

    // Crear nueva conexión
    const ref = ROOMS.doc(String(roomId)).collection(CON_COLECTION).doc();

    const newConn = {
      userId: Number(userId),
      joinedAt: new Date().toISOString(),
      leftAt: null,
    };

    await ref.set(newConn);

    return {user: userId, connection: newConn, success: true};
  } catch {
    return {user: userId, connection: null, success: false};
  }
};

/**
 * Marcar salida de usuario
 */
export const leftConnection = async (userId: any, roomId: any) => {
  try {

    const snap = await ROOMS.doc(String(roomId))
      .collection(CON_COLECTION)
      .where("userId", "==", Number(userId))
      .where("leftAt", "==", null)
      .get();

    if (snap.empty)
      return {user: userId, connection: null, success: false};

    const docId = snap.docs[0].id;

    const updated = {
      leftAt: new Date().toISOString(),
    };

    const update = await ROOMS.doc(String(roomId))
      .collection(CON_COLECTION)
      .doc(docId)
      .update(updated);

    return {user: userId, connection: update, success: true};
  } catch {
    return {user: userId, connection: null, success: true};
  }
};


export const getAllConnetions = async () => {

    try {

        const snap = await db.collectionGroup(CON_COLECTION).get();

        const allConnections = snap.docs.map(doc => {
            const data = doc.data();
            const roomId = doc.ref.parent.parent?.id;
            
            return {
                roomId,
                userId: data.userId,
                joinedAt: data.joinedAt,
                leftAt: data.leftAt
            } as storedOnlineUser;
        });

        return allConnections;

    } catch(error) {
        console.log("Error obteniendo las conexiones");
        return []
    }

};
