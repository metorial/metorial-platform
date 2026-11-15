import { spawn } from 'child_process';

export let runCommand = async (
  command: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string | undefined> } = {}
) => {
  console.log(`\n$ ${[command, ...args].join(' ')}`);

  await new Promise<void>((resolve, reject) => {
    let child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
};

export let commandExists = async (command: string) => {
  try {
    await new Promise<void>((resolve, reject) => {
      let child = spawn(command, ['--version'], { stdio: 'ignore' });
      child.on('error', reject);
      child.on('close', code => (code === 0 ? resolve() : reject()));
    });
    return true;
  } catch {
    return false;
  }
};
