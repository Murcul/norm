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

      await norm.getEntities('public', 'activities', [
        'id',
        'ticket_id',
        'title',
      ], {});

      assertSpyCall(querySpy, 0, {
        args: [
          'select ("id", "ticket_id", "title") from "public"."activities" where true;',
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

      await norm.getEntities('public', 'activities', [
        'id',
        'ticket_id',
        'title',
      ], { id: ['1'] });

      assertSpyCall(querySpy, 0, {
        args: [
          'select ("id", "ticket_id", "title") from "public"."activities" where "id" in ($1);',
          ['1'],
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

      await norm.getEntities('public', 'activities', [
        'id',
        'ticket_id',
        'title',
      ], { title: ['1'], assigned_user_id: ['1'] });

      assertSpyCall(querySpy, 0, {
        args: [
          'select ("id", "ticket_id", "title") from "public"."activities" where "title" in ($1) OR "assigned_user_id" in ($2);',
          ['1', '1'],
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

      await norm.updateEntity('public', 'activities', ['title'], ['id'], {
        title: 'title',
        id: '1',
      });

      assertSpyCall(querySpy, 0, {
        args: [
          'update "public"."activities" set \n "title" = $1\nwhere "id" = $2\nreturning "title", "id";',
          ['title', '1'],
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

      const expectedSql =
        `insert into "public"."activities" ("ticket_id", "id") 
    values ($1,$2)
    on conflict ("id") do update set "ticket_id" = excluded."ticket_id"
    returning "ticket_id", "id", "title";`;

      await norm.upsertEntity(
        'public',
        'activities',
        ['ticket_id', 'id'],
        ['title'],
        ['id'],
        { ticket_id: '1', id: '2', title: undefined },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['1', '2']],
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
        `insert into "public"."activities" ("ticket_id", "id", "instance_id") 
    values ($1,$2,$3)
    on conflict ("id") do update set "ticket_id" = excluded."ticket_id", "instance_id" = excluded."instance_id"
    returning "ticket_id", "id", "instance_id";`;

      await norm.upsertEntity(
        'public',
        'activities',
        ['ticket_id', 'id'],
        ['instance_id'],
        ['id'],
        { ticket_id: '1', id: '2', instance_id: null },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['1', '2', null]],
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
        `insert into "public"."activities" ("ticket_id", "id", "title", "related_entity") 
    values ($1,$2,$3,$4)
    on conflict ("id") do update set "ticket_id" = excluded."ticket_id", "title" = excluded."title", "related_entity" = excluded."related_entity"
    returning "ticket_id", "id", "title", "related_entity";`;

      await norm.upsertEntity(
        'public',
        'activities',
        ['ticket_id', 'id'],
        ['title', 'related_entity'],
        ['id'],
        {
          ticket_id: '1',
          id: '2',
          title: 'title',
          related_entity: 'related_entity',
        },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['1', '2', 'title', 'related_entity']],
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

      const expectedSql =
        `insert into "public"."activities" ("ticket_id", "id") 
    values ($1,$2)
    on conflict ("id") do update set "ticket_id" = excluded."ticket_id"
    returning "ticket_id", "id";`;

      await norm.upsertEntity(
        'public',
        'activities',
        ['ticket_id', 'id'],
        [],
        ['id'],
        { ticket_id: '1', id: '2' },
      );

      assertSpyCall(querySpy, 0, {
        args: [expectedSql, ['1', '2']],
        returned: Promise.resolve({ rows: [] }),
      });
    },
  );
});
