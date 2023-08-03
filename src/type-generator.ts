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

  getEnumTypeName(enumType: pgStructure.Type) {
    return enumType.fullName.split('.').join('_');
  }

  getMappedColumnType(column: pgStructure.Column) {
    const columnTypeName = (column.type.internalName ??
      column.type.name) as keyof typeof typeMapping;

    const defaultType = {
      type: '"This type is missing in the generator mapping, plz fix."',
      validator: 'z.any()',
    };

    if (typeMapping[columnTypeName]) {
      return typeMapping[columnTypeName];
    }

    switch (column.type.category) {
      case 'E':
        return {
          type: this.getEnumTypeName(column.type),
          validator: 'z.any()',
        };

      default:
        return defaultType;
    }
  }

  buildColumnType(column: pgStructure.Column): IColumnType {
    const columnType = this.getMappedColumnType(column);

    return {
      nullable: !column.notNull,
      hasDefaultValue: column.default != null,
      type: columnType,
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

  private buildEnumType(enumType: pgStructure.Type) {
    const types = (enumType as any).values.map((t: string) => `'${t}'`);

    return { name: this.getEnumTypeName(enumType), type: types };
  }

  private buildEnumTypes(db: pgStructure.Db) {
    const enumTypes = [];
    for (const t of db.types) {
      if (t.category === 'E') {
        enumTypes.push(this.buildEnumType(t));
      }
    }

    return enumTypes;
  }

  private getEnumTSTyping() {
    const enumTypes = this.buildEnumTypes(this.db!);

    return enumTypes.map((t) =>
      `export type ${t.name} = ${t.type.join(' | ')}`
    );
  }

  private generateType() {
    const dbTypings = this.buildDBType(this.db!);

    const enumTypings = this.getEnumTSTyping();

    const dbSchema = Object.entries(dbTypings).map(([schema, tables]) => {
      return `"${schema}": {
      ${this.generateTSTypingsForTables(tables).join(',')}
    }`;
    });

    const typing = `
${enumTypings.join('\n')}

  export type DbSchema = {
    ${dbSchema}
  };
  `;

    return typing.trim();
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
