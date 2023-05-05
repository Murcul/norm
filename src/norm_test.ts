import {
  assertArrayIncludes,
  assertEquals,
  assertRejects,
  assertSpyCall,
  describe,
  it,
  spy,
} from './dev_deps.ts';

import { DbSchema } from './test/fixtures/norm-schema.type.ts';

import { Norm } from './norm.ts';
import { runTestInTransaction } from './test/fixtures/db.ts';

const removeWhitespace = (str: string) => str.replaceAll(/\s/g, '');
const getDB = () => ({
  query: (_q: string, _p: unknown) => Promise.resolve({ rows: [] }),
});

describe('getEntities', () => {
  it(
    'should return select statement when there is no where param',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.getEntities('public', 'city', [
        'id',
        'name',
        'countrycode',
      ], {});

      assertSpyCall(querySpy, 0, {
        args: [
          'select ("id", "name", "countrycode") from "public"."city" where true;',
          [],
        ],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );

  it(
    'should return select statement when there is where param',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.getEntities('public', 'city', [
        'id',
        'name',
        'countrycode',
      ], { id: [1] });

      assertSpyCall(querySpy, 0, {
        args: [
          'select ("id", "name", "countrycode") from "public"."city" where "id" IN ($1);',
          [1],
        ],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );

  it(
    'should return select statement when there is multiple where param',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.getEntities('public', 'city', [
        'id',
        'name',
        'countrycode',
      ], { name: ['name'], countrycode: ['countrycode'] });

      assertSpyCall(querySpy, 0, {
        args: [
          'select ("id", "name", "countrycode") from "public"."city" where "name" IN ($1) OR "countrycode" IN ($2);',
          ['name', 'countrycode'],
        ],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );

  it(
    'should return select statement when using _or',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.getEntities('public', 'city', [
        'id',
        'name',
        'countrycode',
      ], {
        _or: [{ name: 'name_one', countrycode: 'countrycode_one' }, {
          name: 'name_two',
          countrycode: 'countrycode_two',
        }],
      });

      const expectedSql =
        'select ("id", "name", "countrycode") from "public"."city" where ("name" = $1 AND "countrycode" = $2) OR ("name" = $3 AND "countrycode" = $4);';
      const expectedValues = [
        'name_one',
        'countrycode_one',
        'name_two',
        'countrycode_two',
      ];

      assertEquals(expectedSql, querySpy.calls[0].args[0]);
      assertEquals(expectedValues, querySpy.calls[0].args[1]);
    },
  );

  it(
    'should return select statement when using _and',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.getEntities('public', 'city', [
        'id',
        'name',
        'countrycode',
      ], {
        _and: [{ name: 'name_one', countrycode: 'countrycode_one' }, {
          name: 'name_two',
          countrycode: 'countrycode_two',
        }],
      });

      const expectedSql =
        'select ("id", "name", "countrycode") from "public"."city" where ("name" = $1 OR "countrycode" = $2) AND ("name" = $3 OR "countrycode" = $4);';
      const expectedValues = [
        'name_one',
        'countrycode_one',
        'name_two',
        'countrycode_two',
      ];

      assertEquals(expectedSql, querySpy.calls[0].args[0]);
      assertEquals(expectedValues, querySpy.calls[0].args[1]);
    },
  );

  it(
    'should return select statement when using _and and _or',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.getEntities('public', 'city', [
        'id',
        'name',
        'countrycode',
      ], {
        _and: [{ name: 'name_one', countrycode: 'countrycode_one' }, {
          name: 'name_two',
          countrycode: 'countrycode_two',
        }],
        _or: [{ name: 'name_three', countrycode: 'countrycode_three' }, {
          name: 'name_four',
          countrycode: 'countrycode_four',
        }],
      });
      const expectedSql =
        'select ("id", "name", "countrycode") from "public"."city" where (("name" = $1 AND "countrycode" = $2) OR ("name" = $3 AND "countrycode" = $4)) AND (("name" = $5 OR "countrycode" = $6) AND ("name" = $7 OR "countrycode" = $8));';
      const expectedValues = [
        'name_three',
        'countrycode_three',
        'name_four',
        'countrycode_four',
        'name_one',
        'countrycode_one',
        'name_two',
        'countrycode_two',
      ];

      assertEquals(expectedSql, querySpy.calls[0].args[0]);
      assertEquals(expectedValues, querySpy.calls[0].args[1]);
    },
  );

  it(
    'should throw error when using _and, _or and bare fields',
    async () => {
      const db = getDB();

      const _querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await assertRejects(
        () => {
          return norm.getEntities('public', 'city', [
            'id',
            'name',
            'countrycode',
          ], {
            name: ['name'],
            countrycode: ['countrycode'],
            _or: { id: [1, 2], name: ['name_two', 'name_three'] },
            _and: { name: ['name_four'], countrycode: ['countrycode_two'] },
          });
        },
        Error,
        'Can\'t use a combination of flat field filter and _and / _or!',
      );
    },
  );
});

describe('updateEntity', () => {
  it(
    'should return update statement',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.updateEntity('public', 'city', ['name'], ['id'], {
        name: 'title',
        id: 1,
      });

      assertSpyCall(querySpy, 0, {
        args: [
          'update "public"."city" set \n "name" = $1\nwhere "id" = $2\nreturning "name", "id";',
          ['title', 1],
        ],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );
});

describe('updateEntities', () => {
  it(
    'should return update statement',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.bulkUpdateEntities('public', 'city', ['name', 'countrycode'], [
        'id',
      ], [
        {
          countrycode: 'AFG',
          name: 'first_name',
          id: 1,
        },
        {
          countrycode: 'AFG',
          name: 'second_name',
          id: 2,
        },
        {
          countrycode: 'AFG',
          name: 'third_name',
          id: 3,
        },
      ]);

      const expectedSql = `
    update "public"."city" as update_table
    set 
      "countrycode" = data_table."countrycode", "name" = data_table."name"
    from (
      select *
      from unnest(array[$1, $2, $3],array[$4, $5, $6],array[$7, $8, $9])
    ) as data_table ("countrycode", "name", "id")
    where update_table."id"::text = data_table."id"::text
    returning update_table."name", update_table."countrycode", update_table."id";`;

      const expectedParams = [
        'AFG',
        'AFG',
        'AFG',
        'first_name',
        'second_name',
        'third_name',
        1,
        2,
        3,
      ];

      assertEquals(expectedSql, querySpy.calls[0].args[0]);
      assertSpyCall(querySpy, 0, {
        args: [
          expectedSql,
          expectedParams,
        ],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );

  it(
    'should update and return entities',
    runTestInTransaction(async (db) => {
      const norm = new Norm<DbSchema>(db);

      const results = await norm.bulkUpdateEntities(
        'public',
        'city',
        ['name', 'countrycode'],
        ['id'],
        [
          {
            countrycode: 'AFG',
            name: 'first_name',
            id: 1,
          },
          {
            countrycode: 'AFG',
            name: 'second_name',
            id: 2,
          },
          {
            countrycode: 'AFG',
            name: 'third_name',
            id: 3,
          },
        ],
      );

      assertArrayIncludes(results!, [
        { name: 'third_name', countrycode: 'AFG', id: 3 },
        { name: 'second_name', countrycode: 'AFG', id: 2 },
        { name: 'first_name', countrycode: 'AFG', id: 1 },
      ]);
    }),
  );
});

describe('upsertEntity', () => {
  it(
    'should skip maybe columns with undefined values',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      const expectedSql = `insert into "public"."city" ("name", "id") 
    values ($1,$2)
    on conflict ("id") do update set "name" = excluded."name"
    returning "name", "id", "countrycode";`;

      await norm.upsertEntity(
        'public',
        'city',
        ['name', 'id'],
        ['countrycode'],
        ['id'],
        { name: 'name', id: 2, countrycode: undefined },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['name', 2]],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );

  it(
    'should include maybe columns with null values',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      const expectedSql =
        `insert into "public"."country" ("continent", "code", "headofstate") 
    values ($1,$2,$3)
    on conflict ("code") do update set "continent" = excluded."continent", "headofstate" = excluded."headofstate"
    returning "continent", "code", "headofstate";`;

      await norm.upsertEntity(
        'public',
        'country',
        ['continent', 'code'],
        ['headofstate'],
        ['code'],
        { continent: 'continent', code: 'code', headofstate: null },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['continent', 'code', null]],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );

  it(
    'should include maybe columns with actual values',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      const expectedSql =
        `insert into "public"."country" ("continent", "code", "headofstate", "gnp") 
    values ($1,$2,$3,$4)
    on conflict ("code") do update set "continent" = excluded."continent", "headofstate" = excluded."headofstate", "gnp" = excluded."gnp"
    returning "continent", "code", "headofstate", "gnp";`;

      await norm.upsertEntity(
        'public',
        'country',
        ['continent', 'code'],
        ['headofstate', 'gnp'],
        ['code'],
        {
          continent: 'continent',
          code: 'code',
          headofstate: 'headofstate',
          gnp: 'gnp',
        },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['continent', 'code', 'headofstate', 'gnp']],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );

  it(
    'should return statement with empty maybe columns',
    async () => {
      const db = getDB();

      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      const expectedSql = `insert into "public"."country" ("continent", "code") 
    values ($1,$2)
    on conflict ("code") do update set "continent" = excluded."continent"
    returning "continent", "code";`;

      await norm.upsertEntity(
        'public',
        'country',
        ['continent', 'code'],
        [],
        ['code'],
        { continent: 'continent', code: 'code' },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['continent', 'code']],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );
});

describe('bulkUpsertEntity', () => {
  it(
    'should return upsert statement',
    async () => {
      const db = getDB();
      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.bulkUpsertEntity(
        'public',
        'city',
        ['name', 'id', 'district', 'population'],
        ['countrycode'],
        ['id'],
        [{
          name: 'name_one',
          id: 12000,
          countrycode: 'AFG',
          district: 'Kabol',
          population: 1780000,
        }, {
          name: 'name_two',
          population: 1780000,
          district: 'Kabol',
          id: 1,
          countrycode: 'AFG',
        }],
      );

      const expectedSql = `
      with _query as (
        
        insert into "public"."city" ("name", "id", "countrycode", "district", "population") 
        values 
          ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
        on conflict ("id") do update set "name" = excluded."name", "countrycode" = excluded."countrycode", "district" = excluded."district", "population" = excluded."population"
        returning "name", "id", "district", "population", "countrycode"
            )
          select * from _query
    `;

      const expectedParams = [
        'name_one',
        12000,
        'AFG',
        'Kabol',
        1780000,
        'name_two',
        1,
        'AFG',
        'Kabol',
        1780000,
      ];

      assertEquals(
        removeWhitespace(expectedSql),
        removeWhitespace(querySpy.calls[0].args[0]),
      );
      assertEquals(expectedParams, querySpy.calls[0].args[1]);
    },
  );

  it(
    'should upsert and return upsert results with maybe column skipped',
    runTestInTransaction(async (db) => {
      const norm = new Norm<DbSchema>(db);

      const results = await norm.bulkUpsertEntity(
        'public',
        'country',
        [
          'name',
          'region',
          'continent',
          'localname',
          'governmentform',
          'code2',
          'surfacearea',
          'population',
          'code',
        ],
        ['headofstate', 'gnp'],
        ['code'],
        [
          {
            name: 'name AFG',
            region: 'region AFG',
            continent: 'Africa',
            localname: 'localname AFG',
            governmentform: 'governmentform AFG',
            code2: 'CO',
            surfacearea: 1,
            population: 1,
            code: 'AFG',
          },
          {
            name: 'name NLD',
            region: 'region NLD',
            continent: 'Africa',
            localname: 'localname NLD',
            governmentform: 'governmentformNLD',
            code2: 'CO',
            surfacearea: 1,
            population: 1,
            code: 'NLD',
            lifeexpectancy: 1,
          },
          {
            name: 'name ALB',
            region: 'region ALB',
            continent: 'Africa',
            localname: 'localname ALB',
            governmentform: 'governmentform ALB',
            code2: 'CO',
            surfacearea: 1,
            population: 1,
            code: 'ALB',
            lifeexpectancy: 1,
            headofstate: 'headofstate',
            gnp: '5000',
          },
        ],
      );

      assertEquals(results, [
        {
          name: 'name AFG',
          region: 'region AFG',
          continent: 'Africa',
          localname: 'localname AFG',
          governmentform: 'governmentform AFG',
          code2: 'CO',
          surfacearea: '1' as any,
          population: 1,
          code: 'AFG',
          headofstate: 'Mohammad Omar',
          gnp: '5976.00',
        },
        {
          name: 'name ALB',
          region: 'region ALB',
          continent: 'Africa',
          localname: 'localname ALB',
          governmentform: 'governmentform ALB',
          code2: 'CO',
          surfacearea: '1',
          population: 1,
          code: 'ALB',
          headofstate: 'headofstate',
          gnp: '5000.00',
        },
        {
          name: 'name NLD',
          region: 'region NLD',
          continent: 'Africa',
          localname: 'localname NLD',
          governmentform: 'governmentformNLD',
          code2: 'CO',
          surfacearea: '1',
          population: 1,
          code: 'NLD',
          headofstate: 'Beatrix',
          gnp: '371362.00',
        },
      ]);
    }),
  );
});

describe('bulkInsertEntity', () => {
  it(
    'should return insert statement',
    async () => {
      const db = getDB();
      const querySpy = spy(db, 'query');

      const norm = new Norm<DbSchema>(db);

      await norm.bulkInsertEntity(
        'public',
        'city',
        ['name', 'id', 'countrycode', 'district', 'population'],
        [{
          name: 'name_one',
          id: 12000,
          countrycode: 'AFG',
          district: 'Kabol',
          population: 1780000,
        }, {
          name: 'name_two',
          population: 1780000,
          district: 'Kabol',
          id: 1,
          countrycode: 'AFG',
        }],
      );

      const expectedSql = `
    insert into "public"."city" ("name", "id", "countrycode", "district", "population") 
    values 
      ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
    returning "name", "id", "countrycode", "district", "population";`;

      const expectedParams = [
        'name_one',
        12000,
        'AFG',
        'Kabol',
        1780000,
        'name_two',
        1,
        'AFG',
        'Kabol',
        1780000,
      ];

      assertEquals(
        removeWhitespace(expectedSql),
        removeWhitespace(querySpy.calls[0].args[0]),
      );
      assertEquals(expectedParams, querySpy.calls[0].args[1]);
    },
  );

  it(
    'should insert and return insert results',
    runTestInTransaction(async (db) => {
      const norm = new Norm<DbSchema>(db);

      const results = await norm.bulkInsertEntity(
        'public',
        'city',
        ['name', 'id', 'countrycode', 'district', 'population'],
        [{
          name: 'name_one',
          id: 1200000,
          countrycode: 'AFG',
          district: 'Kabol',
          population: 1780000,
        }, {
          name: 'name_two',
          population: 1780000,
          district: 'Kabol',
          id: 1200001,
          countrycode: 'AFG',
        }],
      );

      assertEquals(results, [
        {
          name: 'name_one',
          id: 1200000,
          district: 'Kabol',
          population: 1780000,
          countrycode: 'AFG',
        },
        {
          name: 'name_two',
          id: 1200001,
          district: 'Kabol',
          population: 1780000,
          countrycode: 'AFG',
        },
      ]);
    }),
  );
});
