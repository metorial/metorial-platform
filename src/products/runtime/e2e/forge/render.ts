// Renders forge's Kubernetes build script for function-bay's knative workflow, mapping the
// workflow to run steps the way forge's workflowVersion/workflowRun services do.
// Input (stdin): { runId, source: { id, bucket, key }, uploadBucket, uploadPrefix }
// Output (stdout): { script, downloads, uploads, env }

import { renderKubernetesBuild } from '../../services/build/service/src/providers/kubernetes/script';
import {
  MANIFEST_PATH,
  OUTPUT_ZIP_PATH
} from '../../services/functions/service/src/providers/const';
import { workflow } from '../../services/functions/service/src/providers/knative/workflow';

let input = JSON.parse(await Bun.stdin.text());

let layer = {
  provider: 'knative',
  version: '2026-11-01',
  os: 'linux',
  osIdentifier: 'runtime-function-node24',
  arch: 'x86_64',
  identifier: 'function-bay::layer::runtime-e2e'
};

let steps = workflow.map((step, index) => ({
  id: `fwos_${index}`,
  step: {
    type: step.type,
    initScript: step.type == 'script' ? (step.initScript ?? []) : [],
    actionScript: step.type == 'script' ? step.actionScript : [],
    cleanupScript: step.type == 'script' ? (step.cleanupScript ?? []) : [],
    artifactToUploadName: step.type == 'upload_artifact' ? step.artifactName : null,
    artifactToUploadPath: step.type == 'upload_artifact' ? step.artifactSourcePath : null
  }
}));

let rendered = await renderKubernetesBuild({
  run: {
    artifacts: [
      {
        id: input.source.id,
        oid: 1n,
        name: 'files.zip',
        bucket: input.source.bucket,
        storageKey: input.source.key
      }
    ],
    setupStep: { id: 'fwos_setup' },
    teardownStep: { id: 'fwos_teardown' },
    initSteps: steps.filter(s => s.step.initScript.length),
    actionSteps: steps,
    cleanupSteps: steps.filter(s => s.step.cleanupScript.length)
  },
  allocateUpload: async stepId => ({
    bucket: input.uploadBucket,
    storageKey: `${input.uploadPrefix}/${stepId}`
  })
});

console.log(
  JSON.stringify({
    script: rendered.script,
    downloads: rendered.downloads,
    uploads: rendered.uploads,
    env: {
      METORIAL_FUNCTION_BAY_MANIFEST_DESTINATION: MANIFEST_PATH,
      METORIAL_FUNCTION_BAY_OUTPUT_DESTINATION: OUTPUT_ZIP_PATH,
      METORIAL_FUNCTION_BAY_BUILD_LAYER: JSON.stringify(layer),
      WORKFLOW_RUN_ID: input.runId,
      WORKFLOW_VERSION_ID: 'fwov_runtime_e2e',
      RUNTIME: 'kubernetes'
    }
  })
);
