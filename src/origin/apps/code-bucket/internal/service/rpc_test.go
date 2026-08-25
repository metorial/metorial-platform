package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	rpc "github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestPruneBucketPathRejectsEmptyKeepPaths(t *testing.T) {
	// A prune always follows writes, so an empty keep set means a caller bug and
	// would otherwise empty the whole subtree. The nil fsm proves we reject
	// before touching storage.
	service := &RcpService{}

	_, err := service.PruneBucketPath(context.Background(), &rpc.PruneBucketPathRequest{
		BucketId: "bkt_1",
		Prefix:   "/plugins/acme",
	})

	if got := status.Code(err); got != codes.InvalidArgument {
		t.Fatalf("expected gRPC code InvalidArgument, got %s", got)
	}
}

func TestPruneBucketPathRequiresBucketId(t *testing.T) {
	service := &RcpService{}

	_, err := service.PruneBucketPath(context.Background(), &rpc.PruneBucketPathRequest{
		KeepPaths: []string{"/plugins/acme/plugin.json"},
	})

	if got := status.Code(err); got != codes.InvalidArgument {
		t.Fatalf("expected gRPC code InvalidArgument, got %s", got)
	}
}

func TestProviderExportErrorMapsProviderFailures(t *testing.T) {
	tests := []struct {
		name     string
		provider string
		message  string
		code     codes.Code
	}{
		{
			name:     "gitlab protected branch",
			provider: "GitLab",
			message:  `failed to create commit (status 403): {"message":"You are not allowed to push into this branch"}`,
			code:     codes.FailedPrecondition,
		},
		{
			name:     "github permission denied",
			provider: "GitHub",
			message:  `update reference failed (status 403): {"message":"Resource not accessible by integration"}`,
			code:     codes.PermissionDenied,
		},
		{
			name:     "bitbucket rate limited",
			provider: "Bitbucket Cloud",
			message:  `Bitbucket source upload failed (status 429): retry later`,
			code:     codes.ResourceExhausted,
		},
		{
			name:     "provider unavailable",
			provider: "GitLab",
			message:  `failed to create commit (status 503): service unavailable`,
			code:     codes.Unavailable,
		},
		{
			name:     "unknown failure",
			provider: "Bitbucket Data Center",
			message:  `unexpected git transport failure`,
			code:     codes.Internal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := providerExportError(tt.provider, errors.New(tt.message))
			if got := status.Code(err); got != tt.code {
				t.Fatalf("expected gRPC code %s, got %s", tt.code, got)
			}
			if !strings.Contains(status.Convert(err).Message(), tt.provider) {
				t.Fatalf("expected provider context in error: %v", err)
			}
		})
	}
}

func TestProviderImportErrorMapsRepositoryNotFound(t *testing.T) {
	err := providerImportError(
		"GitHub",
		errors.New("failed to download zip: bad status: 404 Not Found"),
	)
	if got := status.Code(err); got != codes.NotFound {
		t.Fatalf("expected gRPC code NotFound, got %s", got)
	}
	message := status.Convert(err).Message()
	if !strings.Contains(message, "GitHub") {
		t.Fatalf("expected provider context in error: %s", message)
	}
	if !strings.Contains(message, "404") {
		t.Fatalf("expected status in error: %s", message)
	}
}

func TestProviderExportErrorSanitizesCredentials(t *testing.T) {
	err := providerExportError(
		"GitLab",
		errors.New(`request failed (status 401): {"access_token":"secret"} authorization=other-secret Bearer abc.def`),
	)
	message := status.Convert(err).Message()

	if strings.Contains(message, "secret") || strings.Contains(message, "abc.def") {
		t.Fatalf("expected credentials to be redacted: %s", message)
	}
	if !strings.Contains(message, "[redacted]") {
		t.Fatalf("expected redaction marker: %s", message)
	}
}
