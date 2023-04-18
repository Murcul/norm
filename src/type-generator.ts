import { path, pgStructure, typeMapping } from './deps.ts';

interface IColumnType {
  nullable: boolean;
  hasDefaultValue: boolean;
  type: {
    type: string;
    validator: string;
  };
}

type InstanceReturnType<T extends keyof TypeGenerator> = ReturnType<
  InstanceType<typeof TypeGenerator>[T]
>;

interface TypeGeneratorDBConfig {
  host: string;
  database: string;
  user: string;
  password: string;
}

export class TypeGenerator {
  private db?: pgStructure.Db;
  constructor(private dbConfig: TypeGeneratorDBConfig) {
  }

  private async init() {
    const initFunction = pgStructure.default ?? pgStructure;

    this.db = await initFunction(
      this.dbConfig,
      {
        includeSystemSchemas: false,
      },
    );
  }

  buildColumnType(column: pgStructure.Column): IColumnType {
    const columnType = (column.type.internalName ??
      column.type.name) as keyof typeof typeMapping;
    const defaultType = {
      type: '"This type is missing in the generator mapping, plz fix."',
      validator: 'z.any()',
    };
    return {
      nullable: !column.notNull,
      hasDefaultValue: column.default != null,
      type: typeMapping[columnType] ?? defaultType,
    };
  }

  buildTableType(table: pgStructure.Table) {
    return table.columns.reduce<{ [key: string]: IColumnType }>(
      (pv, column) => {
        const columnType = this.buildColumnType(column);

        return {
          ...pv,
          [column.name]: columnType,
        };
      },
      {},
    );
  }

  buildSchemaType(schema: pgStructure.Schema) {
    return schema.tables.reduce<
      { [key: string]: InstanceReturnType<'buildTableType'> }
    >((pv, table) => {
      const tableType = this.buildTableType(table);

      return { ...pv, [table.name]: tableType };
    }, {});
  }

  buildDBType(db: pgStructure.Db) {
    return db.schemas.reduce<
      { [key: string]: InstanceReturnType<'buildSchemaType'> }
    >((pv, schema) => {
      const schemaType = this.buildSchemaType(schema);

      return { ...pv, [schema.name]: schemaType };
    }, {});
  }

  generateTSTypingsForColumns(columns: InstanceReturnType<'buildTableType'>) {
    return Object.entries(columns).map(([columnName, info]) => {
      let typedColumnName = columnName;
      let columnType = `${info.type.type}`;

      const isColumnOptional = info.nullable || info.hasDefaultValue;

      if (isColumnOptional) {
        typedColumnName = `${typedColumnName}?`;
      }

      if (info.nullable) {
        columnType = `${columnType} | null`;
      }

      return `${typedColumnName}: ${columnType};`;
    });
  }

  generateTSTypingsForTables(tables: InstanceReturnType<'buildSchemaType'>) {
    return Object.entries(tables).map(([tableName, columns]) => {
      return `"${tableName}": {
      ${this.generateTSTypingsForColumns(columns).join('\n')}
    }`;
    });
  }

  private generateType() {
    const dbTypings = this.buildDBType(this.db!);

    const dbSchema = Object.entries(dbTypings).map(([schema, tables]) => {
      return `"${schema}": {
      ${this.generateTSTypingsForTables(tables).join(',')}
    }`;
    });

    const typing = `
  export type DbSchema = {
    ${dbSchema}
  };
  `;

    return typing;
  }

  async generate(outputDir: string) {
    await this.init();

    if (!this.db) {
      throw new Error('DB not initilized');
    }

    const typeFile = path.join(outputDir, './norm-schema.type.ts');

    const typing = this.generateType();

    Deno.writeTextFileSync(
      typeFile,
      typing,
    );

    return typing;
  }
}
