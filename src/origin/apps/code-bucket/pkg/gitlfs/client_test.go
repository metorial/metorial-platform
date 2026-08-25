package gitlfs

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
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
	if err := client.Upload(context.Background(), "refs/heads/main", oid, int64(len(content)), content); err != nil {
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
	if err := client.Upload(context.Background(), "refs/heads/main", oid, int64(len(content)), content); err != nil {
		t.Fatalf("upload: %v", err)
	}
	if transfers != 0 {
		t.Fatalf("expected no transfer requests, got %d", transfers)
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
		err := client.Upload(context.Background(), "refs/heads/main", OIDFor(nil), 0, nil)
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
	err := client.Upload(context.Background(), "refs/heads/main", "a", 1, []byte("x"))
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
