import { assertEquals, assertThrows, describe, it } from './dev_deps.ts';

import { ClauseBuilder, ClauseBuilderOptions } from './clause-builder.ts';

const builderOptions: ClauseBuilderOptions = {
  fallbackConjunction: 'AND',
  preparedIndex: 1,
};

describe('ClauseBuilder', () => {
  it(
    'should return where clause when using array variant of _or with multiple fields',
    () => {
      const whereClause = new ClauseBuilder({
        _or: [{ fieldOne: 'value_one', fieldTwo: 10 }, {
          fieldThree: 'value_two',
          fieldFour: 20,
        }],
      }, builderOptions).buildWhereClause();

      assertEquals(whereClause.clause, [
        '("fieldOne" = $1 AND "fieldTwo" = $2) OR ("fieldThree" = $3 AND "fieldFour" = $4)',
      ]);
      assertEquals(
        whereClause.clauseStr,
        '("fieldOne" = $1 AND "fieldTwo" = $2) OR ("fieldThree" = $3 AND "fieldFour" = $4)',
      );
      assertEquals(whereClause.nextPreparedIndex, 5);
      assertEquals(whereClause.values, ['value_one', 10, 'value_two', 20]);
    },
  );

  it(
    'should return where clause when using map variant of _or with multiple fields',
    () => {
      const whereClause = new ClauseBuilder({
        _or: { fieldOne: ['value_one', 'value_two'], fieldTwo: [100, 50, 70] },
      }, builderOptions).buildWhereClause();

      assertEquals(whereClause.clause, [
        '"fieldOne" IN ($1, $2) OR "fieldTwo" IN ($3, $4, $5)',
      ]);
      assertEquals(
        whereClause.clauseStr,
        '"fieldOne" IN ($1, $2) OR "fieldTwo" IN ($3, $4, $5)',
      );
      assertEquals(whereClause.nextPreparedIndex, 6);
      assertEquals(whereClause.values, ['value_one', 'value_two', 100, 50, 70]);
    },
  );

  it(
    'should return where clause when using array variant of _and with multiple fields',
    () => {
      const whereClause = new ClauseBuilder({
        _and: [{ fieldOne: 'value_one', fieldTwo: 10 }, {
          fieldThree: 'value_two',
          fieldFour: 20,
        }],
      }, builderOptions).buildWhereClause();

      assertEquals(whereClause.clause, [
        '("fieldOne" = $1 OR "fieldTwo" = $2) AND ("fieldThree" = $3 OR "fieldFour" = $4)',
      ]);
      assertEquals(
        whereClause.clauseStr,
        '("fieldOne" = $1 OR "fieldTwo" = $2) AND ("fieldThree" = $3 OR "fieldFour" = $4)',
      );
      assertEquals(whereClause.nextPreparedIndex, 5);
      assertEquals(whereClause.values, ['value_one', 10, 'value_two', 20]);
    },
  );

  it(
    'should return where clause when using map variant of _and with multiple fields',
    () => {
      const whereClause = new ClauseBuilder({
        _and: { fieldOne: ['value_one', 'value_two'], fieldTwo: [100, 50, 70] },
      }, builderOptions).buildWhereClause();

      assertEquals(whereClause.clause, [
        '"fieldOne" IN ($1, $2) AND "fieldTwo" IN ($3, $4, $5)',
      ]);
      assertEquals(
        whereClause.clauseStr,
        '"fieldOne" IN ($1, $2) AND "fieldTwo" IN ($3, $4, $5)',
      );
      assertEquals(whereClause.nextPreparedIndex, 6);
      assertEquals(whereClause.values, ['value_one', 'value_two', 100, 50, 70]);
    },
  );

  it(
    'should return where clause with combination of _and and _or',
    () => {
      const whereClause = new ClauseBuilder({
        _or: { fieldOne: ['value_one', 'value_two'], fieldTwo: [100, 50, 70] },
        _and: { fieldOne: ['value_three'], fieldTwo: [1] },
      }, builderOptions).buildWhereClause();

      assertEquals(whereClause.clause, [
        '"fieldOne" IN ($1, $2) OR "fieldTwo" IN ($3, $4, $5)',
        '"fieldOne" IN ($6) AND "fieldTwo" IN ($7)',
      ]);
      assertEquals(
        whereClause.clauseStr,
        '("fieldOne" IN ($1, $2) OR "fieldTwo" IN ($3, $4, $5)) AND ("fieldOne" IN ($6) AND "fieldTwo" IN ($7))',
      );
      assertEquals(whereClause.nextPreparedIndex, 8);
      assertEquals(whereClause.values, [
        'value_one',
        'value_two',
        100,
        50,
        70,
        'value_three',
        1,
      ]);
    },
  );

  it(
    'should use fallback conjunction if missing _or and _and',
    () => {
      const whereClause = new ClauseBuilder({
        fieldOne: ['value_one', 'value_two'],
        fieldTwo: [100, 50, 70],
      }, builderOptions).buildWhereClause();

      assertEquals(whereClause.clause, [
        '"fieldOne" IN ($1, $2) AND "fieldTwo" IN ($3, $4, $5)',
      ]);
      assertEquals(
        whereClause.clauseStr,
        '"fieldOne" IN ($1, $2) AND "fieldTwo" IN ($3, $4, $5)',
      );
      assertEquals(whereClause.nextPreparedIndex, 6);
      assertEquals(whereClause.values, [
        'value_one',
        'value_two',
        100,
        50,
        70,
      ]);
    },
  );

  it(
    'should throw error if _or, _and and field value syntax is used',
    () => {
      const clauseBuilder = new ClauseBuilder({
        _or: { fieldOne: ['value_one', 'value_two'], fieldTwo: [100, 50, 70] },
        _and: { fieldOne: ['value_three'], fieldTwo: [1] },
        fieldOne: ['value_one', 'value_two'],
        fieldTwo: [100, 50, 70],
      }, builderOptions);

      assertThrows(
        () => clauseBuilder.buildWhereClause(),
        Error,
        'Can\'t use a combination of flat field filter and _and / _or!',
      );
    },
  );
});
