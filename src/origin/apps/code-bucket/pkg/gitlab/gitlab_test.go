package gitlab

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestUploadToRepoEscapesFilePathAndBranch(t *testing.T) {
	existingContent := sha256.Sum256([]byte("old"))
	var commit gitlabCommitRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if r.URL.Path != "/projects/42/repository/files/docs/a#b?.txt" {
				t.Errorf("unexpected file path: %q", r.URL.Path)
			}
			if r.URL.Query().Get("ref") != "feature/a&b" {
				t.Errorf("unexpected ref: %q", r.URL.Query().Get("ref"))
			}
			_, _ = fmt.Fprintf(w, `{"content_sha256":%q}`, hex.EncodeToString(existingContent[:]))
		case http.MethodPost:
			if err := json.NewDecoder(r.Body).Decode(&commit); err != nil {
				t.Fatalf("decode commit: %v", err)
			}
			w.WriteHeader(http.StatusCreated)
		default:
			t.Fatalf("unexpected method: %s", r.Method)
		}
	}))
	defer server.Close()

	err := UploadToRepo(
		UploadOptions{
			ProjectID:     42,
			Branch:        "feature/a&b",
			CommitMessage: "Update file",
			Token:         "token",
			GitlabAPIURL:  server.URL,
		},
		[]FileToUpload{{Path: "docs/a#b?.txt", Content: []byte("new")}},
	)
	if err != nil {
		t.Fatalf("upload repository: %v", err)
	}
	if len(commit.Actions) != 1 || commit.Actions[0].Action != "update" {
		t.Fatalf("expected one update action, got %#v", commit.Actions)
	}
}

func TestUploadToRepoRetriesCreateAsUpdateAfterConflict(t *testing.T) {
	fileGets := 0
	commits := 0
	var retriedCommit gitlabCommitRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			fileGets++
			if fileGets == 1 {
				http.NotFound(w, r)
				return
			}
			_, _ = fmt.Fprint(w, `{"content_sha256":"different"}`)
		case http.MethodPost:
			commits++
			if commits == 1 {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = fmt.Fprint(w, `{"message":"A file with this name already exists"}`)
				return
			}
			if err := json.NewDecoder(r.Body).Decode(&retriedCommit); err != nil {
				t.Fatalf("decode retried commit: %v", err)
			}
			w.WriteHeader(http.StatusCreated)
		default:
			t.Fatalf("unexpected method: %s", r.Method)
		}
	}))
	defer server.Close()

	err := UploadToRepo(
		UploadOptions{
			ProjectID:     42,
			Branch:        "main",
			CommitMessage: "Update file",
			Token:         "token",
			GitlabAPIURL:  server.URL,
		},
		[]FileToUpload{{Path: "file.txt", Content: []byte("new")}},
	)
	if err != nil {
		t.Fatalf("upload repository: %v", err)
	}
	if commits != 2 {
		t.Fatalf("expected two commit attempts, got %d", commits)
	}
	if len(retriedCommit.Actions) != 1 || retriedCommit.Actions[0].Action != "update" {
		t.Fatalf("expected retried action to be update, got %#v", retriedCommit.Actions)
	}
}

// gitlabRepo serves file metadata for a fixed set of existing paths and records
// the commit it receives.
func gitlabRepo(t *testing.T, existing map[string]string) (*httptest.Server, *gitlabCommitRequest) {
	t.Helper()

	var commit gitlabCommitRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			filePath := strings.TrimPrefix(r.URL.Path, "/projects/42/repository/files/")
			content, exists := existing[filePath]
			if !exists {
				http.NotFound(w, r)
				return
			}
			sum := sha256.Sum256([]byte(content))
			_, _ = fmt.Fprintf(w, `{"content_sha256":%q}`, hex.EncodeToString(sum[:]))
		case http.MethodPost:
			if err := json.NewDecoder(r.Body).Decode(&commit); err != nil {
				t.Fatalf("decode commit: %v", err)
			}
			w.WriteHeader(http.StatusCreated)
		default:
			t.Fatalf("unexpected method: %s", r.Method)
		}
	}))
	t.Cleanup(server.Close)

	return server, &commit
}

func TestUploadToRepoDeletesRequestedPath(t *testing.T) {
	server, commit := gitlabRepo(t, map[string]string{"gone.md": "old"})

	err := UploadToRepo(
		UploadOptions{
			ProjectID:     42,
			CommitMessage: "Sync",
			Token:         "token",
			GitlabAPIURL:  server.URL,
			DeletePaths:   []string{"gone.md"},
		},
		nil,
	)
	if err != nil {
		t.Fatalf("upload repository: %v", err)
	}

	if len(commit.Actions) != 1 {
		t.Fatalf("expected one action, got %#v", commit.Actions)
	}
	if commit.Actions[0].Action != "delete" || commit.Actions[0].FilePath != "gone.md" {
		t.Fatalf("expected a delete action for gone.md, got %#v", commit.Actions[0])
	}
}

func TestUploadToRepoSkipsDeleteForMissingPath(t *testing.T) {
	server, commit := gitlabRepo(t, map[string]string{})

	err := UploadToRepo(
		UploadOptions{
			ProjectID:     42,
			CommitMessage: "Sync",
			Token:         "token",
			GitlabAPIURL:  server.URL,
			DeletePaths:   []string{"never-existed.md"},
		},
		nil,
	)
	if err != nil {
		t.Fatalf("upload repository: %v", err)
	}

	// Deleting a path GitLab does not have fails the whole commit, so it must
	// not be sent at all.
	if len(commit.Actions) != 0 {
		t.Fatalf("expected no commit actions, got %#v", commit.Actions)
	}
}

func TestUploadToRepoKeepsPathThatIsStillExported(t *testing.T) {
	server, commit := gitlabRepo(t, map[string]string{"a.md": "same"})

	err := UploadToRepo(
		UploadOptions{
			ProjectID:     42,
			CommitMessage: "Sync",
			Token:         "token",
			GitlabAPIURL:  server.URL,
			DeletePaths:   []string{"a.md"},
		},
		[]FileToUpload{{Path: "a.md", Content: []byte("same")}},
	)
	if err != nil {
		t.Fatalf("upload repository: %v", err)
	}

	// The file is unchanged so nothing is written for it, but it is still part
	// of the export and a stale deletion must not remove it.
	if len(commit.Actions) != 0 {
		t.Fatalf("expected no commit actions, got %#v", commit.Actions)
	}
}

func TestReconcileActionsDropsSatisfiedDelete(t *testing.T) {
	server, _ := gitlabRepo(t, map[string]string{})

	reconciled, err := reconcileActions(
		&http.Client{},
		42,
		"main",
		"token",
		server.URL,
		[]gitlabFileAction{{Action: "delete", FilePath: "gone.md"}},
	)
	if err != nil {
		t.Fatalf("reconcile actions: %v", err)
	}

	// Rewriting a delete into a create would restore the file with the action's
	// empty content.
	if len(reconciled) != 0 {
		t.Fatalf("expected the delete to be dropped, got %#v", reconciled)
	}
}

func TestReconcileActionsKeepsPendingDelete(t *testing.T) {
	server, _ := gitlabRepo(t, map[string]string{"gone.md": "old"})

	reconciled, err := reconcileActions(
		&http.Client{},
		42,
		"main",
		"token",
		server.URL,
		[]gitlabFileAction{{Action: "delete", FilePath: "gone.md"}},
	)
	if err != nil {
		t.Fatalf("reconcile actions: %v", err)
	}

	if len(reconciled) != 1 || reconciled[0].Action != "delete" {
		t.Fatalf("expected the delete to be kept, got %#v", reconciled)
	}
}

func TestGetFileInfoRetriesTransientTransportErrors(t *testing.T) {
	attempts := 0
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			attempts++
			if attempts == 1 {
				return nil, errors.New("http2: server sent GOAWAY and closed the connection; ErrCode=ENHANCE_YOUR_CALM")
			}

			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"content_sha256":"abc123"}`)),
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	}

	info, err := getFileInfoWithRetry(client, 42, "file.txt", "main", "token", "https://gitlab.test/api/v4", func(int) {})
	if err != nil {
		t.Fatalf("get file info: %v", err)
	}
	if attempts != 2 {
		t.Fatalf("expected two attempts, got %d", attempts)
	}
	if !info.Exists || info.ContentSHA256 != "abc123" {
		t.Fatalf("unexpected file info: %#v", info)
	}
}
