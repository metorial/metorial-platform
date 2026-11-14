package access

import (
	"errors"
	"testing"
)

func TestBucketAllowlists(t *testing.T) {
	b := NewBuckets([]string{"artifacts", "function-bay-bundles"}, []string{"function-bay-bundles"}, []string{"artifacts"}, []string{"artifacts", "build-cache"})

	cases := []struct {
		use    Use
		bucket string
		ok     bool
	}{
		{UseFunctionsImport, "artifacts", true},
		{UseFunctionsImport, "function-bay-bundles", true},
		{UseFunctionsImport, "secrets", false},
		{UseFunctionsBundle, "function-bay-bundles", true},
		{UseFunctionsBundle, "artifacts", false},
		{UseBuildDownload, "artifacts", true},
		{UseBuildDownload, "build-cache", false},
		{UseBuildUpload, "build-cache", true},
		{UseBuildUpload, "function-bay-bundles", false},
		{UseBuildUpload, "", false},
		{Use("unknown"), "artifacts", false},
	}
	for _, c := range cases {
		err := b.Check(c.use, c.bucket)
		if (err == nil) != c.ok {
			t.Errorf("%s/%q: got %v", c.use, c.bucket, err)
		}
		var notAllowed *ObjectNotAllowedError
		if err != nil && (!errors.As(err, &notAllowed) || notAllowed.Bucket != c.bucket) {
			t.Errorf("%s/%q: unexpected error type %T", c.use, c.bucket, err)
		}
	}
}

func TestMethodAllowed(t *testing.T) {
	cases := []struct {
		caller Caller
		method string
		ok     bool
	}{
		{CallerFunctions, "function:ensure", true},
		{CallerFunctions, "function:invoke", true},
		{CallerFunctions, "bundle:import", true},
		{CallerFunctions, "build:start", false},
		{CallerBuild, "build:start", true},
		{CallerBuild, "build:logs", true},
		{CallerBuild, "function:invoke", false},
		{CallerBuild, "bundle:import", false},
		{CallerInsecure, "build:start", true},
		{Caller(""), "function:list", false},
		{CallerFunctions, "functionx:list", false},
	}
	for _, c := range cases {
		if got := MethodAllowed(c.caller, c.method); got != c.ok {
			t.Errorf("%s calling %s: got %v", c.caller, c.method, got)
		}
	}
}
