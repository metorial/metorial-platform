package kube

import (
	"crypto/sha256"
	"encoding/base32"
	"strings"
)

const (
	LabelFunctionID = "runtime.metorial.com/function-id"
	LabelVersionID  = "runtime.metorial.com/version-id"
	LabelTenantID   = "runtime.metorial.com/tenant-id"
	LabelBuildID    = "runtime.metorial.com/build-id"
	LabelComponent  = "runtime.metorial.com/component"
	LabelManagedBy  = "app.kubernetes.io/managed-by"

	AnnotationLastInvokedAt      = "runtime.metorial.com/last-invoked-at"
	AnnotationMaterializedReason = "runtime.metorial.com/materialized-reason"
	AnnotationBundleBucket       = "runtime.metorial.com/bundle-bucket"
	AnnotationBundleKey          = "runtime.metorial.com/bundle-key"
	AnnotationRunID              = "runtime.metorial.com/run-id"
	AnnotationUploadPrefix       = "uploads.runtime.metorial.com/"

	ManagedBy = "runtime-cluster-manager"

	ComponentFunction  = "function"
	ComponentBuild     = "build"
	ComponentPreflight = "preflight"
)

var nameEncoding = base32.StdEncoding.WithPadding(base32.NoPadding)

func hashSuffix(id string) string {
	sum := sha256.Sum256([]byte(id))
	return strings.ToLower(nameEncoding.EncodeToString(sum[:]))[:20]
}

func FunctionName(versionID string) string {
	return "fn-" + hashSuffix(versionID)
}

func FunctionEnvSecretName(versionID string) string {
	return FunctionName(versionID) + "-env"
}

func BuildName(runID string) string {
	return "build-" + hashSuffix(runID)
}

func UploadAnnotation(stepID string) string {
	return AnnotationUploadPrefix + hashSuffix(stepID)
}

// FunctionHost is the cluster-local host Knative routes for a Service.
func FunctionHost(name, namespace string) string {
	return name + "." + namespace + ".svc.cluster.local"
}
