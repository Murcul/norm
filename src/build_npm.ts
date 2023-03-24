import { dnt } from './dev_deps.ts';

await Deno.remove('npm', { recursive: true }).catch((_) => {});

await dnt.build({
  entryPoints: [
    './src/mod.ts',
    {
      kind: 'bin',
      name: 'norm',
      path: './src/cli.ts',
    },
  ],
  outDir: './npm',
  skipSourceOutput: true,
  shims: {
    deno: true,
    custom: [
      {
        module: './src/shims/crypto.ts',
        globalNames: ['crypto'],
      },
    ],
  },
  typeCheck: false,
  test: false,
  declaration: false,
  package: {
    name: 'norm',
    version: Deno.args[0]?.replace(/^v/, ''),
    description: '<discription>',
    license: 'MIT',
    bin: {
      norm: './script/cli.js',
    },
  },
});
