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
      // In a Next.js development environment, throwing an error here will
      // display it in the development overlay, which is very useful for
      // debugging security rules.
      if (process.env.NODE_ENV === 'development') {
        // We throw it in a timeout to break out of the current React render cycle
        // and ensure it's caught by the global error handler.
        setTimeout(() => {
          throw error;
        }, 0);
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
