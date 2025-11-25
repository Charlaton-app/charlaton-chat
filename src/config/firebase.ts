/**
 * Firebase Admin SDK Configuration
 * Initializes Firebase Admin SDK for Firestore access
 */

import admin from "firebase-admin";
import "dotenv/config";
import * as path from "path";
import * as fs from "fs";

/**
 * Initialize Firebase Admin SDK with service account credentials
 * Uses serviceAccount.json file for configuration
 */
const initializeFirebase = () => {
  if (!admin.apps.length) {
    try {
      // Try to load from serviceAccount.json file
      const serviceAccountPath = path.join(__dirname, "../../serviceAccount.json");
      
      if (fs.existsSync(serviceAccountPath)) {
        console.log("[FIREBASE] Loading credentials from serviceAccount.json");
        const serviceAccount = require(serviceAccountPath);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        
        console.log("[FIREBASE] ✅ Admin SDK initialized successfully");
        console.log(`[FIREBASE] Project ID: ${serviceAccount.project_id}`);
      } else {
        // Fallback to environment variables
        console.log("[FIREBASE] serviceAccount.json not found, using environment variables");
        
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
        
        if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
          console.error("[ERROR] Firebase credentials are missing");
          console.error("[ERROR] Place serviceAccount.json in project root or set env variables");
          throw new Error("Missing Firebase configuration");
        }

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: privateKey,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        });

        console.log("[FIREBASE] ✅ Admin SDK initialized successfully");
        console.log(`[FIREBASE] Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
      }
    } catch (error: any) {
      console.error("[FIREBASE] ❌ Failed to initialize Admin SDK:", error.message);
      throw error;
    }
  }
};

// Initialize Firebase on module load
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

