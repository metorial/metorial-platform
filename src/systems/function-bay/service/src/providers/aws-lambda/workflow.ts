import type { ForgeWorkflowStep } from '../../forge';
import {
  MANIFEST_ARTIFACT_NAME,
  MANIFEST_PATH,
  OUTPUT_ARTIFACT_NAME,
  OUTPUT_ZIP_PATH
} from '../const';

export let workflow: ForgeWorkflowStep[] = [
  {
    type: 'script',
    name: 'Build Function',
    initScript: [
      'echo "Setting up Metorial Forge build environment for Metorial Function Bay"',
      'curl -fsSL https://bun.sh/install | bash',
      'export PATH="$HOME/.bun/bin:$PATH"'
    ],
    actionScript: [
      'echo "Running build using Metorial Function Bay"',
      'bunx -y function-bay@latest'
    ],
    cleanupScript: []
  },

  {
    type: 'upload_artifact',
    name: 'Upload Manifest',
    artifactName: MANIFEST_ARTIFACT_NAME,
    artifactSourcePath: MANIFEST_PATH
  },
  {
    type: 'upload_artifact',
    name: 'Upload Files',
    artifactName: OUTPUT_ARTIFACT_NAME,
    artifactSourcePath: OUTPUT_ZIP_PATH
  }
];
