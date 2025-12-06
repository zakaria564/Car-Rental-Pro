'use client';
import { getFirebaseServices } from '@/firebase/config';
import { FirebaseProvider } from '@/firebase/provider';
import React, { useMemo } from 'react';

// This provider is responsible for initializing Firebase on the client side.
// It should be used as a wrapper around the root of your application.
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo(() => {
    if (typeof window !== 'undefined') {
      return getFirebaseServices();
    }
    return null;
  }, []);

  if (!services) {
    // You can return a loader here if you want
    return <>{children}</>;
  }

  return <FirebaseProvider {...services}>{children}</FirebaseProvider>;
}
