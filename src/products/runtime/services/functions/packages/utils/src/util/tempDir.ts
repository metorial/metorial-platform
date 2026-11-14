import { randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export let tempDir = async (prefix: string = 'function-bay-tmp-'): Promise<string> => {
  let systemTmpDir = os.tmpdir();
  let randomSuffix = randomBytes(6).toString('hex');
  let tmpDir = path.join(systemTmpDir, `${prefix}${randomSuffix}`);

  await fs.mkdir(tmpDir, { recursive: true });

  return tmpDir;
};
