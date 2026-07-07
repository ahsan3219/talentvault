import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

/** DEMO = true when no Firebase env config → app runs fully in-memory. */
export const DEMO = !cfg.apiKey;

export const app = DEMO ? null : initializeApp(cfg);
export const auth = DEMO ? null : getAuth(app);
export const db = DEMO ? null : getFirestore(app);
export const storage = DEMO ? null : getStorage(app);
export const functions = DEMO ? null : getFunctions(app);
