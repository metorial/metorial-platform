import {
  echoSystemMarker,
  renderBuildCommands,
  shellEscape,
  type ArtifactTarget,
  type BuildScriptRun
} from '../_lib/buildScript';

let IDENTITY_TOKEN_PATH = '/var/run/metorial/identity/token';
let TRUST_CA_PATH = '/var/run/metorial/trust/ca.crt';

// The token is re-read on every call because the kubelet rotates it during long builds.
// Artifact traffic goes straight to the cluster-manager, never through the egress proxy.
let PREAMBLE = `#!/usr/bin/env bash
export DEBIAN_FRONTEND=noninteractive

metorial_cluster_manager() {
  local ca=()
  if [ -f ${TRUST_CA_PATH} ]; then ca=(--cacert ${TRUST_CA_PATH}); fi
  curl -fsS --retry 5 --retry-connrefused --noproxy '*' "\${ca[@]}" \\
    -H "Authorization: Bearer $(cat ${IDENTITY_TOKEN_PATH})" "$@"
}

metorial_download_artifact() {
  metorial_cluster_manager -o "$2" "\${CLUSTER_MANAGER_POD_ADDR%/}/v1/builds/self/artifacts/$1"
}

metorial_upload_artifact() {
  metorial_cluster_manager -X PUT -H 'Content-Type: application/octet-stream' \\
    --upload-file "$2" "\${CLUSTER_MANAGER_POD_ADDR%/}/v1/builds/self/uploads/$1"
}

metorial_check() {
  if [ "$1" -ne 0 ]; then
    echo "Command failed with exit code $1" >&2
    exit "$1"
  fi
}`;

export type BuildDownload = { artifactId: string; bucket: string; key: string };

export type BuildUpload = { stepId: string; bucket: string; key: string };

export let renderKubernetesBuild = async (d: {
  run: BuildScriptRun;
  allocateUpload: (stepId: string) => Promise<ArtifactTarget>;
}) => {
  let downloads = new Map<string, BuildDownload>();
  let uploads: BuildUpload[] = [];

  let { commands, artifactData } = await renderBuildCommands(d.run, {
    runner: 'K8S/1',
    setupCommands: [],
    logSystem: echoSystemMarker,
    downloadArtifact: ({ artifact, outputPath }) => {
      downloads.set(artifact.id, {
        artifactId: artifact.id,
        bucket: artifact.bucket,
        key: artifact.storageKey
      });

      return `metorial_download_artifact ${shellEscape(artifact.id)} ${outputPath}`;
    },
    uploadArtifact: async ({ stepId, path }) => {
      let target = await d.allocateUpload(stepId);
      uploads.push({ stepId, bucket: target.bucket, key: target.storageKey });

      return {
        target,
        command: `metorial_upload_artifact ${shellEscape(stepId)} ${shellEscape(path)}`
      };
    }
  });

  // Each command is checked on its own, like a CodeBuild phase: `set -e` would ignore
  // failures inside `a && b` lists.
  let script = [PREAMBLE, ...commands.map(command => `${command}\nmetorial_check $?`)].join(
    '\n\n'
  );

  return {
    script: `${script}\n`,
    downloads: [...downloads.values()],
    uploads,
    artifactData
  };
};
