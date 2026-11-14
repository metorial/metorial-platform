package github

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

var recordedSleeps []time.Duration

func init() {
	sleepFn = func(ctx context.Context, d time.Duration) error {
		recordedSleeps = append(recordedSleeps, d)
		return ctx.Err()
	}
}

func TestGithubJSONRetriesSecondaryRateLimit(t *testing.T) {
	recordedSleeps = nil
	var calls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) < 3 {
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"message":"You have exceeded a secondary rate limit."}`))
			return
		}
		_, _ = w.Write([]byte(`{"sha":"abc"}`))
	}))
	defer server.Close()

	out, err := githubJSON[githubCreateBlobResponse](
		context.Background(), "POST", server.URL, "token", githubCreateBlobRequest{Content: "x"},
	)
	if err != nil {
		t.Fatalf("expected success after retries, got %v", err)
	}
	if out.SHA != "abc" || calls != 3 {
		t.Fatalf("unexpected result sha=%s calls=%d", out.SHA, calls)
	}
	for _, d := range recordedSleeps {
		if d < minRateLimitBackoff {
			t.Fatalf("expected backoff of at least %s, got %s", minRateLimitBackoff, d)
		}
	}
}

func TestGithubJSONHonorsRetryAfter(t *testing.T) {
	recordedSleeps = nil
	var calls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&calls, 1) == 1 {
			w.Header().Set("Retry-After", "90")
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"message":"secondary rate limit"}`))
			return
		}
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()

	if _, err := githubJSON[githubCreateBlobResponse](context.Background(), "GET", server.URL, "token", nil); err != nil {
		t.Fatal(err)
	}
	if len(recordedSleeps) != 1 || recordedSleeps[0] != 90*time.Second {
		t.Fatalf("expected one 90s sleep, got %v", recordedSleeps)
	}
}

func TestGithubJSONDoesNotRetryPlainForbidden(t *testing.T) {
	var calls int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"message":"Resource not accessible by integration"}`))
	}))
	defer server.Close()

	if _, err := githubJSON[githubCreateBlobResponse](context.Background(), "GET", server.URL, "token", nil); err == nil {
		t.Fatal("expected error")
	}
	if calls != 1 {
		t.Fatalf("expected a single call, got %d", calls)
	}
}

func TestUploadBatchesInlineTextAndBlobsBinary(t *testing.T) {
	fake := newFakeGitHub(t)

	files := make([]FileToUpload, 0, maxTreeBatchEntries+3)
	for i := 0; i < maxTreeBatchEntries+1; i++ {
		files = append(files, ContentFile(fmt.Sprintf("skills/%d.md", i), []byte("text")))
	}
	files = append(files, ContentFile("assets/logo.bin", []byte{0x00, 0x01, 0x02}))
	files = append(files, ContentFile("empty.txt", []byte{}))

	if err := UploadToRepo(context.Background(), fake.uploadOptions(), files); err != nil {
		t.Fatalf("upload: %v", err)
	}

	if fake.blobPosts != 2 {
		t.Fatalf("expected only the binary and empty file as blobs, got %d", fake.blobPosts)
	}
	if len(fake.treeBatches) != 2 {
		t.Fatalf("expected two tree requests, got %d", len(fake.treeBatches))
	}
	if fake.treeBatches[0].BaseTree != baseTreeSHA || fake.treeBatches[1].BaseTree != "newtree" {
		t.Fatalf("expected chained base trees, got %q then %q", fake.treeBatches[0].BaseTree, fake.treeBatches[1].BaseTree)
	}
	if fake.commits != 1 {
		t.Fatalf("expected a single commit, got %d", fake.commits)
	}
}
