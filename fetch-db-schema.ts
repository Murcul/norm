import pgStructure from 'pg-structure';
import fs from 'fs';
import path from 'path';

const db = await pgStructure(
  {
    host: 'db.gitstart.dev',
    database: 'engine',
    user: 'postgres',
    password: 'Zs8biNPFgkcMAaoio',
  },
  {
    includeSystemSchemas: false,
  }
);

export const typeMapping = Object.freeze({
  // Integer types
  int2: { type: 'number', validator: 'z.number()' },
  int4: { type: 'number', validator: 'z.number()' },
  int8: { type: 'string', validator: 'z.string()' },
  smallint: { type: 'number', validator: 'z.number()' },
  int: { type: 'number', validator: 'z.number()' },
  bigint: { type: 'string', validator: 'z.string()' },

  // Precision types
  real: { type: 'number', validator: 'z.number()' },
  float4: { type: 'number', validator: 'z.number()' },
  float: { type: 'number', validator: 'z.number()' },
  float8: { type: 'number', validator: 'z.number()' },
  numeric: { type: 'string', validator: 'z.string()' },
  decimal: { type: 'string', validator: 'z.string()' },

  // Serial types
  smallserial: { type: 'number', validator: 'z.number()' },
  serial: { type: 'number', validator: 'z.number()' },
  bigserial: { type: 'string', validator: 'z.string()' },

  // Common string types
  uuid: { type: 'string', validator: 'z.string()' },
  text: { type: 'string', validator: 'z.string()' },
  varchar: { type: 'string', validator: 'z.string()' },
  char: { type: 'string', validator: 'z.string()' },
  bpchar: { type: 'string', validator: 'z.string()' },
  citext: { type: 'string', validator: 'z.string()' },
  name: { type: 'string', validator: 'z.string()' },

  // Bool types
  bit: { type: 'boolean', validator: 'z.boolean()' },
  bool: { type: 'boolean', validator: 'z.boolean()' },
  boolean: { type: 'boolean', validator: 'z.boolean()' },

  // Dates and times
  date: { type: 'Date', validator: 'z.date()' },
  timestamp: { type: 'Date', validator: 'z.date()' },
  timestamptz: { type: 'Date', validator: 'z.date()' },
  time: { type: 'Date', validator: 'z.date()' },
  timetz: { type: 'Date', validator: 'z.date()' },
  interval: { type: 'string', validator: 'z.string()' },

  // Network address types
  inet: { type: 'string', validator: 'z.string()' },
  cidr: { type: 'string', validator: 'z.string()' },
  macaddr: { type: 'string', validator: 'z.string()' },
  macaddr8: { type: 'string', validator: 'z.string()' },

  // Extra types
  money: { type: 'string', validator: 'z.string()' },
  tsvector: { type: 'string', validator: 'z.string()' },
  void: { type: 'undefined', validator: 'z.void()' },

  // JSON types
  json: {
    type: '{ [key: string]: unknown } | object',
    validator: 'z.object()',
  },
  jsonb: {
    type: '{ [key: string]: unknown } | object',
    validator: 'z.record(z.any())',
  },

  // Bytes
  bytea: { type: 'Buffer', validator: 'z.any()' },

  // Postgis types
  point: { type: 'Array<number>', validator: 'z.array(z.number())' },
});

const allTables = db.schemas.reduce((pv, schema) => {
  const tables = schema.tables.reduce((pv, table) => {
    const cols = table.columns.reduce((pv, column) => {
      return {
        ...pv,
        [column.name]: typeMapping[
          column.type.internalName ?? column.type.name
        ] ?? {
          type: '"This type is missing in the generator mapping, plz fix."',
          validator: 'z.any()',
        },
      };
    }, {});
    return { ...pv, [table.name]: cols };
  }, {});
  return { ...pv, [schema.name]: tables };
}, {});

const typedSchema = `
import { z } from "zod";

export type DbSchema = {
  ${Object.entries(allTables).map(
    ([schema, tables]) =>
      `"${schema}": {
      ${Object.entries(tables as any).map(
        ([tableName, columns]) =>
          `"${tableName}": {
            ${Object.entries(columns as any)
              .map(
                ([columnName, type]) => `${columnName}: ${(type as any).type};`
              )
              .join('\n')}
        }`
      )}
    }`
  )}
};
`;

/*
export const dbSchemaValidators = {
  ${Object.entries(allTables).map(
    ([schema, tables]) =>
      `"${schema}": {
      ${Object.entries(tables as any).map(
        ([tableName, columns]) =>
          `"${tableName}": z.object({
            ${Object.entries(columns as any)
              .map(
                ([columnName, type]) =>
                  `${columnName}: ${(type as any).validator},`
              )
              .join('\n')}
        }).partial()`
      )}
    }`
  )}
};
*/

fs.writeFileSync(
  path.join(__dirname, '../src/lib/entitiesSync/DbSchema.ts'),
  typedSchema
);
