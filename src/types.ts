import { Buffer } from './deps.ts';
export interface DBClient {
  query: (query: string, params: unknown) => Promise<{ rows: unknown[] }>;
}

export type SupportedTypes =
  | number
  | string
  | boolean
  | Date
  | object
  | null
  | undefined
  | Buffer
  | Array<number>;
export interface SchemaBase {
  //schema
  [key: string]: {
    //table
    [key: string]: {
      //column
      [key: string]: SupportedTypes;
    };
  };
}

export type ColumnMapping = { [key: string]: SupportedTypes };
export type NonEmptyArray<T> = [T, ...T[]];
