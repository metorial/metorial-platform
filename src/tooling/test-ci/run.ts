let args = (await Bun.file('.test-command.json').json()) as string[];
let result = Bun.spawnSync(
  ['bunx', 'turbo@2.9.18', 'run', ...args, ...process.argv.slice(2)],
  {
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env
  }
);
process.exit(result.exitCode);
