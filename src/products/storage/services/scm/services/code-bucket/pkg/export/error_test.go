package export

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func decodeStatus(t *testing.T, err error) (codes.Code, Payload) {
	t.Helper()

	st, ok := status.FromError(err)
	if !ok {
		t.Fatalf("%v is not a gRPC status error", err)
	}

	raw, found := strings.CutPrefix(st.Message(), StatusPrefix)
	if !found {
		t.Fatalf("status message %q doesn't start with %q", st.Message(), StatusPrefix)
	}

	var payload Payload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		t.Fatalf("status payload is not JSON: %v\n%s", err, raw)
	}
	return st.Code(), payload
}

func TestGRPCCodes(t *testing.T) {
	tests := map[Code]codes.Code{
		CodeManifestInvalid:      codes.InvalidArgument,
		CodeSourceNotFound:       codes.NotFound,
		CodeContentMismatch:      codes.FailedPrecondition,
		CodeDeletionGuardTripped: codes.FailedPrecondition,
		CodeTreeTooLarge:         codes.FailedPrecondition,
		CodeRateLimited:          codes.ResourceExhausted,
		CodeFileTooLarge:         codes.FailedPrecondition,
		CodeLFSQuotaExceeded:     codes.FailedPrecondition,
		CodeBranchMissing:        codes.FailedPrecondition,
		CodeDestinationTooLarge:  codes.FailedPrecondition,
		CodeUnimplemented:        codes.Unimplemented,
	}

	for code, want := range tests {
		t.Run(string(code), func(t *testing.T) {
			got, payload := decodeStatus(t, NewError(code, "boom"))
			if got != want || payload.Code != code || payload.Message != "boom" {
				t.Fatalf("got %v %+v", got, payload)
			}
		})
	}
}

func TestStatusCarriesProgress(t *testing.T) {
	retryAt := time.Unix(1_900_000_000, 0)
	err := &Error{
		Code:    CodeRateLimited,
		Message: "rate limited by GitHub",
		Progress: Progress{
			Stats:          Stats{FilesUploaded: 12, CommitsCreated: 3},
			CommitsCreated: 3,
			RetryAfter:     retryAt,
			NewRemoteState: &RemoteState{CommitSHA: "c", TreeSHA: "t", ListingBucket: "b", ListingKey: "k", EntryCount: 9},
			Lineage:        Lineage{StartHeadSHA: "s", LastCommitSHA: "l", ForeignCommits: true},
			WriteRequests:  7,
		},
	}

	_, payload := decodeStatus(t, err)
	if payload.Lineage != (Lineage{StartHeadSHA: "s", LastCommitSHA: "l", ForeignCommits: true}) || payload.WriteRequests != 7 {
		t.Fatalf("lineage or write requests lost: %+v", payload)
	}
	if payload.CommitsCreated != 3 || payload.RetryAfterUnix != retryAt.Unix() || payload.Stats.FilesUploaded != 12 {
		t.Fatalf("progress lost: %+v", payload)
	}
	if payload.NewRemoteState == nil || payload.NewRemoteState.ListingKey != "k" {
		t.Fatalf("remote state lost: %+v", payload.NewRemoteState)
	}
}

func TestStatusFitsTheMetadataBudget(t *testing.T) {
	paths := make([]string, 5000)
	for i := range paths {
		paths[i] = fmt.Sprintf("plugins/ünïcödé-%d/%s", i, strings.Repeat("é", 400))
	}

	err := DeletionGuardTripped(paths, len(paths), 6000, Guard{MaxUnexpectedDeletes: 250, MaxUnexpectedDeleteRatio: 0.1})
	err.Message = strings.Repeat("x", 10_000)

	message := err.StatusMessage()
	if n := percentEncodedLen(message); n > MaxStatusBytes {
		t.Fatalf("encoded status is %d bytes, budget %d", n, MaxStatusBytes)
	}

	_, payload := decodeStatus(t, err)
	if payload.Details.Total != len(paths) || payload.Details.UnexpectedDeletes != len(paths) {
		t.Fatalf("totals must survive trimming: %+v", payload.Details)
	}
	if len(payload.Details.Paths) > maxSamples {
		t.Fatalf("kept %d samples", len(payload.Details.Paths))
	}
}

func TestSmallDetailsAreKept(t *testing.T) {
	_, payload := decodeStatus(t, DeletionGuardTripped([]string{"a", "b"}, 2, 3, Guard{MaxUnexpectedDeletes: 1, MaxUnexpectedDeleteRatio: 0.5}))
	if strings.Join(payload.Details.Paths, ",") != "a,b" || payload.Details.ScopeEntries != 3 || payload.Details.MaxUnexpectedDeletes != 1 {
		t.Fatalf("details = %+v", payload.Details)
	}
}

func TestFromError(t *testing.T) {
	retryAt := time.Unix(1_900_000_000, 0)
	ref := manifest.Ref{Bucket: "files", Key: "skill-sync/manifests/x.ndjson"}

	tests := []struct {
		name    string
		err     error
		code    Code
		check   func(*testing.T, *Error)
		message string
	}{
		{
			name: "invalid manifest",
			err:  fmt.Errorf("open: %w", &manifest.InvalidError{Ref: ref, Line: 4, Path: "a/../b", Reason: "dot_segment"}),
			code: CodeManifestInvalid,
			check: func(t *testing.T, e *Error) {
				if e.Details.Line != 4 || e.Details.Path != "a/../b" || e.Details.Reason != "dot_segment" || e.Details.Key != ref.Key {
					t.Fatalf("details = %+v", e.Details)
				}
			},
		},
		{
			name: "missing source object",
			err:  &manifest.SourceNotFoundError{Bucket: "files", Key: "skill-sync/blobs/sha256/abc", Path: "a.md"},
			code: CodeSourceNotFound,
			check: func(t *testing.T, e *Error) {
				if len(e.Details.Keys) != 1 || e.Details.Paths[0] != "a.md" {
					t.Fatalf("details = %+v", e.Details)
				}
			},
		},
		{
			name: "content mismatch",
			err:  &manifest.ContentMismatchError{Path: "a.md", Key: "k", Reason: "git blob sha mismatch"},
			code: CodeContentMismatch,
		},
		{
			name: "rate limited",
			err:  &commitbatch.RateLimitedError{RetryAfter: retryAt, Err: errors.New("403 secondary rate limit")},
			code: CodeRateLimited,
			check: func(t *testing.T, e *Error) {
				if !e.Progress.RetryAfter.Equal(retryAt) || e.Progress.CommitsCreated != 2 {
					t.Fatalf("progress = %+v", e.Progress)
				}
			},
			message: "rate limit",
		},
		{
			name:    "branch missing",
			err:     fmt.Errorf("head: %w", commitbatch.ErrBranchMissing),
			code:    CodeBranchMissing,
			message: "branch not found",
		},
		{
			name:    "file too large",
			err:     filelimit.FileTooLargeError("GitHub export", "big.bin", 5<<30, 2<<30),
			code:    CodeFileTooLarge,
			message: "file exceeds the per-file size limit",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FromError(tt.err, Progress{CommitsCreated: 2})
			exportErr, ok := As(got)
			if !ok {
				t.Fatalf("%v was not mapped", got)
			}
			if exportErr.Code != tt.code {
				t.Fatalf("code = %s, want %s", exportErr.Code, tt.code)
			}
			if !errors.Is(got, tt.err) && !errors.Is(exportErr.Err, tt.err) {
				t.Fatal("the cause must stay in the chain")
			}
			if tt.message != "" && !strings.Contains(strings.ToLower(exportErr.Message), tt.message) {
				t.Fatalf("message %q lacks %q", exportErr.Message, tt.message)
			}
			if tt.check != nil {
				tt.check(t, exportErr)
			}
		})
	}

	plain := errors.New("connection reset")
	if FromError(plain, Progress{}) != plain {
		t.Fatal("unrecognized errors must pass through unchanged")
	}
	if FromError(nil, Progress{}) != nil {
		t.Fatal("nil must stay nil")
	}
}

func TestFromErrorKeepsExistingProgress(t *testing.T) {
	original := &Error{Code: CodeTreeTooLarge, Progress: Progress{CommitsCreated: 5}}
	got, _ := As(FromError(original, Progress{CommitsCreated: 1}))
	if got.Progress.CommitsCreated != 5 {
		t.Fatalf("progress overwritten: %+v", got.Progress)
	}

	bare := &Error{Code: CodeTreeTooLarge}
	got, _ = As(FromError(bare, Progress{CommitsCreated: 1}))
	if got.Progress.CommitsCreated != 1 {
		t.Fatalf("progress not filled in: %+v", got.Progress)
	}
}

func TestFileTooLargeKeepsLegacyMarker(t *testing.T) {
	err := FileTooLarge("assets/big.bin", 3<<30, 2<<30)
	if !strings.Contains(err.Message, filelimit.ErrFileTooLarge.Error()) {
		t.Fatalf("message %q lacks the legacy marker", err.Message)
	}
	if err.Details.Path != "assets/big.bin" || err.Details.Size != 3<<30 || err.Details.Limit != 2<<30 {
		t.Fatalf("details = %+v", err.Details)
	}
}

func TestGuardTripped(t *testing.T) {
	guard := Guard{MaxUnexpectedDeletes: 250, MaxUnexpectedDeleteRatio: 0.1}

	tests := []struct {
		name         string
		guard        Guard
		unexpected   int
		scopeEntries int
		want         bool
	}{
		{"under both", guard, 10, 1000, false},
		{"over count only", guard, 300, 10_000, false},
		{"over ratio only", guard, 200, 1000, false},
		{"over both", guard, 300, 1000, true},
		{"mass delete allowed", Guard{MaxUnexpectedDeletes: 250, MaxUnexpectedDeleteRatio: 0.1, AllowMassDelete: true}, 300, 1000, false},
		{"zero guard trips on any unexpected delete", Guard{}, 1, 1, true},
		{"zero guard allows none", Guard{}, 0, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.guard.Tripped(tt.unexpected, tt.scopeEntries); got != tt.want {
				t.Fatalf("Tripped(%d, %d) = %v, want %v", tt.unexpected, tt.scopeEntries, got, tt.want)
			}
		})
	}
}
