import { db } from "../config/firebase";

const ROOMS = db.collection("rooms");

/*
Verifica si una sala tiene un admin con un especifico id
*/

export const existsAdmin = async (roomId: string, adminId: string): Promise<boolean> => {
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

  /*
  Obtiene los admins de una room
  */

  export const getAdminsInRoom = async (roomId: string) => {
    const roomSnap = await db.collection("rooms").doc(roomId).get();
    if (!roomSnap.exists) return [];
  
    const adminIds: number[] = roomSnap.data()?.adminsId || [];
  
    return [...adminIds]; 
  };

  
  
  
  