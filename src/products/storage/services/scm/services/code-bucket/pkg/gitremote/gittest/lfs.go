package gittest

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// LFSServer is a minimal Git LFS batch API with basic transfers.
type LFSServer struct {
	*httptest.Server

	mu      sync.Mutex
	objects map[string][]byte
	auth    []string
	batches int
}

func NewLFSServer(t testing.TB) *LFSServer {
	s := &LFSServer{objects: map[string][]byte{}}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /info/lfs/objects/batch", s.batch)
	mux.HandleFunc("PUT /upload/{oid}", s.upload)
	s.Server = httptest.NewServer(mux)
	t.Cleanup(s.Close)
	return s
}

func (s *LFSServer) Endpoint() string { return s.URL + "/info/lfs" }

func (s *LFSServer) batch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Operation string `json:"operation"`
		Objects   []struct {
			OID  string `json:"oid"`
			Size int64  `json:"size"`
		} `json:"objects"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	s.batches++
	s.auth = append(s.auth, r.Header.Get("Authorization"))
	objects := []map[string]any{}
	for _, object := range req.Objects {
		entry := map[string]any{"oid": object.OID, "size": object.Size}
		if _, ok := s.objects[object.OID]; !ok {
			entry["actions"] = map[string]any{"upload": map[string]any{"href": s.URL + "/upload/" + object.OID}}
		}
		objects = append(objects, entry)
	}
	s.mu.Unlock()

	w.Header().Set("Content-Type", "application/vnd.git-lfs+json")
	_ = json.NewEncoder(w).Encode(map[string]any{"transfer": "basic", "objects": objects})
}

func (s *LFSServer) upload(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	sum := sha256.Sum256(data)
	if oid := r.PathValue("oid"); hex.EncodeToString(sum[:]) != oid {
		http.Error(w, "oid mismatch", http.StatusUnprocessableEntity)
		return
	}

	s.mu.Lock()
	s.objects[r.PathValue("oid")] = data
	s.mu.Unlock()
	w.WriteHeader(http.StatusOK)
}

func (s *LFSServer) Object(oid string) ([]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, ok := s.objects[oid]
	return data, ok
}

// Authorizations returns the Authorization header of every batch request.
func (s *LFSServer) Authorizations() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.auth...)
}

func (s *LFSServer) Batches() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.batches
}

// PointerOID returns the oid of an LFS pointer file's content, or "".
func PointerOID(content string) string {
	for _, line := range strings.Split(content, "\n") {
		if oid, ok := strings.CutPrefix(line, "oid sha256:"); ok {
			return oid
		}
	}
	return ""
}
