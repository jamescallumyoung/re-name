// Builds the webapp, then compiles re-name into one binary per target, in dist/
// (design doc §2.2).
//   deno task compile                      every target
//   deno task compile aarch64-apple-darwin  just the ones named

const TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'x86_64-unknown-linux-gnu',
  'aarch64-unknown-linux-gnu',
  'x86_64-pc-windows-msvc',
];

// Read and write anywhere (the user's folders); the network only for the page and TMDB;
// and only the command that opens a browser. Never --env-file: the .env is read at run time.
const PERMISSIONS = [
  '--allow-read',
  '--allow-write',
  '--allow-env',
  '--allow-sys',
  '--allow-net=127.0.0.1,api.themoviedb.org',
];
const opener = (target: string) => target.includes('darwin') ? 'open' : target.includes('windows') ? 'cmd' : 'xdg-open';

const root = new URL('..', import.meta.url).pathname;
const targets = Deno.args.length ? Deno.args : TARGETS;
const unknown = targets.filter((t) => !TARGETS.includes(t));
if (unknown.length) {
  console.error(`Unknown target: ${unknown.join(', ')}. Targets: ${TARGETS.join(', ')}`);
  Deno.exit(2);
}

async function run(args: string[]): Promise<void> {
  const { code } = await new Deno.Command(Deno.execPath(), { args, cwd: root }).spawn().status;
  if (code !== 0) Deno.exit(code);
}

await run(['task', '--cwd', 'packages/webapp', 'build']);
for (const target of targets) {
  await run([
    'compile',
    ...PERMISSIONS,
    `--allow-run=${opener(target)}`,
    '--include',
    'packages/webapp/dist',
    '--target',
    target,
    '--output',
    `dist/re-name-${target}`,
    'packages/server/main.ts',
  ]);
}
