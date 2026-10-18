// re-name's entry point: the command line, then config, the lock, the first scan,
// the server, and the browser (design doc §4; spec C1.4, H1.11, H1.12).

import { join, relative, SEPARATOR } from '@std/path';
import { startApply } from './src/apply.ts';
import { checkFolders, parseCli } from './src/cli.ts';
import { loadConfig } from './src/config.ts';
import { startServer } from './src/http.ts';
import { acquireLock } from './src/lock.ts';
import { tagRules } from './src/naming/known-tags.ts';
import { handlers } from './src/rpc.ts';
import { Session } from './src/session.ts';
import { State } from './src/state.ts';
import { tmdbClient } from './src/tmdb.ts';

/** The built webapp. The same relative path works in the compiled binary, which embeds it. */
const WEB_ROOT = join(import.meta.dirname ?? '.', '..', 'webapp', 'dist');

export async function main(argv: readonly string[]): Promise<number> {
  const cli = parseCli(argv, Deno.cwd());
  if ('exit' in cli) {
    (cli.exit === 0 ? console.log : console.error)(cli.message);
    return cli.exit;
  }
  const args = cli.run;
  const fail = (message: string) => {
    console.error(`re-name: ${message}`);
    return 1;
  };

  const [foldersOk, folderProblem] = await checkFolders(args.source, args.target);
  if (!foldersOk) return fail(folderProblem);
  const source = await Deno.realPath(args.source);
  // The target in real-path terms, so the scan can recognise and skip it.
  const target = await Deno.realPath(args.target).catch(() =>
    args.target.startsWith(args.source + SEPARATOR) ? join(source, relative(args.source, args.target)) : args.target
  );

  const [configOk, config] = await loadConfig();
  if (!configOk) return fail(config);

  const [lockOk, lock] = await acquireLock(config.folders.state, source);
  if (!lockOk) return fail(lock);

  try {
    await Deno.stat(join(WEB_ROOT, 'index.html'));
  } catch {
    await lock.release();
    return fail(`The webapp isn't built (${WEB_ROOT}). Run "deno task build" first.`);
  }

  const state = new State({
    source,
    target,
    dryRun: args.dryRun,
    rules: tagRules(config.knownTags),
    tmdb: tmdbClient({
      baseUrl: config.tmdbBaseUrl,
      credential: config.credential,
      language: config.titleLanguage,
      cacheDir: config.folders.cache,
    }),
    stateDir: config.folders.state,
  }, config.flavour);
  await state.rescan();

  const { promise: ended, resolve: end } = Promise.withResolvers<void>();
  const session = new Session({ applying: () => state.applying, onEnd: end });
  let server;
  try {
    server = startServer({
      state,
      session,
      handlers: handlers(state, () => startApply(state, session)),
      webRoot: WEB_ROOT,
      port: args.port,
    });
  } catch (error) {
    await lock.release();
    return fail(`Can't listen on port ${args.port}: ${(error as Error).message}`);
  }

  console.log(`re-name is running at ${server.launchUrl}`);
  if (args.dryRun) console.log('Dry run: applying the Queue will report what it would do, and move nothing.');
  console.log('Press Ctrl-C to stop.');
  if (args.open) openBrowser(server.launchUrl);

  let stopping = false;
  const onSignal = () => {
    if (stopping) Deno.exit(130);
    stopping = true;
    console.log(state.applying ? '\nStopping once the apply finishes…' : '\nStopping…');
    session.requestEnd();
  };
  const signals: Deno.Signal[] = Deno.build.os === 'windows' ? ['SIGINT'] : ['SIGINT', 'SIGTERM'];
  for (const s of signals) Deno.addSignalListener(s, onSignal);

  await ended;
  for (const s of signals) Deno.removeSignalListener(s, onSignal);
  await server.shutdown();
  await lock.release();
  console.log('re-name stopped.');
  return 0;
}

/** Opens the default browser; if it can't, the printed address is enough. */
function openBrowser(url: string): void {
  const [cmd, args] = Deno.build.os === 'darwin'
    ? ['open', [url]]
    : Deno.build.os === 'windows'
    ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]];
  try {
    new Deno.Command(cmd, { args, stdout: 'null', stderr: 'null' }).spawn().status.catch(() => {});
  } catch {
    // No browser opener: the address is printed above.
  }
}

if (import.meta.main) Deno.exit(await main(Deno.args));
