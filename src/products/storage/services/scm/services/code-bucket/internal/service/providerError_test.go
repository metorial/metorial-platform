package service

import (
	"errors"
	"fmt"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// An oversized file is the caller's to fix. Reporting it as Internal made
// callers treat it as a transient fault and retry a file that could never fit.
func TestOversizedFileIsReportedAsFailedPrecondition(t *testing.T) {
	err := filelimit.FileTooLargeError("GitHub", "assets/big.bin", 4<<30, 2<<30)

	if got := status.Code(providerExportError("GitHub", err)); got != codes.FailedPrecondition {
		t.Fatalf("export code = %s, want FailedPrecondition", got)
	}
	if got := status.Code(providerImportError("GitHub", err)); got != codes.FailedPrecondition {
		t.Fatalf("import code = %s, want FailedPrecondition", got)
	}
}

// The sentinel has to survive the wrapping the exporters add on the way out.
func TestOversizedFileIsClassifiedThroughWrapping(t *testing.T) {
	wrapped := fmt.Errorf(
		"failed to commit: %w",
		filelimit.FileTooLargeError("GitLab", "big.bin", 1<<30, 64<<20),
	)

	if got := status.Code(providerExportError("GitLab", wrapped)); got != codes.FailedPrecondition {
		t.Fatalf("code = %s, want FailedPrecondition", got)
	}
}

func TestProviderErrorStillReadsHTTPStatusFromTheMessage(t *testing.T) {
	for _, tc := range []struct {
		message string
		want    codes.Code
	}{
		{"failed to create commit (status 403): not allowed to push", codes.PermissionDenied},
		{"failed to create commit (status 401): bad credentials", codes.Unauthenticated},
		{"failed to create commit (status 503): upstream down", codes.Unavailable},
		{"connection reset by peer", codes.Internal},
	} {
		got := status.Code(providerExportError("GitLab", errors.New(tc.message)))
		if got != tc.want {
			t.Errorf("%q: code = %s, want %s", tc.message, got, tc.want)
		}
	}
}
