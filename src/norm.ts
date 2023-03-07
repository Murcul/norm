import { quoteAndJoin } from './helpers.ts';
import { DBClient, NonEmptyArray, SchemaBase } from './types.ts';

export class Norm<DbSchema extends SchemaBase> {
  constructor(private dbClient: DBClient) {
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
    selectOn: {
      [key in keyof DbSchema[S][T]]?: Array<DbSchema[S][T][key]>;
    },
  ): Promise<Array<Pick<DbSchema[S][T], SC[number]>>> => {
    const selectOnColumns = Object.keys(selectOn) as Array<
      keyof typeof selectOn
    >;
    const selectOnValues = Object.values(selectOn).flat();

    const [_idx, whereClause] = selectOnColumns.reduce<[number, string]>(
      ([previousIndex, query], column, curentIdx) => {
        return [
          previousIndex + (selectOn[column]?.length ?? 0),
          `${query}${curentIdx > 0 ? ' OR ' : ''}"${String(column)}" in (${
            selectOn[column]?.map((_, idx) => `$${idx + previousIndex}`)
          })`,
        ];
      },
      [1, ''],
    );

    const preparedQuery = `select (${
      quoteAndJoin(
        selectColumns,
      )
    }) from "${String(schema)}"."${String(tableName)}" where ${
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
   * @returns promise that resolves to an array of inserted entity with `requiredColumns` and `maybeColumns`
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
        [updateColumn in UC[number]]: DbSchema[S][T][updateColumn];
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
      { [key in C]: Array<DbSchema[S][T][C]> }
    >((obj, key: C) => {
      if (updatedValues[key] !== undefined) {
        return {
          ...obj,
          [key]: updatedValues[key],
        };
      }
      return obj;
    }, {} as { [key in C]: Array<DbSchema[S][T][C]> });

    // Runtime check for required columns in object
    whereColumns.map((column) => {
      if (nonUndefinedValues[column] === undefined) {
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
    }" set 
 ${
      filteredColumnsToUpdate
        .map((column, idx) => `"${String(column)}" = $${idx + 1}`)
        .join(', ')
    }
where ${
      whereColumns
        .map(
          (whereColumn, idx) =>
            `"${String(whereColumn)}" = $${
              idx + 1 + filteredColumnsToUpdate.length
            }`,
        )
        .join(' and ')
    }
returning ${quoteAndJoin(columnsToReturn)};`;

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
}