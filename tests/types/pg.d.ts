declare module 'pg' {
  export interface ClientConfig {
    connectionString?: string;
  }
  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    end(): Promise<void>;
    query(text: string): Promise<{ rows: unknown[] }>;
  }
}