import { dnt, copy } from './dev_deps.ts';

await Deno.remove("npm", { recursive: true }).catch((_) => {});
await copy("patches", "npm/patches", { overwrite: true });

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
    crypto: true,
    deno: true,
  },
  typeCheck: false,
  test: false,
  declaration: false,
  package: {
    name: 'norm',
    version: Deno.args[0]?.replace(/^v/, ''),
    description: '<discription>',
    license: 'MIT',
    scripts: {
      "postinstall": "patch-package"
    },
    bin: {
      norm: "./script/cli.js"
    },
    dependencies: {
      "patch-package": "^6.5.1",
    }
  },
});
