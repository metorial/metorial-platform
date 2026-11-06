import { checkReleaseChannel, getReleaseChannel, isBuilt } from '@metorial/editions';

if (!isBuilt() || checkReleaseChannel('dev')) {
  console.log((await import('./devOnly')).marker);
}

console.log(getReleaseChannel());
