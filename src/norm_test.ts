import { assertSpyCall, describe, it, spy } from './dev_deps.ts';

import { DbSchema } from './test/fixtures/norm-schema.type.ts';

import { Norm } from './norm.ts';

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
          'select ("id", "name", "countrycode") from "public"."city" where "id" in ($1);',
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
          'select ("id", "name", "countrycode") from "public"."city" where "name" in ($1) OR "countrycode" in ($2);',
          ['name', 'countrycode'],
        ],
        returned: Promise.resolve({ rows: [] }),
      });
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
