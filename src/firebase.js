// Import standard Firebase SDK modules
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPYi58bGDcFUsxvK2Cjt83BBub_SL6R-A",
  authDomain: "vem-pro-ppgi.firebaseapp.com",
  projectId: "vem-pro-ppgi",
  storageBucket: "vem-pro-ppgi.firebasestorage.app",
  messagingSenderId: "299109787761",
  appId: "1:299109787761:web:8f7058099f11f1569c53d0"
};

const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
if (useEmulators) Object.assign(firebaseConfig, {
  projectId: 'demo-vem-pro-ppgi',
  apiKey: 'demo-api-key',
  authDomain: 'demo-vem-pro-ppgi.firebaseapp.com'
});

// Initialize Firebase services
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication & Firestore Database
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export default app;
