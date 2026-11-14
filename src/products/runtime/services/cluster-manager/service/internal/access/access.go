package access

import (
	"fmt"
	"slices"
	"strings"
)

type Caller string

const (
	CallerFunctions Caller = "functions"
	CallerBuild     Caller = "build"
	CallerInsecure  Caller = "insecure-dev"
)

type Use string

const (
	UseFunctionsImport Use = "functions-import"
	UseFunctionsBundle Use = "functions-bundle"
	UseBuildDownload   Use = "build-download"
	UseBuildUpload     Use = "build-upload"
)

type ObjectNotAllowedError struct {
	Bucket string
	Use    Use
}

func (e *ObjectNotAllowedError) Error() string {
	return fmt.Sprintf("bucket %q is not allowed for %s", e.Bucket, e.Use)
}

type Buckets struct {
	allowed map[Use][]string
}

func NewBuckets(functionsImport, functionsBundle, buildDownload, buildUpload []string) *Buckets {
	return &Buckets{allowed: map[Use][]string{
		UseFunctionsImport: functionsImport,
		UseFunctionsBundle: functionsBundle,
		UseBuildDownload:   buildDownload,
		UseBuildUpload:     buildUpload,
	}}
}

func (b *Buckets) Check(use Use, bucket string) error {
	if bucket == "" || !slices.Contains(b.allowed[use], bucket) {
		return &ObjectNotAllowedError{Bucket: bucket, Use: use}
	}
	return nil
}

// MethodAllowed is the control-API authorization table (PLAN section 6.2).
func MethodAllowed(caller Caller, method string) bool {
	switch caller {
	case CallerInsecure:
		return true
	case CallerFunctions:
		return strings.HasPrefix(method, "bundle:") || strings.HasPrefix(method, "function:")
	case CallerBuild:
		return strings.HasPrefix(method, "build:")
	default:
		return false
	}
}
