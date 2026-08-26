package gitlfs

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/iotest"
)

func TestUploadPutsObjectAndVerifies(t *testing.T) {
	content := []byte("large object content")
	oid := OIDFor(content)

	var (
		batchRequestBody batchRequest
		uploaded         []byte
		uploadHeader     string
		verified         batchObjectR
		batchAuth        string
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/info/lfs/objects/batch", func(w http.ResponseWriter, r *http.Request) {
		batchAuth = r.Header.Get("Authorization")
		if got := r.Header.Get("Content-Type"); got != contentType {
			t.Errorf("unexpected content type: %q", got)
		}
		if err := json.NewDecoder(r.Body).Decode(&batchRequestBody); err != nil {
			t.Fatalf("decode batch request: %v", err)
		}
		_, _ = fmt.Fprintf(w, `{
			"transfer": "basic",
			"objects": [{
				"oid": %q,
				"size": %d,
				"actions": {
					"upload": {"href": %q, "header": {"x-storage-token": "abc"}},
					"verify": {"href": %q}
				}
			}]
		}`, oid, len(content), server.URL+"/storage/"+oid, server.URL+"/info/lfs/verify")
	})

	mux.HandleFunc("/storage/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("unexpected upload method: %s", r.Method)
		}
		uploadHeader = r.Header.Get("x-storage-token")
		if got := r.Header.Get("Authorization"); got != "" {
			t.Errorf("expected no Authorization on presigned upload, got %q", got)
		}
		uploaded, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("/info/lfs/verify", func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&verified); err != nil {
			t.Fatalf("decode verify request: %v", err)
		}
		w.WriteHeader(http.StatusOK)
	})

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	if err := client.Upload(context.Background(), "refs/heads/main", oid, int64(len(content)), OpenerForBytes(content)); err != nil {
		t.Fatalf("upload: %v", err)
	}

	if batchRequestBody.Operation != "upload" || batchRequestBody.HashAlgo != "sha256" {
		t.Fatalf("unexpected batch request: %#v", batchRequestBody)
	}
	if batchRequestBody.Ref == nil || batchRequestBody.Ref.Name != "refs/heads/main" {
		t.Fatalf("unexpected batch ref: %#v", batchRequestBody.Ref)
	}
	wantAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(DefaultUsername+":token"))
	if batchAuth != wantAuth {
		t.Fatalf("unexpected batch authorization: %q", batchAuth)
	}
	if string(uploaded) != string(content) {
		t.Fatalf("unexpected uploaded body: %q", uploaded)
	}
	if uploadHeader != "abc" {
		t.Fatalf("expected returned upload header to be sent, got %q", uploadHeader)
	}
	if verified.OID != oid || verified.Size != int64(len(content)) {
		t.Fatalf("unexpected verify body: %#v", verified)
	}
}

func TestUploadSkipsTransferWhenServerHasObject(t *testing.T) {
	content := []byte("already stored")
	oid := OIDFor(content)
	transfers := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/info/lfs/objects/batch" {
			transfers++
			t.Errorf("unexpected request to %s", r.URL.Path)
			return
		}
		_, _ = fmt.Fprintf(w, `{"transfer":"basic","objects":[{"oid":%q,"size":%d}]}`, oid, len(content))
	}))
	defer server.Close()

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	if err := client.Upload(context.Background(), "refs/heads/main", oid, int64(len(content)), OpenerForBytes(content)); err != nil {
		t.Fatalf("upload: %v", err)
	}
	if transfers != 0 {
		t.Fatalf("expected no transfer requests, got %d", transfers)
	}
}

func TestUploadStreamsFromTheOpener(t *testing.T) {
	content := []byte("streamed object content")
	oid := OIDFor(content)

	var (
		uploaded      []byte
		contentLength int64
		opened        int
	)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/info/lfs/objects/batch", func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, `{
			"transfer": "basic",
			"objects": [{
				"oid": %q,
				"size": %d,
				"actions": {"upload": {"href": %q}}
			}]
		}`, oid, len(content), server.URL+"/storage/"+oid)
	})

	mux.HandleFunc("/storage/", func(w http.ResponseWriter, r *http.Request) {
		contentLength = r.ContentLength
		uploaded, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	})

	open := func() (io.ReadCloser, error) {
		opened++
		return io.NopCloser(iotest.OneByteReader(bytes.NewReader(content))), nil
	}

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	if err := client.Upload(context.Background(), "refs/heads/main", oid, int64(len(content)), open); err != nil {
		t.Fatalf("upload: %v", err)
	}

	if string(uploaded) != string(content) {
		t.Fatalf("uploaded %q, want %q", uploaded, content)
	}
	if contentLength != int64(len(content)) {
		t.Fatalf("uploaded with content length %d, want %d", contentLength, len(content))
	}
	if opened != 1 {
		t.Fatalf("opened content %d times, want 1", opened)
	}
}

func TestUploadDoesNotOpenContentTheServerAlreadyHas(t *testing.T) {
	content := []byte("already stored")
	oid := OIDFor(content)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, `{"transfer":"basic","objects":[{"oid":%q,"size":%d}]}`, oid, len(content))
	}))
	defer server.Close()

	opened := 0
	open := func() (io.ReadCloser, error) {
		opened++
		return io.NopCloser(bytes.NewReader(content)), nil
	}

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	if err := client.Upload(context.Background(), "refs/heads/main", oid, int64(len(content)), open); err != nil {
		t.Fatalf("upload: %v", err)
	}

	if opened != 0 {
		t.Fatalf("opened content %d times, want 0", opened)
	}
}

func TestUploadSurfacesOpenerFailures(t *testing.T) {
	oid := OIDFor([]byte("x"))

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/info/lfs/objects/batch", func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, `{
			"transfer": "basic",
			"objects": [{"oid": %q, "size": 1, "actions": {"upload": {"href": %q}}}]
		}`, oid, server.URL+"/storage/"+oid)
	})

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	err := client.Upload(context.Background(), "refs/heads/main", oid, 1, func() (io.ReadCloser, error) {
		return nil, errors.New("object storage unavailable")
	})

	if err == nil || !strings.Contains(err.Error(), "object storage unavailable") {
		t.Fatalf("expected the opener failure to surface, got %v", err)
	}
}

func TestOIDForReaderMatchesOIDFor(t *testing.T) {
	content := bytes.Repeat([]byte("chunky"), 1000)

	oid, size, err := OIDForReader(iotest.OneByteReader(bytes.NewReader(content)))
	if err != nil {
		t.Fatalf("hash: %v", err)
	}

	if oid != OIDFor(content) {
		t.Fatalf("streamed oid %s, want %s", oid, OIDFor(content))
	}
	if size != int64(len(content)) {
		t.Fatalf("streamed size %d, want %d", size, len(content))
	}
}

func TestUploadMapsQuotaAndPolicyFailures(t *testing.T) {
	cases := []struct {
		status int
		want   error
	}{
		{http.StatusTooManyRequests, ErrQuotaExceeded},
		{http.StatusForbidden, ErrForbidden},
		{http.StatusUnauthorized, ErrUnauthorized},
	}

	for _, tc := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			_, _ = fmt.Fprint(w, `{"message":"nope"}`)
		}))

		client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
		err := client.Upload(context.Background(), "refs/heads/main", OIDFor(nil), 0, OpenerForBytes(nil))
		server.Close()

		if !errors.Is(err, tc.want) {
			t.Fatalf("status %d: expected %v, got %v", tc.status, tc.want, err)
		}

		var lfsErr *Error
		if !errors.As(err, &lfsErr) || lfsErr.StatusCode != tc.status {
			t.Fatalf("status %d: expected typed error, got %v", tc.status, err)
		}
	}
}

func TestUploadSurfacesPerObjectError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `{"transfer":"basic","objects":[{"oid":"a","size":1,"error":{"code":403,"message":"LFS is disabled"}}]}`)
	}))
	defer server.Close()

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	err := client.Upload(context.Background(), "refs/heads/main", "a", 1, OpenerForBytes([]byte("x")))
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden error, got %v", err)
	}
}

func TestDownloadVerifiesDigest(t *testing.T) {
	content := []byte("downloaded object")
	oid := OIDFor(content)

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	corrupt := false
	mux.HandleFunc("/info/lfs/objects/batch", func(w http.ResponseWriter, r *http.Request) {
		var req batchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode batch request: %v", err)
		}
		if req.Operation != "download" {
			t.Errorf("unexpected operation: %q", req.Operation)
		}
		_, _ = fmt.Fprintf(w, `{"transfer":"basic","objects":[{"oid":%q,"size":%d,"actions":{"download":{"href":%q}}}]}`,
			oid, len(content), server.URL+"/storage/"+oid)
	})
	mux.HandleFunc("/storage/", func(w http.ResponseWriter, r *http.Request) {
		if corrupt {
			_, _ = w.Write([]byte("corrupted object!"))
			return
		}
		_, _ = w.Write(content)
	})

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	pointer := &Pointer{OID: oid, Size: int64(len(content))}

	got, err := client.Download(context.Background(), "", pointer)
	if err != nil {
		t.Fatalf("download: %v", err)
	}
	if string(got) != string(content) {
		t.Fatalf("unexpected content: %q", got)
	}

	corrupt = true
	if _, err := client.Download(context.Background(), "", pointer); err == nil {
		t.Fatal("expected digest mismatch to fail the download")
	}
}

// downloadServer serves one object, with hooks for the ways a server can lie
// about what it is sending.
func downloadServer(t *testing.T, oid string, declaredSize int64, body func() []byte) *Client {
	t.Helper()

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	mux.HandleFunc("/info/lfs/objects/batch", func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, `{"transfer":"basic","objects":[{"oid":%q,"size":%d,"actions":{"download":{"href":%q}}}]}`,
			oid, declaredSize, server.URL+"/storage/"+oid)
	})
	mux.HandleFunc("/storage/", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(body())
	})

	return NewClient(server.URL+"/info/lfs", "", "token", server.Client())
}

func TestDownloadToStreamsIntoTheWriter(t *testing.T) {
	content := bytes.Repeat([]byte("streamed"), 1024)
	oid := OIDFor(content)
	client := downloadServer(t, oid, int64(len(content)), func() []byte { return content })

	var got bytes.Buffer
	err := client.DownloadTo(
		context.Background(), "",
		&Pointer{OID: oid, Size: int64(len(content))},
		&got,
	)
	if err != nil {
		t.Fatalf("download: %v", err)
	}
	if !bytes.Equal(got.Bytes(), content) {
		t.Fatal("the writer did not receive the object")
	}
}

func TestDownloadToRejectsADigestMismatch(t *testing.T) {
	content := []byte("the real object")
	oid := OIDFor(content)
	client := downloadServer(t, oid, int64(len(content)), func() []byte {
		return []byte("a different one")
	})

	err := client.DownloadTo(
		context.Background(), "",
		&Pointer{OID: oid, Size: int64(len(content))},
		io.Discard,
	)
	if err == nil || !strings.Contains(err.Error(), "digest mismatch") {
		t.Fatalf("expected a digest mismatch, got %v", err)
	}
}

func TestDownloadToRejectsASizeMismatch(t *testing.T) {
	content := []byte("the real object")
	oid := OIDFor(content)

	for name, body := range map[string][]byte{
		"short": content[:4],
		// A server sending more than it declared must not be silently truncated
		// to the declared length and accepted.
		"long": append(append([]byte{}, content...), " and extra"...),
	} {
		t.Run(name, func(t *testing.T) {
			client := downloadServer(t, oid, int64(len(content)), func() []byte { return body })

			err := client.DownloadTo(
				context.Background(), "",
				&Pointer{OID: oid, Size: int64(len(content))},
				io.Discard,
			)
			if err == nil {
				t.Fatal("expected the size mismatch to fail the download")
			}
		})
	}
}

func TestDownloadWithoutActionsIsNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `{"transfer":"basic","objects":[{"oid":"a","size":1}]}`)
	}))
	defer server.Close()

	client := NewClient(server.URL+"/info/lfs", "", "token", server.Client())
	_, err := client.Download(context.Background(), "", &Pointer{OID: "a", Size: 1})
	if !errors.Is(err, ErrObjectNotFound) {
		t.Fatalf("expected not found error, got %v", err)
	}
}
