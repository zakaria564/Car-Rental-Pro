'use client';

import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import React, { createContext, useContext } from 'react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// Define the context shape
interface FirebaseContextType {
  app: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

// Create the context
const FirebaseContext = createContext<FirebaseContextType>({
    app: null,
    firestore: null,
    auth: null,
});

// Custom hook to use the Firebase context
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    // This error should not be thrown if the provider is correctly set up.
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
   if (!context.app || !context.firestore || !context.auth) {
    // This can happen during the initial client-side render while Firebase is initializing.
    // We throw to signal that services are not ready. Components should handle this.
    throw new Error('Firebase services are not yet available.');
  }
  return context as { app: FirebaseApp; firestore: Firestore; auth: Auth };
}

// Provider component
export function FirebaseProvider({
  children,
  ...value
}: {
  children: React.ReactNode;
  app: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}) {
  return (
    <FirebaseContext.Provider value={value}>
        {children}
        <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}
