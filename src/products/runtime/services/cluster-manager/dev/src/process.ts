import type { Subprocess } from 'bun';

export let log = (message: string) => console.log(`[runtime-dev] ${message}`);

export let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let run = async (
  command: string[],
  options: { env?: Record<string, string>; input?: string; quiet?: boolean } = {}
) => {
  let child = Bun.spawn(command, {
    stdin: options.input === undefined ? 'ignore' : new TextEncoder().encode(options.input),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...options.env }
  });
  let [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);

  if (code !== 0) {
    if (!options.quiet) process.stderr.write(stdout + stderr);
    throw new Error(`${command.slice(0, 3).join(' ')} exited with ${code}`);
  }

  return stdout;
};

export let children = new Set<Subprocess>();

export let spawnInherited = (command: string[]) => {
  let child = Bun.spawn(command, { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
  children.add(child);
  void child.exited.then(() => children.delete(child));

  return child;
};

let stopping = false;

export let isStopping = () => stopping;

export let stopOnSignals = () => {
  for (let signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      stopping = true;
      for (let child of children) child.kill();
      process.exit(0);
    });
};
