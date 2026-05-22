import { join, resolve } from 'path';
import { OSS_DIR } from '../const';

export let runControl = async (args: string[]) => {
  let controlCli = join(OSS_DIR, 'src/tooling/control/src/cli.ts');
  let cwd = process.env.METORIAL_PWD ? resolve(process.env.METORIAL_PWD) : process.cwd();

  let proc = Bun.spawn(['bun', controlCli, ...args], {
    cwd,
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  });
  let code = await proc.exited;
  process.exit(code);
};
