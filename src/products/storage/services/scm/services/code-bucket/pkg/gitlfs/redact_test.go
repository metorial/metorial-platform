package gitlfs

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

const secretQuery = "X-Amz-Signature=topsecret"

// actionServer answers the batch API with the given upload and verify hrefs and
// records the Authorization header of every verify request.
type actionServer struct {
	srv *httptest.Server

	mu         sync.Mutex
	verifyAuth []string
}

func newActionServer(t *testing.T, actions func(lfs, other *httptest.Server) map[string]any, other *httptest.Server) *actionServer {
	s := &actionServer{}
	mux := http.NewServeMux()
	mux.HandleFunc("/info/lfs/objects/batch", func(w http.ResponseWriter, r *http.Request) {
		var req batchRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		_ = json.NewEncoder(w).Encode(map[string]any{"objects": []map[string]any{{
			"oid": req.Objects[0].OID, "size": req.Objects[0].Size, "actions": actions(s.srv, other),
		}}})
	})
	mux.HandleFunc("/storage", func(w http.ResponseWriter, r *http.Request) {})
	mux.HandleFunc("/verify", s.recordVerify)
	s.srv = httptest.NewServer(mux)
	t.Cleanup(s.srv.Close)
	return s
}

func (s *actionServer) recordVerify(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.verifyAuth = append(s.verifyAuth, r.Header.Get("Authorization"))
}

func TestVerifySendsCredentialsOnlyToTheLFSHost(t *testing.T) {
	tests := []struct {
		name       string
		onOther    bool
		header     map[string]string
		wantPrefix string
	}{
		{name: "same host gets the client credentials", wantPrefix: "Basic "},
		{name: "another host gets no credentials", onOther: true},
		{name: "another host gets only the action's own header", onOther: true, header: map[string]string{"Authorization": "RemoteAuth abc"}, wantPrefix: "RemoteAuth abc"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			other := &actionServer{}
			otherMux := http.NewServeMux()
			otherMux.HandleFunc("/verify", other.recordVerify)
			other.srv = httptest.NewServer(otherMux)
			t.Cleanup(other.srv.Close)

			lfs := newActionServer(t, func(lfs, o *httptest.Server) map[string]any {
				verifyHost := lfs
				if tt.onOther {
					verifyHost = o
				}
				return map[string]any{
					"upload": map[string]any{"href": lfs.URL + "/storage"},
					"verify": map[string]any{"href": verifyHost.URL + "/verify", "header": tt.header},
				}
			}, other.srv)

			client := NewClient(lfs.srv.URL+"/info/lfs", "", "token", lfs.srv.Client())
			if _, err := client.UploadBatch(context.Background(), "", []BatchObject{objectFor([]byte("content"), nil)}); err != nil {
				t.Fatal(err)
			}

			recorded := lfs.verifyAuth
			if tt.onOther {
				recorded = other.verifyAuth
			}
			if len(recorded) != 1 {
				t.Fatalf("verify requests = %d, want 1", len(recorded))
			}
			if got := recorded[0]; (tt.wantPrefix == "" && got != "") || !strings.HasPrefix(got, tt.wantPrefix) {
				t.Fatalf("Authorization = %q, want prefix %q", got, tt.wantPrefix)
			}
		})
	}
}

func TestErrorsDoNotEchoActionHrefs(t *testing.T) {
	tests := []struct {
		name   string
		upload func(lfs *httptest.Server, closed string) string
	}{
		{
			name: "error status with the href in the body",
			upload: func(lfs *httptest.Server, closed string) string {
				return lfs.URL + "/reject?" + secretQuery
			},
		},
		{
			name: "transport failure",
			upload: func(lfs *httptest.Server, closed string) string {
				return strings.Replace(closed, "http://", "http://user:hunter2@", 1) + "/storage?" + secretQuery
			},
		},
	}

	closed := httptest.NewServer(http.NotFoundHandler())
	closedURL := closed.URL
	closed.Close()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var lfs *httptest.Server
			mux := http.NewServeMux()
			mux.HandleFunc("/info/lfs/objects/batch", func(w http.ResponseWriter, r *http.Request) {
				var req batchRequest
				_ = json.NewDecoder(r.Body).Decode(&req)
				_ = json.NewEncoder(w).Encode(map[string]any{"objects": []map[string]any{{
					"oid": req.Objects[0].OID, "size": req.Objects[0].Size,
					"actions": map[string]any{"upload": map[string]any{"href": tt.upload(lfs, closedURL)}},
				}}})
			})
			mux.HandleFunc("/reject", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte("<Error>bad request for " + "http://" + r.Host + r.URL.String() + "</Error>"))
			})
			lfs = httptest.NewServer(mux)
			t.Cleanup(lfs.Close)

			client := NewClient(lfs.URL+"/info/lfs", "", "token", lfs.Client())
			_, err := client.UploadBatch(context.Background(), "", []BatchObject{objectFor([]byte("content"), nil)})
			if err == nil {
				t.Fatal("expected the upload to fail")
			}
			for _, secret := range []string{"topsecret", "hunter2", "X-Amz-Signature"} {
				if strings.Contains(err.Error(), secret) {
					t.Fatalf("error leaks %q: %v", secret, err)
				}
			}
		})
	}
}
