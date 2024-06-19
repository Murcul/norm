import { quoteAndJoin } from './helpers.ts';
import {
  ColumnMapping,
  DBClient,
  NonEmptyArray,
  SchemaBase,
  SupportedTypes,
} from './types.ts';
import { merge } from './deps.ts';
import { SQLBuilder } from './sql-builder.ts';
import { ClauseBuilder, WhereClauseInput } from './clause-builder.ts';
export class Norm<DbSchema extends SchemaBase> {
  constructor(private dbClient: DBClient) {
  }

  private getNonUndefinedValues<
    UV extends ColumnMapping,
    NU extends ColumnMapping,
  >(updatedValues: UV) {
    return Object.keys(updatedValues).reduce<NU>((obj, key) => {
      if (updatedValues[key] !== undefined) {
        return {
          ...obj,
          [key]: updatedValues[key],
        };
      }

      return obj;
    }, {} as NU);
  }

  /**
   * Used to fetch entities from the database.
   *
   * @param schema database schema to get the entity from, usually it'll be `public`
   * @param tableName table name to get the entity from
   * @param selectColumns colums which will selected from the table for entity
   * @param selectOn an object of column array of values pairs, gets turned into column in (values, ...) OR...
   *
   * @returns promise that resolves to an array of entities as objects with keys specified by the `selectColumns` param
   */
  getEntities = async <
    S extends keyof DbSchema,
    T extends keyof DbSchema[S],
    SC extends NonEmptyArray<keyof DbSchema[S][T]>,
  >(
    schema: S,
    tableName: T,
    selectColumns: SC,
    selectOn:
      & {
        [key in keyof DbSchema[S][T]]?: Array<DbSchema[S][T][key]>;
      }
      & WhereClauseInput<
        keyof DbSchema[S][T],
        DbSchema[S][T][keyof DbSchema[S][T]]
      >,
  ): Promise<Array<Pick<DbSchema[S][T], SC[number]>>> => {
    const { clause: whereClause, values: selectOnValues } = new ClauseBuilder(
      selectOn,
    ).buildWhereClause();

    const preparedQuery = `select ${
      quoteAndJoin(
        selectColumns,
      )
    } from "${String(schema)}"."${String(tableName)}" where ${
      whereClause || true
    };`;

    const result = await this.dbClient.query(preparedQuery, selectOnValues);

    return result.rows as Array<Pick<DbSchema[S][T], SC[number]>>;
  };

  /**
   * Used to update the entity in the database.
   *
   * @param schema database schema to insert the entity into, usually it'll be `public`
   * @param tableName table name to insert the entity into
   * @param columnsToUpdate to update in the database entity
   * @param whereColumns columns used to select the entity to update
   * @param updatedValues object that must contain all the `whereColumns` and may contain `columnsToUpdate` (missing keys are skipped)
   *
   * @returns promise that resolves to an array of inserted entity
   */
  updateEntity = async <
    S extends keyof DbSchema,
    T extends keyof DbSchema[S],
    UC extends NonEmptyArray<keyof DbSchema[S][T]>,
    WC extends NonEmptyArray<keyof DbSchema[S][T]>,
  >(
    schema: S,
    tableName: T,
    columnsToUpdate: UC,
    whereColumns: WC,
    updatedValues:
      & {
        [updateColumn in UC[number]]?: DbSchema[S][T][updateColumn];
      }
      & {
        [whereColumn in WC[number]]: DbSchema[S][T][whereColumn];
      }
      & {
        [opionalKey in keyof DbSchema[S][T]]?: DbSchema[S][T][opionalKey];
      },
  ): Promise<Pick<DbSchema[S][T], UC[number] | WC[number]> | null> => {
    type C = keyof DbSchema[S][T];

    const nonUndefinedValues = (Object.keys(updatedValues) as Array<C>).reduce<
      { [key in UC[number]]?: DbSchema[S][T][key] }
    >(
      (obj, key: C) => {
        if (
          updatedValues[key] !== undefined
        ) {
          obj[key] = updatedValues[key] as DbSchema[S][T][C];
        }
        return obj;
      },
      {} as { [key in UC[number]]?: DbSchema[S][T][key] },
    );

    // Runtime check for required columns in object
    whereColumns.map((column) => {
      if (updatedValues[column] === undefined) {
        throw new Error(
          'Trying to update an entity without passing in where columns',
        );
      }
    });

    const filteredColumnsToUpdate = columnsToUpdate
      .map((
        column,
      ) => (nonUndefinedValues[column] !== undefined ? column : null))
      .filter<typeof columnsToUpdate[number]>(
        <T>(column: T | null): column is T => column !== null,
      );

    const columnsToReturn = [...columnsToUpdate, ...whereColumns];

    const valuesToUpdate = filteredColumnsToUpdate.map(
      (column) => nonUndefinedValues[column],
    );

    const valuesToFilter = whereColumns.map((column) =>
      nonUndefinedValues[column]
    );

    const preparedQuery = `update "${String(schema)}"."${
      String(tableName)
    }" set ${
      filteredColumnsToUpdate
        .map((column, idx) => `"${String(column)}" = $${idx + 1}`)
        .join(', ')
    } where ${
      whereColumns
        .map(
          (whereColumn, idx) =>
            `"${String(whereColumn)}" = $${
              idx + 1 + filteredColumnsToUpdate.length
            }`,
        )
        .join(' and ')
    } returning ${quoteAndJoin(columnsToReturn)};`;

    const result = await this.dbClient.query(preparedQuery, [
      ...valuesToUpdate,
      ...valuesToFilter,
    ]);

    return (result.rows[0] ?? null) as
      | Pick<
        DbSchema[S][T],
        UC[number] | WC[number]
      >
      | null;
  };

  /**
   * Used to bulk update the entity in the database.
   *
   * @param schema database schema to insert the entity into, usually it'll be `public`
   * @param tableName table name to insert the entity into
   * @param columnsToUpdate to update in the database entity
   * @param whereColumns columns used to select the entity to update
   * @param updatedValues array of objects that must contain all the `whereColumns` and may contain `columnsToUpdate` (missing keys are skipped)
   *
   * @returns promise that resolves to an array of updated entities
   */
  bulkUpdateEntities = async <
    S extends keyof DbSchema,
    T extends keyof DbSchema[S],
    UC extends NonEmptyArray<keyof DbSchema[S][T]>,
    WC extends NonEmptyArray<keyof DbSchema[S][T]>,
  >(
    schema: S,
    tableName: T,
    columnsToUpdate: UC,
    whereColumns: WC,
    updatedValues: NonEmptyArray<
      & {
        [updateColumn in UC[number]]: DbSchema[S][T][updateColumn];
      }
      & {
        [whereColumn in WC[number]]: DbSchema[S][T][whereColumn];
      }
      & {
        [opionalKey in keyof DbSchema[S][T]]?: DbSchema[S][T][opionalKey];
      }
    >,
  ): Promise<Array<Pick<DbSchema[S][T], UC[number] | WC[number]>> | null> => {
    type C = keyof DbSchema[S][T];

    const nonUndefinedValues = updatedValues.map((value) => {
      return this.getNonUndefinedValues<
        typeof value,
        { [key in C]: Array<DbSchema[S][T][C]> }
      >(value);
    });

    const suppliedColumns = merge({}, ...nonUndefinedValues);
    const columnsWithAtleastAValue = Object.keys(suppliedColumns);
    const filteredColumnsToUpdate = columnsWithAtleastAValue.filter((column) =>
      !whereColumns.includes(column)
    );

    const columnsToReturn = [...columnsToUpdate, ...whereColumns];
    const combinedColumns = [...filteredColumnsToUpdate, ...whereColumns];

    const valuesToInsert = nonUndefinedValues.reduce<
      { [key: string]: SupportedTypes[] }
    >((acc, value) => {
      combinedColumns.forEach((col) => {
        const column = String(col);
        if (!acc[column]) {
          acc[column] = [];
        }

        acc[column].push(value[column] ?? undefined);
      });

      return acc;
    }, {});

    const preparedValues = combinedColumns.flatMap((column) =>
      valuesToInsert[String(column)]
    );

    const filteredColumnsDataTableList = filteredColumnsToUpdate.map((column) =>
      `"${column}" = data_table."${column}"`
    );

    const stmts = nonUndefinedValues.reduce<
      Array<string[]>
    >(
      (acc, _value, idx) => {
        const startIdx = idx * combinedColumns.length;

        const statement = combinedColumns.map((_column, idx) =>
          `$${idx + 1 + startIdx}`
        );
        acc.push(statement);
        return acc;
      },
      [],
    );

    const columnsList = combinedColumns.map((
      column,
    ) => `"${String(column)}"`);
    const whereClause = whereColumns.map((column) =>
      `update_table."${String(column)}"::text = data_table."${
        String(column)
      }"::text`
    );

    const preparedQuery = `
    update "${String(schema)}"."${String(tableName)}" as update_table
    set
      ${filteredColumnsDataTableList.join(', ')}
    from (
      select *
      from unnest(${stmts.map((stmt) => `array[${stmt.join(', ')}]`)})
    ) as data_table (${columnsList.join(', ')})
    where ${whereClause.join(' and ')}
    returning ${quoteAndJoin(columnsToReturn, 'update_table')};`;

    const result = await this.dbClient.query(preparedQuery, preparedValues);

    return result.rows as
      | Array<Pick<DbSchema[S][T], UC[number] | WC[number]>>
      | null;
  };

  /**
   * Used to upsert (insert or update on conflict) the entity into the database.
   *
   * @param schema database schema to insert the entity into, usually it'll be `public`
   * @param tableName table name to insert the entity into
   * @param requiredColumns colums that need to be passed in as values of the inserted object
   * @param maybeColumns any optional columns that will be picked from the passed in object and inserted into the db
   *
   * @returns promise that resolves to an array of inserted entity with `requiredColumns` and `maybeColumns`
   */
  upsertEntity = async <
    S extends keyof DbSchema,
    T extends keyof DbSchema[S],
    RC extends NonEmptyArray<keyof DbSchema[S][T]>,
    MC extends Array<Exclude<keyof DbSchema[S][T], RC[number]>>,
  >(
    schema: S,
    tableName: T,
    requiredColumns: RC,
    maybeColumns: MC,
    conflictingColumns: NonEmptyArray<RC[number]>,
    values:
      & {
        [requiredKey in RC[number]]: DbSchema[S][T][requiredKey];
      }
      & {
        [opionalKey in keyof DbSchema[S][T]]?: DbSchema[S][T][opionalKey];
      },
  ): Promise<Pick<DbSchema[S][T], RC[number] | MC[number]> | null> => {
    type C = keyof DbSchema[S][T];

    const nonUndefinedValues = (Object.keys(values) as Array<C>).reduce<
      { [key in C]: Array<DbSchema[S][T][C]> }
    >((obj, key: C) => {
      if (values[key] !== undefined) {
        return {
          ...obj,
          [key]: values[key],
        };
      }
      return obj;
    }, {} as { [key in C]: Array<DbSchema[S][T][C]> });

    // Runtime check for required columns in object
    requiredColumns.map((column) => {
      if (nonUndefinedValues[column] === undefined) {
        throw new Error('Trying to insert entity without required property');
      }
    });

    const columnsToInsert = [
      ...requiredColumns,
      ...maybeColumns
        .map(
          (
            column,
          ) => (nonUndefinedValues[column] !== undefined ? column : null),
        )
        .filter<typeof maybeColumns[number]>(
          <T>(column: T | null): column is T => column !== null,
        ),
    ];

    const columnsToReturn = [...requiredColumns, ...maybeColumns];

    const valuesToInsert = columnsToInsert.map(
      (column) => nonUndefinedValues[column],
    );

    const onConflictStatement = conflictingColumns.length > 0
      ? `on conflict (${
        quoteAndJoin(
          conflictingColumns,
        )
      }) do update set ${
        columnsToInsert
          .filter((column) => !conflictingColumns.includes(column))
          .map((column) => `"${String(column)}" = excluded."${String(column)}"`)
          .join(', ')
      }`
      : '';

    const preparedQuery = `insert into "${String(schema)}"."${
      String(tableName)
    }" (${
      quoteAndJoin(
        columnsToInsert,
      )
    })
    values (${columnsToInsert.map((_column, idx) => `$${idx + 1}`)})
    ${onConflictStatement}
    returning ${quoteAndJoin(columnsToReturn)};`;

    const result = await this.dbClient.query(preparedQuery, valuesToInsert);

    return (result.rows[0] ?? null) as
      | Pick<
        DbSchema[S][T],
        RC[number] | MC[number]
      >
      | null;
  };

  /**
   * Used to bulk upsert (insert or update on conflict) the entity into the database.
   *
   * @param schema database schema to insert the entity into, usually it'll be `public`
   * @param tableName table name to insert the entity into
   * @param requiredColumns colums that need to be passed in as values of the inserted object
   * @param maybeColumns any optional columns that will be picked from the passed in object and inserted into the db
   * @param values array of objects that must contain all the `whereColumns` and may contain `maybeColumns` (missing keys are skipped)
   * @returns promise that resolves to an array of inserted entity with `requiredColumns` and `maybeColumns`
   */
  bulkUpsertEntity = async <
    S extends keyof DbSchema,
    T extends keyof DbSchema[S],
    RC extends NonEmptyArray<keyof DbSchema[S][T]>,
    MC extends Array<Exclude<keyof DbSchema[S][T], RC[number]>>,
  >(
    schema: S,
    tableName: T,
    requiredColumns: RC,
    maybeColumns: MC,
    conflictingColumns: NonEmptyArray<RC[number]>,
    values: NonEmptyArray<
      & {
        [requiredKey in RC[number]]: DbSchema[S][T][requiredKey];
      }
      & {
        [opionalKey in keyof DbSchema[S][T]]?: DbSchema[S][T][opionalKey];
      }
    >,
  ): Promise<Array<Pick<DbSchema[S][T], RC[number] | MC[number]>> | null> => {
    type C = keyof DbSchema[S][T];

    const nonUndefinedValues = values.map((value) => {
      return this.getNonUndefinedValues<
        typeof value,
        { [key in C]: Array<DbSchema[S][T][C]> }
      >(value);
    });
    const acceptedColumns = [...requiredColumns, ...maybeColumns];
    const suppliedColumns = merge({}, ...nonUndefinedValues);
    const columnsWithAtleastAValue = Object.keys(suppliedColumns);
    const columnsToInsert = columnsWithAtleastAValue.filter((col) =>
      acceptedColumns.includes(col)
    );

    const columnsToReturn = [...requiredColumns, ...maybeColumns];

    const sqlBuilder = new SQLBuilder();

    const { preparedQuery, valuesToInsert } = sqlBuilder.GetBuildUpsertSQL({
      schema,
      tableName,
      values,
      conflictingColumns,
      columnsToInsert,
      maybeColumns,
      columnsToReturn,
    });

    const result = await this.dbClient.query(preparedQuery, valuesToInsert);

    return result.rows as
      | Array<
        Pick<
          DbSchema[S][T],
          RC[number] | MC[number]
        >
      >
      | null;
  };
  /**
   * Used to bulk insert the entity into the database.
   *
   * @param schema database schema to insert the entity into, usually it'll be `public`
   * @param tableName table name to insert the entity into
   * @param requiredColumns colums that need to be passed in as values of the inserted object
   * @param values array of objects that must contain all the `whereColumns`
   * @returns promise that resolves to an array of inserted entities
   */
  bulkInsertEntity = async <
    S extends keyof DbSchema,
    T extends keyof DbSchema[S],
    RC extends NonEmptyArray<keyof DbSchema[S][T]>,
    MC extends Array<Exclude<keyof DbSchema[S][T], RC[number]>>,
  >(
    schema: S,
    tableName: T,
    requiredColumns: RC,
    values: NonEmptyArray<
      & {
        [requiredKey in RC[number]]: DbSchema[S][T][requiredKey];
      }
      & {
        [opionalKey in keyof DbSchema[S][T]]?: DbSchema[S][T][opionalKey];
      }
    >,
  ): Promise<Array<Pick<DbSchema[S][T], RC[number] | MC[number]>> | null> => {
    type C = keyof DbSchema[S][T];

    const nonUndefinedValues = values.map((value) => {
      return this.getNonUndefinedValues<
        typeof value,
        { [key in C]: Array<DbSchema[S][T][C]> }
      >(value);
    });
    const acceptedColumns = requiredColumns;
    const suppliedColumns = merge({}, ...nonUndefinedValues);
    const columnsWithAtleastAValue = Object.keys(suppliedColumns);
    const columnsToInsert = columnsWithAtleastAValue.filter((col) =>
      acceptedColumns.includes(col)
    );

    const columnsToReturn = requiredColumns;

    const { stmts, values: valuesToInsert } = nonUndefinedValues.reduce<
      { stmts: Array<string[]>; values: any }
    >(
      (acc, value, idx) => {
        const startIdx = idx * columnsToInsert.length;

        const statement = columnsToInsert.map((column, idx) => {
          acc.values.push(value[column]);
          return `$${idx + 1 + startIdx}`;
        });
        acc.stmts.push(statement);
        return acc;
      },
      { stmts: [], values: [] },
    );

    const preparedQuery = `
   insert into "${String(schema)}"."${String(tableName)}" (${
      quoteAndJoin(
        columnsToInsert,
      )
    })
   values
     ${stmts.map((value) => `(${value.join(', ')})`).join(', ')}
   returning ${quoteAndJoin(columnsToReturn)};`;

    const result = await this.dbClient.query(preparedQuery, valuesToInsert);

    return result.rows as
      | Array<
        Pick<
          DbSchema[S][T],
          RC[number] | MC[number]
        >
      >
      | null;
  };
}
