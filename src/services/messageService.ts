import { db } from "../config/firebase";

export const getAllMessagesByRoom = async (roomId : any) => {
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

    return {messages: messages, message: "mensajes obtenidos correctamente", success: true};
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    return {messages: null, message: "mensajes no encontrados", success: false};
  }
};

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
      return {messages: null, message: "mensajes no encontrados", success: false};

    return {messages: messages, message: "mensajes obtenidos correctamente", success: true};
  } catch (error) {
    console.error("Error al obtener mensajes del usuario:", error);
    return {messages: null, message: "mensajes no encontrados", success: false};
  }
};

export const sendMessageTo = (target: any[], userId: string): boolean => {
  return target.some(t => t.userId === userId);
};

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

    return {user: userId, message : message, success: true};
  } catch (error) {
    console.error("Error al crear mensaje:", error);
    return {userId: userId, success: false};
  }
};

