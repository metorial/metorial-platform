// Package bundletest builds tar.zst bundles and serves them like the cluster-manager's
// pod-facing listener.
package bundletest

import (
	"archive/tar"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"

	"github.com/klauspost/compress/zstd"
)

type Entry struct {
	Header tar.Header
	Body   []byte
}

func File(name, body string) Entry {
	return Entry{Header: tar.Header{Name: name, Typeflag: tar.TypeReg, Mode: 0o644, Size: int64(len(body))}, Body: []byte(body)}
}

func Pack(entries ...Entry) []byte {
	var tarBuf bytes.Buffer
	tw := tar.NewWriter(&tarBuf)
	for _, e := range entries {
		hdr := e.Header
		if hdr.Typeflag == tar.TypeReg && hdr.Size == 0 {
			hdr.Size = int64(len(e.Body))
		}
		if err := tw.WriteHeader(&hdr); err != nil {
			panic(err)
		}
		if len(e.Body) > 0 {
			if _, err := tw.Write(e.Body); err != nil {
				panic(err)
			}
		}
	}
	if err := tw.Close(); err != nil {
		panic(err)
	}

	var out bytes.Buffer
	zw, err := zstd.NewWriter(&out)
	if err != nil {
		panic(err)
	}
	if _, err := zw.Write(tarBuf.Bytes()); err != nil {
		panic(err)
	}
	if err := zw.Close(); err != nil {
		panic(err)
	}
	return out.Bytes()
}

func SHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

type Server struct {
	*httptest.Server
	Token    string
	Bundle   []byte
	Requests atomic.Int64
}

func NewServer(token string, bundle []byte) *Server {
	s := &Server{Token: token, Bundle: bundle}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.Requests.Add(1)
		if r.URL.Path != "/v1/bundles/self" {
			http.NotFound(w, r)
			return
		}
		if strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ") != s.Token {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/zstd")
		_, _ = w.Write(s.Bundle)
	}))
	return s
}
