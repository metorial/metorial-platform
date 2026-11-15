package gitlfs

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
)

func init() { transferRetryInterval = 0 }

type batchServer struct {
	t   *testing.T
	srv *httptest.Server

	mu         sync.Mutex
	stored     map[string][]byte
	batchSizes []int
	puts       map[string]int
	failPuts   map[string]int
	verified   []string
}

func newBatchServer(t *testing.T) *batchServer {
	s := &batchServer{t: t, stored: map[string][]byte{}, puts: map[string]int{}, failPuts: map[string]int{}}
	mux := http.NewServeMux()
	mux.HandleFunc("/info/lfs/objects/batch", s.batch)
	mux.HandleFunc("/storage/", s.put)
	mux.HandleFunc("/verify", func(w http.ResponseWriter, r *http.Request) {
		var obj batchObjectR
		_ = json.NewDecoder(r.Body).Decode(&obj)
		s.mu.Lock()
		s.verified = append(s.verified, obj.OID)
		s.mu.Unlock()
	})
	s.srv = httptest.NewServer(mux)
	t.Cleanup(s.srv.Close)
	return s
}

func (s *batchServer) batch(w http.ResponseWriter, r *http.Request) {
	var req batchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.t.Fatal(err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.batchSizes = append(s.batchSizes, len(req.Objects))
	var objects []map[string]any
	for _, o := range req.Objects {
		object := map[string]any{"oid": o.OID, "size": o.Size}
		if _, ok := s.stored[o.OID]; !ok {
			object["actions"] = map[string]any{
				"upload": map[string]any{"href": s.srv.URL + "/storage/" + o.OID},
				"verify": map[string]any{"href": s.srv.URL + "/verify"},
			}
		}
		objects = append(objects, object)
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"transfer": "basic", "objects": objects})
}

func (s *batchServer) put(w http.ResponseWriter, r *http.Request) {
	oid := strings.TrimPrefix(r.URL.Path, "/storage/")
	body, err := io.ReadAll(r.Body)

	s.mu.Lock()
	defer s.mu.Unlock()

	s.puts[oid]++
	if err != nil {
		return
	}
	if r.ContentLength != int64(len(body)) {
		s.t.Errorf("%s: Content-Length %d, body %d bytes", oid, r.ContentLength, len(body))
	}
	if s.failPuts[oid] > 0 {
		s.failPuts[oid]--
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	if OIDFor(body) != oid {
		w.WriteHeader(http.StatusUnprocessableEntity)
		return
	}
	s.stored[oid] = body
}

func objectFor(content []byte, opens *int) BatchObject {
	return BatchObject{
		OID:  OIDFor(content),
		Size: int64(len(content)),
		Open: func(ctx context.Context) (io.ReadCloser, error) {
			if opens != nil {
				*opens++
			}
			return io.NopCloser(bytes.NewReader(content)), nil
		},
	}
}

func TestUploadBatchGroupsObjectsAndSkipsStoredOnes(t *testing.T) {
	server := newBatchServer(t)
	client := NewClient(server.srv.URL+"/info/lfs", "", "token", server.srv.Client())

	var objects []BatchObject
	opens := 0
	for i := 0; i < 250; i++ {
		content := []byte(fmt.Sprintf("object %d", i))
		if i%5 == 0 {
			server.stored[OIDFor(content)] = content
		}
		objects = append(objects, objectFor(content, &opens))
	}

	uploaded, err := client.UploadBatch(context.Background(), "refs/heads/main", objects)
	if err != nil {
		t.Fatal(err)
	}

	if uploaded != 200 || opens != 200 {
		t.Errorf("uploaded %d, opened %d, want 200", uploaded, opens)
	}
	if fmt.Sprint(server.batchSizes) != "[100 100 50]" {
		t.Errorf("batch sizes %v", server.batchSizes)
	}
	if len(server.stored) != 250 || len(server.verified) != 200 {
		t.Errorf("stored %d, verified %d", len(server.stored), len(server.verified))
	}
}

func TestUploadBatchRetriesServerErrors(t *testing.T) {
	server := newBatchServer(t)
	client := NewClient(server.srv.URL+"/info/lfs", "", "token", server.srv.Client())

	flaky := []byte("flaky")
	broken := []byte("broken")
	server.failPuts[OIDFor(flaky)] = 2
	server.failPuts[OIDFor(broken)] = maxTransferAttempts

	if _, err := client.UploadBatch(context.Background(), "", []BatchObject{objectFor(flaky, nil)}); err != nil {
		t.Fatalf("flaky upload: %v", err)
	}
	if server.puts[OIDFor(flaky)] != 3 {
		t.Errorf("flaky object took %d attempts", server.puts[OIDFor(flaky)])
	}

	_, err := client.UploadBatch(context.Background(), "", []BatchObject{objectFor(broken, nil)})
	var lfsErr *Error
	if !errors.As(err, &lfsErr) || lfsErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("err = %v", err)
	}
	if server.puts[OIDFor(broken)] != maxTransferAttempts {
		t.Errorf("broken object took %d attempts", server.puts[OIDFor(broken)])
	}
}

type failingReader struct{ err error }

func (r failingReader) Read([]byte) (int, error) { return 0, r.err }

func TestUploadBatchSurfacesContentErrorsWithoutRetrying(t *testing.T) {
	server := newBatchServer(t)
	client := NewClient(server.srv.URL+"/info/lfs", "", "token", server.srv.Client())

	mismatch := errors.New("content does not match the manifest")
	opens := 0
	object := BatchObject{
		OID:  OIDFor([]byte("expected")),
		Size: 8,
		Open: func(ctx context.Context) (io.ReadCloser, error) {
			opens++
			return io.NopCloser(io.MultiReader(strings.NewReader("expe"), failingReader{mismatch})), nil
		},
	}

	_, err := Uploader{Client: client, Ref: "refs/heads/main"}.UploadLFS(context.Background(), []commitbatch.LFSObject{{OID: object.OID, Size: object.Size, Open: object.Open}})
	if !errors.Is(err, mismatch) {
		t.Fatalf("err = %v, want the read error", err)
	}
	if opens != 1 {
		t.Errorf("opened content %d times", opens)
	}
	if len(server.stored) != 0 {
		t.Error("stored a partial object")
	}
}

func TestUploadBatchMapsQuotaErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"message":"quota"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	_, err := client.UploadBatch(context.Background(), "", []BatchObject{objectFor([]byte("x"), nil)})
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("err = %v", err)
	}
}
