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
  filePath: z.string().optional(),
});

const normConfigFile = path.join(Deno.cwd(), `./norm-config.json`);

export const runTypeGenerator = async () => {
  const { default: normConfig } = await import(normConfigFile, {
    assert: { type: 'json' },
  });

  const parsedConfig = normConfigSchema.parse(normConfig, {});

  const typeGenerator = new TypeGenerator(normConfig.database);

  const typeDir = parsedConfig.filePath
    ? path.join(Deno.cwd(), parsedConfig.filePath)
    : Deno.cwd();

  if (parsedConfig.filePath) {
    await Deno.mkdir(typeDir, { recursive: true });
  }

  try {
    const typings = await typeGenerator.generate(typeDir);

    console.log(`✅ Generated norm schema to `);

    return typings;
  } catch (error) {
    console.log('❌ error generating norm schema', error);
  }
};

if (import.meta.main) {
  runTypeGenerator();
}
