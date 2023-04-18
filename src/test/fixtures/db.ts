import { PGClient } from '../../deps.ts';
import { DBClient } from '../../types.ts';

export const runTestInTransaction = (
  testCase: (
    tx: DBClient,
    ctx: Deno.TestContext,
  ) => void | Promise<void>,
) => {
  const pgClient = new PGClient(
    'postgresql://postgres:test@localhost:5432/world',
  );

  return async (ctx: Deno.TestContext) => {
    await pgClient.connect();

    const tx = pgClient.createTransaction('norm_test');

    await tx.begin();

    const query = async (query: string, params: any) => {
      return await tx.queryObject(query, params);
    };

    try {
      await testCase({ query }, ctx);
    } catch (error) {
      throw error;
    } finally {
      await tx.rollback();
      await pgClient.end();
    }
  };
};
