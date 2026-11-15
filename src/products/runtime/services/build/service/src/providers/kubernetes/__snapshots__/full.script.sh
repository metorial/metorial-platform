#!/usr/bin/env bash
export DEBIAN_FRONTEND=noninteractive

metorial_cluster_manager() {
  local ca=()
  if [ -f /var/run/metorial/trust/ca.crt ]; then ca=(--cacert /var/run/metorial/trust/ca.crt); fi
  curl -fsS --retry 5 --retry-connrefused --noproxy '*' "${ca[@]}" \
    -H "Authorization: Bearer $(cat /var/run/metorial/identity/token)" "$@"
}

metorial_download_artifact() {
  metorial_cluster_manager -o "$2" "${CLUSTER_MANAGER_POD_ADDR%/}/v1/builds/self/artifacts/$1"
}

metorial_upload_artifact() {
  metorial_cluster_manager -X PUT -H 'Content-Type: application/octet-stream' \
    --upload-file "$2" "${CLUSTER_MANAGER_POD_ADDR%/}/v1/builds/self/uploads/$1"
}

metorial_check() {
  if [ "$1" -ne 0 ]; then
    echo "Command failed with exit code $1" >&2
    exit "$1"
  fi
}

echo 'X@%%MT0RL-)AL:: {"type":"build.start"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_setup"}'
metorial_check $?

echo "Started build on Metorial Forge (runner: K8S/1) ..."
metorial_check $?

echo "Setting up build environment ..."
metorial_check $?

mkdir -p ./forge
metorial_check $?

cd ./forge
metorial_check $?

mkdir -p ./output
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"download-artifacts.start"}'
metorial_check $?

echo "Downloading initial files ..."
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"download-artifact.start","artifactId":"fwoa_1"}'
metorial_check $?

metorial_download_artifact 'fwoa_1' /tmp/artifact_1.zip
metorial_check $?

unzip -o /tmp/artifact_1.zip -d ./
metorial_check $?

rm /tmp/artifact_1.zip
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"download-artifact.end","artifactId":"fwoa_1"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"download-artifacts.end"}'
metorial_check $?

echo "Build environment setup complete."
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_setup"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_init"}'
metorial_check $?

echo init
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_init"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_build"}'
metorial_check $?

echo building
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_build"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_dl"}'
metorial_check $?

echo "Downloading artifact bundle.tar ..."
metorial_check $?

metorial_download_artifact 'fwoa_2' /tmp/artifact_2
metorial_check $?

mv /tmp/artifact_2 './it'\''s bundle.tar'
metorial_check $?

echo "Download complete."
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_dl"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_dl_again"}'
metorial_check $?

echo "Downloading artifact bundle.tar ..."
metorial_check $?

metorial_download_artifact 'fwoa_2' /tmp/artifact_2
metorial_check $?

mv /tmp/artifact_2 './copy.tar'
metorial_check $?

echo "Download complete."
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_dl_again"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_up"}'
metorial_check $?

echo "Uploading artifact output.zip from ./output/out file.zip ..."
metorial_check $?

metorial_upload_artifact 'fwos_up' './output/out file.zip'
metorial_check $?

echo "Upload complete."
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"upload-artifact.register","stepId":"fwos_up"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_up"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_cleanup"}'
metorial_check $?

echo "No action"
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_cleanup"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.start","stepId":"fwos_teardown"}'
metorial_check $?

echo "Tearing down build environment ..."
metorial_check $?

echo "Build complete ... powered by Metorial Forge (K8S/1)."
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"step.end","stepId":"fwos_teardown"}'
metorial_check $?

echo 'X@%%MT0RL-)AL:: {"type":"build.end"}'
metorial_check $?
