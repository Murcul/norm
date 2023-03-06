export interface DBClient {
  query: (query: string, params: unknown) => Promise<{ rows: unknown[] }>;
}
