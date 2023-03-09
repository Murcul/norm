import { PGClient } from '../../deps.ts';

const pgClient = new PGClient(
  'postgresql://postgres:test@localhost:5432/world',
);

await pgClient.connect();

export const query = async (query: string, params: any) => {
  const data = await pgClient.queryObject(query, params);

  return { rows: data.rows };
};
