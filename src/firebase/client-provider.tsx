'use client';
import { getFirebaseServices } from '@/firebase/config';
import { FirebaseProvider } from '@/firebase/provider';
import { Skeleton } from '@/components/ui/skeleton';
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
    // Show a loading skeleton while Firebase is initializing.
    // This ensures that descendant components are mounted and can use hooks.
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return <FirebaseProvider {...services}>{children}</FirebaseProvider>;
}
