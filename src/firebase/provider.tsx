
'use client';

import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';
import React, { createContext, useContext } from 'react';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// New interface for company settings
interface CompanySettings {
  logoUrl?: string;
  companyName?: string;
}

// Define the context shape
interface FirebaseContextType {
  app: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
  companySettings: CompanySettings | null; // Add company settings to context
}

// Create the context
const FirebaseContext = createContext<FirebaseContextType>({
    app: null,
    firestore: null,
    auth: null,
    storage: null,
    companySettings: null, // Default value
});

// Custom hook to use the Firebase context
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
   if (!context.app || !context.firestore || !context.auth || !context.storage) {
    // This can happen during the initial client-side render while Firebase is initializing.
    // The `FirebaseClientProvider` should display a loading state, but to prevent a hard crash
    // during a potential race condition, we return the context as is.
    // Consuming components are expected to handle null services.
    return context;
  }
  return context as { app: FirebaseApp; firestore: Firestore; auth: Auth; storage: FirebaseStorage; companySettings: CompanySettings | null };
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
  storage: FirebaseStorage | null;
}) {
  const [companySettings, setCompanySettings] = React.useState<CompanySettings | null>(null);

  React.useEffect(() => {
    if (!value.firestore) return;

    const settingsRef = doc(value.firestore, 'settings', 'company');
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanySettings(docSnap.data() as CompanySettings);
      } else {
        // Provide a default if no settings are found in Firestore
        setCompanySettings({ companyName: "Location Auto Pro", logoUrl: "" });
      }
    }, (error) => {
      console.error("Failed to fetch company settings:", error);
      // Set default on error to prevent crashes
      setCompanySettings({ companyName: "Location Auto Pro", logoUrl: "" });
    });

    return () => unsubscribe();
  }, [value.firestore]);

  const providerValue = {
    ...value,
    companySettings,
  };

  return (
    <FirebaseContext.Provider value={providerValue}>
        {children}
        <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}
