import { path } from './deps.ts';
import { assertEquals, describe, it, stub } from './dev_deps.ts';
import { runTypeGenerator } from './cli.ts';

const dirname = path.dirname(path.fromFileUrl(import.meta.url));
const schemaType = Deno.readTextFileSync(
  path.join(dirname, './test/fixtures/norm-schema.type.ts'),
);

describe('runTypeGenerator', () => {
  it(
    'should generate right typing & write to schema type file',
    async () => {
      const writeFileStub = stub(
        Deno,
        'writeTextFileSync',
        () => Promise.resolve(),
      );

      const typings = await runTypeGenerator();
      const typingsToOutputFile = writeFileStub.calls[0].args[1];

      writeFileStub.calls[0].args;

      assertEquals(schemaType, typings);
      assertEquals(schemaType, typingsToOutputFile);
      writeFileStub.restore();
    },
  );
});
