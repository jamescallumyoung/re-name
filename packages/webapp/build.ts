// Builds the webapp into dist/: the bundled app.js, index.html and tokens.css.
//   deno task build              build once
//   deno task dev [source] ...   rebuild on change, and run the server on port 3000
//                                (further arguments go to the server; reload the page after a change)
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
  // The real server reads dist/ on every request, so it serves each rebuild.
  const args = Deno.args.filter((a) => a !== '--dev');
  const server = new Deno.Command(Deno.execPath(), {
    args: ['task', '--cwd', '../server', 'start', '--no-open', '--port', '3000', ...args],
  }).spawn();
  const { code } = await server.status;
  await context.dispose();
  await esbuild.stop();
  Deno.exit(code);
} else {
  await context.rebuild();
  await context.dispose();
  await esbuild.stop();
  console.log('Built dist/');
}
