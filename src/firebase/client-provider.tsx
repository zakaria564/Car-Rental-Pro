'use client';
import { getFirebaseServices } from '@/firebase/config';
import { FirebaseProvider } from '@/firebase/provider';
import React, { useEffect, useState } from 'react';

type FirebaseServices = ReturnType<typeof getFirebaseServices>;

// This provider is responsible for initializing Firebase on the client side.
// It should be used as a wrapper around the root of your application.
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<FirebaseServices | null>(null);

  useEffect(() => {
    // This code will only run on the client side
    if (typeof window !== 'undefined') {
      const firebaseServices = getFirebaseServices();
      setServices(firebaseServices);
    }
  }, []);

  if (!services) {
    // You can return a loader here if you want, while Firebase is initializing.
    // Returning children directly might cause components to try and use Firebase before it's ready.
    return <>{children}</>;
  }

  return <FirebaseProvider {...services}>{children}</FirebaseProvider>;
}
