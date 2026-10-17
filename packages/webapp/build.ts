// Builds the webapp into dist/: the bundled app.js, index.html and tokens.css.
//   deno task build    build once
//   deno task dev      rebuild on change, and serve on http://localhost:3000
// esbuild bundles it: `deno bundle` is still experimental (design doc, section 2).

import * as esbuild from 'esbuild';

const dev = Deno.args.includes('--dev');
const root = new URL('.', import.meta.url).pathname;
Deno.chdir(root);

await Deno.remove('dist', { recursive: true }).catch(() => {});
await Deno.mkdir('dist');
await Deno.copyFile('index.html', 'dist/index.html');
await Deno.copyFile('src/styles/tokens.css', 'dist/tokens.css');

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'esm',
  // Lit's standard decorators are lowered for browsers that lack them.
  target: 'es2022',
  minify: !dev,
  sourcemap: dev,
  logLevel: 'warning',
  // Workspace packages, which esbuild doesn't know about.
  alias: { '@re-name/protocol': '../protocol/mod.ts' },
});

if (dev) {
  await context.watch();
  const { port } = await context.serve({ servedir: 'dist', port: 3000 });
  console.log(`re-name webapp POC: http://localhost:${port}`);
} else {
  await context.rebuild();
  await context.dispose();
  await esbuild.stop();
  console.log('Built dist/');
}
