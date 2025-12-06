'use client';
import { getFirebaseServices } from '@/firebase/config';
import { FirebaseProvider } from '@/firebase/provider';
import React from 'react';

// This provider is responsible for initializing Firebase on the client side.
// It should be used as a wrapper around the root of your application.
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const services = getFirebaseServices();
  return <FirebaseProvider {...services}>{children}</FirebaseProvider>;
}
