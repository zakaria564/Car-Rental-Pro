'use client';

import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from "firebase/storage";

// Cette fonction garantit que Firebase n'est initialisé qu'une seule fois.
const getFirebaseApp = (): FirebaseApp => {
  if (!getApps().length) {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    if (!firebaseConfig.apiKey) {
        console.warn("Clé API Firebase manquante. Vérifiez vos variables d'environnement.");
    }
    
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

export function getFirebaseServices() {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const storage = getStorage(app);

  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(firestore)
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn("La persistance Firestore a échoué : plusieurs onglets ouverts.");
        } else if (err.code === 'unimplemented') {
          console.warn("Le navigateur ne supporte pas la persistance Firestore.");
        }
      });
  }

  return { app, auth, firestore, storage };
}
