import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default () => {
  execFileSync('bun', ['run', 'build'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: 'inherit'
  });
};
