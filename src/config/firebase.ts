/**
 * Firebase Admin SDK Configuration
 * Initializes Firebase Admin SDK for Firestore access
 */

import admin from "firebase-admin";
import "dotenv/config";
import * as path from "path";
import * as fs from "fs";

const initializeFirebase = () => {
  if (admin.apps.length) return;

  try {
    let serviceAccount: admin.ServiceAccount | null = null;

    // Highest priority: FIREBASE_SERVICE_ACCOUNT JSON (same approach as backend)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log("[FIREBASE] Loading credentials from FIREBASE_SERVICE_ACCOUNT env");
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    }

    // Next: serviceAccount.json file
    if (!serviceAccount) {
      const serviceAccountPath = path.join(__dirname, "../../serviceAccount.json");
      if (fs.existsSync(serviceAccountPath)) {
        console.log("[FIREBASE] Loading credentials from serviceAccount.json");
        serviceAccount = require(serviceAccountPath);
      }
    }

    // Last resort: individual env variables
    if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      console.log("[FIREBASE] Building credentials from individual env variables");
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };
    }

    if (!serviceAccount) {
      console.error("[ERROR] Firebase credentials are missing");
      console.error("[ERROR] Provide FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY");
      throw new Error("Missing Firebase configuration");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("[FIREBASE] ✅ Admin SDK initialized successfully");
    console.log(`[FIREBASE] Project ID: ${serviceAccount.projectId}`);
  } catch (error: any) {
    console.error("[FIREBASE] ❌ Failed to initialize Admin SDK:", error.message);
    throw error;
  }
};

initializeFirebase();

/**
 * Firestore database instance
 * Use this to interact with Firestore collections
 */
export const db = admin.firestore();

/**
 * Firebase Admin instance
 * Use this for authentication, storage, etc.
 */
export default admin;

