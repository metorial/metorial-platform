import { startupSnapshot } from 'node:v8';

try {
  startupSnapshot.isBuildingSnapshot();
} catch (error) {
  if ((error as { code?: string }).code !== 'ERR_NOT_IMPLEMENTED') {
    throw error;
  }

  startupSnapshot.isBuildingSnapshot = () => false;
}
