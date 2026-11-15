import { loadEnv } from 'vite';

export const loadTestEnv = (
  mode: string | undefined = 'test',
  cwd: string = process.cwd(),
  prefix: string = ''
): Record<string, string> => {
  const resolvedMode = mode && mode.length > 0 ? mode : 'test';
  return loadEnv(resolvedMode, cwd, prefix);
};
