'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

/**
 * A client component that listens for specific application-wide events
 * and handles them. This is particularly useful for debugging things
 * like Firestore permission errors during development.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handlePermissionError = (error: Error) => {
      // In a Next.js development environment, logging the error clearly
      // is better than throwing it in a timeout which can disrupt the router.
      if (process.env.NODE_ENV === 'development') {
        console.group('🔥 Firestore Security Error');
        console.error(error.message);
        if ('context' in error) {
            console.info('Context:', (error as any).context);
        }
        console.groupEnd();
      } else {
        // In production, you might want to log this to a service
        // like Sentry, but we'll just log to console for now.
        console.error('Firestore Permission Error:', error.message);
      }
    };

    // Subscribe to the 'permission-error' event
    errorEmitter.on('permission-error', handlePermissionError);

    // Unsubscribe on component unmount
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  // This component does not render anything
  return null;
}
