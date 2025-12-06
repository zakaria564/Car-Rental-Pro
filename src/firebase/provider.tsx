'use client';

import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import React, { createContext, useContext } from 'react';

// Define the context shape
interface FirebaseContextType {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Create the context
const FirebaseContext = createContext<FirebaseContextType | null>(null);

// Custom hook to use the Firebase context
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

// Provider component
export function FirebaseProvider({
  children,
  ...value
}: {
  children: React.ReactNode;
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}) {
  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}
