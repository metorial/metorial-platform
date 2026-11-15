import { spawn } from 'node:child_process';

export let openUrl = (url: string) => {
  let program =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  let args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(program, args, { detached: true, stdio: 'ignore' }).unref();
};
