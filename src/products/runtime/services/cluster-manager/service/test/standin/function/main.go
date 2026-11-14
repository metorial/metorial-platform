// Command function is a stand-in for the function runtime image used by the cluster-manager e2e
// tests. It fetches its bundle from the pod-facing endpoint, checks the digest, unpacks it and
// answers the functionruntimerpc invoke method.
package main

import (
	"archive/tar"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/klauspost/compress/zstd"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	frpc "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc"
)

const (
	tokenFile  = "/var/run/metorial/identity/token"
	caFile     = "/var/run/metorial/trust/ca.crt"
	bundleRoot = "/var/runtime/bundle"
)

type runtime struct {
	versionID string
	ready     atomic.Bool
	message   atomic.Value
	files     atomic.Value
	sha       string
	log       *slog.Logger
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	rt := &runtime{versionID: os.Getenv("METORIAL_FUNCTION_VERSION_ID"), log: log}
	rt.message.Store("")
	rt.files.Store([]string{})

	go rt.fetchBundle()

	srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc"})
	frpc.Register(srv, rt)
	mux := http.NewServeMux()
	srv.Mount(mux)
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, _ *http.Request) {
		if !rt.ready.Load() {
			http.Error(w, "bundle not ready", http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte("ok"))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Info("listening", "port", port, "versionId", rt.versionID)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func httpClient() *http.Client {
	tr := http.DefaultTransport.(*http.Transport).Clone()
	tr.Proxy = nil
	if pem, err := os.ReadFile(caFile); err == nil {
		pool := x509.NewCertPool()
		pool.AppendCertsFromPEM(pem)
		tr.TLSClientConfig = &tls.Config{RootCAs: pool, ServerName: os.Getenv("CLUSTER_MANAGER_POD_SERVER_NAME")}
	}
	return &http.Client{Transport: tr, Timeout: 2 * time.Minute}
}

func (rt *runtime) fetchBundle() {
	client := httpClient()
	for attempt := 1; ; attempt++ {
		err := rt.tryFetch(client)
		if err == nil {
			rt.ready.Store(true)
			rt.log.Info("bundle ready", "sha256", rt.sha, "files", rt.files.Load())
			return
		}
		rt.log.Warn("bundle fetch failed", "attempt", attempt, "error", err)
		time.Sleep(time.Duration(min(attempt, 5)) * time.Second)
	}
}

func (rt *runtime) tryFetch(client *http.Client) error {
	token, err := os.ReadFile(tokenFile)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodGet, strings.TrimSuffix(os.Getenv("CLUSTER_MANAGER_POD_ADDR"), "/")+"/v1/bundles/self", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(string(token)))
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return fmt.Errorf("status %d: %s", res.StatusCode, body)
	}

	hash := sha256.New()
	dec, err := zstd.NewReader(io.TeeReader(res.Body, hash))
	if err != nil {
		return err
	}
	defer dec.Close()

	var files []string
	tr := tar.NewReader(dec)
	for {
		h, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		target := filepath.Join(bundleRoot, filepath.Clean("/"+h.Name))
		switch h.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			data, err := io.ReadAll(tr)
			if err != nil {
				return err
			}
			if err := os.WriteFile(target, data, os.FileMode(h.Mode)); err != nil {
				return err
			}
			files = append(files, h.Name)
			if h.Name == "message.txt" {
				rt.message.Store(string(data))
			}
		}
	}
	if _, err := io.Copy(io.Discard, res.Body); err != nil {
		return err
	}

	sum := hex.EncodeToString(hash.Sum(nil))
	if want := os.Getenv("METORIAL_BUNDLE_SHA256"); sum != want {
		return fmt.Errorf("bundle digest %s does not match %s", sum, want)
	}
	rt.sha = sum
	rt.files.Store(files)
	return nil
}

func (rt *runtime) Invoke(ctx context.Context, in *frpc.InvokeInput) (*frpc.InvokeOutput, error) {
	start := time.Now()
	if in.VersionID != rt.versionID {
		return nil, frpc.ErrInvocationUnauthorized("version_mismatch")
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(in.PayloadJSON), &payload); err != nil {
		payload = map[string]any{"raw": in.PayloadJSON}
	}
	if ms, ok := payload["sleepMs"].(float64); ok {
		select {
		case <-time.After(time.Duration(ms) * time.Millisecond):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	hostname, _ := os.Hostname()
	body, err := json.Marshal(map[string]any{
		"statusCode": 200,
		"body": map[string]any{
			"versionId": rt.versionID,
			"pod":       hostname,
			"payload":   payload,
			"bundleSha": rt.sha,
			"message":   rt.message.Load(),
			"files":     rt.files.Load(),
		},
	})
	if err != nil {
		return nil, err
	}
	return &frpc.InvokeOutput{
		Payload:       body,
		Logs:          []frpc.InvokeLogLine{{Ts: time.Now().UTC(), Stream: frpc.InvokeLogLineStreamStdout, Line: "invoked " + rt.versionID}},
		ComputeTimeMs: time.Since(start).Milliseconds(),
	}, nil
}
