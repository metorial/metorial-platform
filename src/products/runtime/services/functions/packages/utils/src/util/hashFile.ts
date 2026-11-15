import crypto from 'crypto';
import fs from 'fs';

export let hashFile = (path: string, algorithm = 'sha256') => {
  return new Promise<string>((resolve, reject) => {
    let hash = crypto.createHash(algorithm);
    let stream = fs.createReadStream(path);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};
