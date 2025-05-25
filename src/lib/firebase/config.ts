
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Check if the essential API key is set
if (!firebaseConfig.apiKey) {
  console.warn(
    "Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is not set. " +
    "Please ensure it is defined in your .env file or environment variables. " +
    "Firebase services will not work correctly without it."
  );
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Ensure Firebase is initialized only on the client-side or if API key is present
if (typeof window !== 'undefined') { 
  if (getApps().length === 0) {
    if (firebaseConfig.apiKey) { // Only initialize if API key is present
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } else {
        console.error("Firebase initialization skipped due to missing API key.");
        // Set to late-initialized placeholders or handle error appropriately
        // For now, we'll let them be potentially undefined if no API key,
        // which will cause errors if Firebase is used, prompting the user to fix .env
    }
  } else {
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  }
} else {
    // Handle server-side if necessary, or leave uninitialized
    // For client-side focused Firebase usage (like in this Next.js app),
    // this branch might not need to initialize app, auth, db immediately.
    // If server-side Firebase operations are needed, this would require a different setup (e.g., Admin SDK).
}


export { app, auth, db };
