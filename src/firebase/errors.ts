// A custom error class to provide more context on Firestore permission errors.
// This is useful for debugging security rules in development.

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly name = 'FirestorePermissionError';
  public readonly context: SecurityRuleContext;
  public readonly serverError?: Error;

  constructor(context: SecurityRuleContext, serverError?: Error) {
    const message = `
Firestore: Missing or insufficient permissions. The following request was denied by security rules:
${JSON.stringify({
  operation: context.operation,
  path: context.path,
  request_resource_data: context.requestResourceData,
}, null, 2)}
`;
    super(message);
    this.context = context;
    this.serverError = serverError;
    
    // This is to ensure the stack trace is captured correctly.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FirestorePermissionError);
    }
  }
}
