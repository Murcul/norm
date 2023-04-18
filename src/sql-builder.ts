import { lodashDifference } from './deps.ts';
import { quoteAndJoin } from './helpers.ts';

interface GetBuildUpsertSQLArg<TSchema, TValues, TMaybe> {
  schema: TSchema;
  tableName: any;
  values: TValues[];
  columnsToInsert: any[];
  conflictingColumns: any[];
  maybeColumns: TMaybe[];
  columnsToReturn: any[];
}

export class SQLBuilder {
  GetBuildUpsertSQL = <TSchema, TValues, TMaybe extends keyof TValues>(
    {
      schema,
      values,
      tableName,
      conflictingColumns,
      maybeColumns,
      columnsToReturn,
      columnsToInsert,
    }: GetBuildUpsertSQLArg<TSchema, TValues, TMaybe>,
  ): { valuesToInsert: any[]; preparedQuery: string } => {
    const { missingGroups, missingColumnsGroups } = this
      .getMaybeColumnGroupsForBulkItems(
        values,
        maybeColumns,
      );

    const { valuesToInsert, preparedCTE } = missingColumnsGroups.reduce<
      { valuesToInsert: any[]; lastIdx: number; preparedCTE: string[] }
    >((acc, col) => {
      const key = this.getMaybeGroupKey(col);

      const { lastIdx, preparedQuery, valuesToInsert } = this
        .buildUpsertStatement(
          schema,
          tableName,
          conflictingColumns,
          lodashDifference(columnsToInsert, col),
          columnsToReturn,
          acc.lastIdx,
          missingGroups[key],
        );

      acc.valuesToInsert.push(...valuesToInsert);
      acc.lastIdx = lastIdx;

      const query = `${key} as (
        ${preparedQuery}
      )`;

      acc.preparedCTE.push(query);

      return acc;
    }, { valuesToInsert: [], lastIdx: 0, preparedCTE: [] });

    const preparedQuery = `
    with ${preparedCTE}
    ${
      missingColumnsGroups.map((col) => {
        const key = this.getMaybeGroupKey(col);

        return `select * from ${key}`;
      }).join('\n union ')
    }
    `;

    return { preparedQuery, valuesToInsert };
  };

  private buildUpsertStatement(
    schema: any,
    tableName: any,
    conflictingColumns: any,
    columnsToInsert: any[],
    columnsToReturn: any[],
    startingIdx: number,
    values: any[],
  ) {
    const { lastIdx, stmts, values: valuesToInsert } = values.reduce<
      { stmts: Array<string[]>; values: any; lastIdx: number }
    >(
      (acc, value, idx) => {
        const startIdx = startingIdx + (idx * columnsToInsert.length);

        const statement = columnsToInsert.map((column, idx) => {
          const position = idx + 1 + startIdx;
          acc.values.push(value[column]);
          acc.lastIdx = position;
          return `$${position}`;
        });
        acc.stmts.push(statement);
        return acc;
      },
      { stmts: [], values: [], lastIdx: 0 },
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

    const preparedQuery = `
  insert into "${String(schema)}"."${String(tableName)}" (${
      quoteAndJoin(
        columnsToInsert,
      )
    }) 
  values 
    ${stmts.map((value) => `(${value.join(', ')})`).join(', ')}
  ${onConflictStatement}
  returning ${quoteAndJoin(columnsToReturn)}`;

    return { lastIdx, valuesToInsert, preparedQuery };
  }

  private getMaybeGroupKey(group: any[]) {
    return `${group.join('_')}_query`;
  }

  private getMaybeColumnGroupsForBulkItems<
    TValues,
    TMaybe extends keyof TValues,
  >(values: TValues[], maybeColumns: TMaybe[]) {
    const missingGroups: { [key: string]: TValues[] } = {};
    const missingColumnsGroups: { [key: string]: TMaybe[] } = {};
    const valuesOrderInGroup: [string, number][] = [];

    values.forEach((d) => {
      const group = maybeColumns.reduce<TMaybe[]>((acc, col) => {
        if (d[col] === undefined) {
          acc.push(col);
        }

        return acc;
      }, []);

      const groupName = this.getMaybeGroupKey(group);

      if (!missingGroups[groupName]) {
        missingGroups[groupName] = [];
      }

      missingColumnsGroups[groupName] = group;
      missingGroups[groupName].push(d);
      valuesOrderInGroup.push([groupName, missingGroups[groupName].length]);
    });

    const groupInfo: { [key: string]: { start: number; length: number } } = {};
    const orderedColumns: TMaybe[][] = [];

    let currentStart = 0;

    Object.entries(missingColumnsGroups).forEach(([key, col]) => {
      const itemsInGroups = missingGroups[key].length;

      orderedColumns.push(col);
      groupInfo[key] = { start: currentStart, length: itemsInGroups };

      currentStart += itemsInGroups;
    });

    const returnOrder = valuesOrderInGroup.map(([key, idx]) => {
      return groupInfo[key].start + (idx - 1);
    });

    return { missingGroups, missingColumnsGroups: orderedColumns, returnOrder };
  }
}
