export interface Meta {
  [key: string]: unknown;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

// Final error envelope shape (decision documented in docs/api.md):
// { "error": { "code": "...", "message": "..." } }
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

export function successEnvelope<T>(data: T, meta: Meta = {}): Envelope<T> {
  return { data, meta };
}

export function errorEnvelope(code: string, message: string): ErrorEnvelope {
  return { error: { code, message } };
}
