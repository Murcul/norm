import { dnt } from './dev_deps.ts';

await dnt.build({
  entryPoints: [
    './src/mod.ts', 
    {
    kind: "bin",
    name: "norm",
    path: "./src/cli.ts",
  }],
  outDir: './npm',
  shims: {
    deno: true
  },
  typeCheck: false,
  test: false,
  declaration: false,
  package: {
    name: 'norm',
    version: Deno.args[0]?.replace(/^v/, ''),
    description: '<discription>',
    license: 'MIT',
  },
});
