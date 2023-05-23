import { assertEquals, describe, it } from './dev_deps.ts';

import { ClauseBuilder } from './clause-builder.ts';

describe('ClauseBuilder', () => {
  it(
    'should return where clause when using only _and',
    () => {
      const filterClause = {
        _and: [{ fieldOne: [1], fieldTwo: [2], fieldThree: [3] }],
      };

      const whereClause = new ClauseBuilder(filterClause)
        .buildWhereClause();

      const expectedClause =
        '("fieldOne" IN ($1) AND "fieldTwo" IN ($2) AND "fieldThree" IN ($3))';

      assertEquals(whereClause.clause, expectedClause);
      assertEquals(whereClause.nextPreparedIndex, 4);
      assertEquals(whereClause.values, [
        1,
        2,
        3,
      ]);
    },
  );

  it(
    'should return where clause when using only _and with nested filters',
    () => {
      const filterClause = {
        _and: [{
          fieldOne: [1],
          fieldTwo: [2],
          _or: [{
            fieldThree: [3],
            fieldFour: [4],
            _and: [{ fieldFive: [5], fieldSix: [6] }],
          }],
        }],
      };

      const whereClause = new ClauseBuilder(filterClause)
        .buildWhereClause();

      const expectedClause =
        '(("fieldOne" IN ($5) AND "fieldTwo" IN ($6)) AND (("fieldThree" IN ($3) OR "fieldFour" IN ($4)) OR ("fieldFive" IN ($1) AND "fieldSix" IN ($2))))';

      assertEquals(whereClause.clause, expectedClause);
      assertEquals(whereClause.nextPreparedIndex, 7);
      assertEquals(whereClause.values, [5, 6, 3, 4, 1, 2]);
    },
  );

  it(
    'should return where clause when using only _or',
    () => {
      const filterClause = {
        _or: [{ fieldOne: [1], fieldTwo: [2], fieldThree: [3] }],
      };

      const whereClause = new ClauseBuilder(filterClause)
        .buildWhereClause();

      const expectedClause =
        '("fieldOne" IN ($1) OR "fieldTwo" IN ($2) OR "fieldThree" IN ($3))';

      assertEquals(whereClause.clause, expectedClause);
      assertEquals(whereClause.nextPreparedIndex, 4);
      assertEquals(whereClause.values, [1, 2, 3]);
    },
  );

  it(
    'should return where clause when using only _or with nested filters',
    () => {
      const filterClause = {
        _or: [{
          fieldOne: [1],
          fieldTwo: [2],
          _and: [{
            fieldThree: [3],
            fieldFour: [4],
            _or: [{ fieldFive: [5], fieldSix: [6] }],
          }],
        }],
      };

      const whereClause = new ClauseBuilder(filterClause)
        .buildWhereClause();

      const expectedClause =
        '(("fieldOne" IN ($5) OR "fieldTwo" IN ($6)) OR (("fieldThree" IN ($3) AND "fieldFour" IN ($4)) AND ("fieldFive" IN ($1) OR "fieldSix" IN ($2))))';

      assertEquals(whereClause.clause, expectedClause);
      assertEquals(whereClause.nextPreparedIndex, 7);
      assertEquals(whereClause.values, [5, 6, 3, 4, 1, 2]);
    },
  );

  it(
    'should return where clause when using _and & _or',
    () => {
      const filterClause = {
        _and: [{ fieldOne: [1], fieldTwo: [2] }],
        _or: [{ fieldThree: [3], fieldFour: [4] }],
      };

      const whereClause = new ClauseBuilder(filterClause)
        .buildWhereClause();

      const expectedClause =
        '(("fieldThree" IN ($3) OR "fieldFour" IN ($4)) AND ("fieldOne" IN ($1) AND "fieldTwo" IN ($2)))';

      assertEquals(whereClause.clause, expectedClause);
      assertEquals(whereClause.nextPreparedIndex, 5);
      assertEquals(whereClause.values, [1, 2, 3, 4]);
    },
  );

  it(
    'should return where clause when using only spreaded fields',
    () => {
      const filterClause = {
        fieldOne: [1],
        fieldTwo: [2],
        fieldThree: [3],
      };

      const whereClause = new ClauseBuilder(filterClause)
        .buildWhereClause();

      const expectedClause =
        '("fieldOne" IN ($1) AND "fieldTwo" IN ($2) AND "fieldThree" IN ($3))';

      assertEquals(whereClause.clause, expectedClause);
      assertEquals(whereClause.nextPreparedIndex, 4);
      assertEquals(whereClause.values, [
        1,
        2,
        3,
      ]);
    },
  );

  it(
    'should return where clause when using combination for _and, _or and spreaded fields',
    () => {
      const filterClause = {
        _and: [{ fieldOne: [1], _or: [{ fieldTwo: [2], fieldThree: [3] }] }],
        _or: [{
          fieldFour: [4],
          fieldFive: [5],
          _and: [{ fieldSix: [6], fieldSeven: [7] }],
        }],
        fieldEight: [8],
        fieldNine: [9],
      };

      const whereClause = new ClauseBuilder(filterClause)
        .buildWhereClause();

      const expectedClause =
        '((("fieldEight" IN ($8) AND "fieldNine" IN ($9)) AND (("fieldFour" IN ($6) OR "fieldFive" IN ($7)) OR ("fieldSix" IN ($4) AND "fieldSeven" IN ($5)))) AND (("fieldOne" IN ($3)) AND ("fieldTwo" IN ($1) OR "fieldThree" IN ($2))))';

      assertEquals(whereClause.clause, expectedClause);
      assertEquals(whereClause.nextPreparedIndex, 10);
      assertEquals(whereClause.values, [
        2,
        3,
        1,
        6,
        7,
        4,
        5,
        8,
        9,
      ]);
    },
  );
});
