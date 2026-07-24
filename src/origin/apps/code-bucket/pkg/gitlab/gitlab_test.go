package gitlab

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
		42,
		"",
		"feature/a&b",
		"Update file",
		"token",
		server.URL,
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
		42,
		"",
		"main",
		"Update file",
		"token",
		server.URL,
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
