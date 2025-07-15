import { join } from 'path';
import { OSS_DIR, ROOT_DIR } from '../const';
import { destinations } from '../env/destinations';
import { getEnvString } from '../env/generate';

export let setEnv = async () => {
  for (let dest of destinations) {
    console.log(`Setting environment for ${dest.type} at ${dest.path}`);

    let env = getEnvString(dest);
    await Bun.write(join(dest.type == 'oss' ? OSS_DIR : ROOT_DIR, dest.path, '.env'), env);
  }
};
