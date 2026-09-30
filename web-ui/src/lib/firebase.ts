// ============================================================
// Firebase Configuration — SecureATM
// ============================================================
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyPlaceholderKeyReplaceWithYours",
  authDomain: "fingerprint-based-atm-1b834.firebaseapp.com",
  databaseURL:
    "https://fingerprint-based-atm-1b834-default-rtdb.firebaseio.com",
  projectId: "fingerprint-based-atm-1b834",
  storageBucket: "fingerprint-based-atm-1b834.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:placeholder",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
