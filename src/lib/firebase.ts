import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import config from "../../firebase-applet-config.json";

const app = initializeApp(config);

let firebaseAuth;
try {
  firebaseAuth = initializeAuth(app, {
    persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
  });
} catch (e) {
  console.warn("[Firebase] Failed to initialize standard persistence, trying inMemoryPersistence:", e);
  try {
    firebaseAuth = initializeAuth(app, {
      persistence: inMemoryPersistence
    });
  } catch (err2) {
    console.error("[Firebase] Failed to initialize inMemoryPersistence, falling back to getAuth:", err2);
    try {
      firebaseAuth = getAuth(app);
    } catch (err3) {
      console.error("[Firebase] Fatal: getAuth failed too:", err3);
      // Mock auth object to prevent the application from crashing completely
      firebaseAuth = {
        currentUser: null,
        onAuthStateChanged: () => () => {},
        signOut: async () => {},
      } as any;
    }
  }
}

export const auth = firebaseAuth;
export const db = getFirestore(app, config.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

