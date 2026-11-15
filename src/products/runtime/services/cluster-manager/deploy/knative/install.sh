#!/usr/bin/env bash
# Installs the pinned Knative Serving + Kourier release into the current kubectl context and
# applies the configuration the runtime system requires (PLAN.md section 10).
#
#   ./install.sh                  # uses the current context
#   KUBE_CONTEXT=orbstack ./install.sh
#   KOURIER_SERVICE_TYPE=LoadBalancer ./install.sh   # expose the external gateway (default ClusterIP)

set -euo pipefail

KNATIVE_VERSION="knative-v1.24.0"
MAX_REVISION_TIMEOUT_SECONDS="${MAX_REVISION_TIMEOUT_SECONDS:-1200}"
KOURIER_SERVICE_TYPE="${KOURIER_SERVICE_TYPE:-ClusterIP}"

dir="$(cd "$(dirname "$0")" && pwd)"
manifests="$dir/manifests"

kubectl_args=()
if [[ -n "${KUBE_CONTEXT:-}" ]]; then
  kubectl_args+=(--context "$KUBE_CONTEXT")
fi

k() {
  kubectl "${kubectl_args[@]}" "$@"
}

verify() {
  local file="$1" sums="$2"
  local expected actual
  expected="$(awk -v f="$file" '$2 == f { print $1 }' "$manifests/$sums")"
  actual="$(shasum -a 256 "$manifests/$file" | awk '{ print $1 }')"
  if [[ -z "$expected" || "$expected" != "$actual" ]]; then
    echo "checksum mismatch for $file (expected '$expected', got '$actual')" >&2
    exit 1
  fi
}

verify serving-crds.yaml serving-checksums.txt
verify serving-core.yaml serving-checksums.txt
verify kourier.yaml kourier-checksums.txt

echo "Installing Knative Serving $KNATIVE_VERSION into context $(k config current-context)"

k apply -f "$manifests/serving-crds.yaml"
k wait --for=condition=Established --timeout=120s crd/services.serving.knative.dev
k apply -f "$manifests/serving-core.yaml"
k apply -f "$manifests/kourier.yaml"

k -n knative-serving patch configmap/config-network --type merge -p \
  '{"data":{"ingress-class":"kourier.ingress.networking.knative.dev"}}'

k -n knative-serving patch configmap/config-features --type merge -p '{"data":{
  "kubernetes.podspec-runtimeclassname":"enabled",
  "kubernetes.podspec-volumes-emptydir":"enabled",
  "secure-pod-defaults":"enabled"
}}'

k -n knative-serving patch configmap/config-autoscaler --type merge -p \
  '{"data":{"allow-zero-initial-scale":"true"}}'

k -n knative-serving patch configmap/config-defaults --type merge -p "{\"data\":{
  \"max-revision-timeout-seconds\":\"$MAX_REVISION_TIMEOUT_SECONDS\"
}}"

# The activator must outlive the longest request it may be proxying when it drains.
k -n knative-serving patch deployment/activator --type merge -p "{\"spec\":{\"template\":{\"spec\":{
  \"terminationGracePeriodSeconds\":$MAX_REVISION_TIMEOUT_SECONDS
}}}}"

k -n kourier-system patch service/kourier --type merge -p "{\"spec\":{\"type\":\"$KOURIER_SERVICE_TYPE\"}}"

for deployment in activator autoscaler controller webhook net-kourier-controller; do
  k -n knative-serving rollout status "deployment/$deployment" --timeout=300s
done
k -n kourier-system rollout status deployment/3scale-kourier-gateway --timeout=300s

echo "Knative Serving $KNATIVE_VERSION with Kourier is ready"
