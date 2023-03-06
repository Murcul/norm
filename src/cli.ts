import { TypeGenerator } from './type-generator.ts';
import { path, z } from './deps.ts';

const databaseInfo = z.object({
  host: z.string(),
  database: z.string(),
  user: z.string(),
  password: z.string(),
});

const normConfigSchema = z.object({
  database: databaseInfo,
});

const normConfigFile = path.join(Deno.cwd(), `./norm-config.json`);

export const runTypeGenerator = async () => {
  const { default: normConfig } = await import(normConfigFile, {
    assert: { type: 'json' },
  });

  normConfigSchema.parse(normConfig, {});

  const typeGenerator = new TypeGenerator(normConfig.database);

  const outputFile = path.join(Deno.cwd(), `./norm-schema.type.ts`);

  try {
    await typeGenerator.generate(outputFile);

    console.log(`✅ Generated norm schema to `);
  } catch (error) {
    console.log('❌ error generating norm schema', error);
  }
};

runTypeGenerator();
