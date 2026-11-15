import { existsSync } from 'fs';
import path from 'path';

export let frontendDir = (name: 'auth' | 'admin' | 'public') => {
  let bundled = path.join(process.cwd(), 'frontend', name);
  if (existsSync(bundled)) return bundled;

  return path.join(process.cwd(), '..', 'frontends', name);
};
