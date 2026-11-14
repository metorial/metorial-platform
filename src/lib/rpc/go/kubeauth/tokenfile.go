package kubeauth

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// tokenFile reads a projected token, re-reading it when its modification time changes: the
// kubelet rewrites the file in place at 80 % of the token's lifetime.
type tokenFile struct {
	path    string
	mu      sync.Mutex
	modTime time.Time
	token   string
}

func (f *tokenFile) read() (string, error) {
	info, err := os.Stat(f.path)
	if err != nil {
		return "", err
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	if f.token != "" && info.ModTime().Equal(f.modTime) {
		return f.token, nil
	}

	raw, err := os.ReadFile(f.path)
	if err != nil {
		return "", err
	}
	token := strings.TrimSpace(string(raw))
	if token == "" {
		return "", fmt.Errorf("kubeauth: token file %s is empty", f.path)
	}

	f.token, f.modTime = token, info.ModTime()
	return token, nil
}

// TokenFileHeader is an ldrpc.ClientOptions.HeaderFunc sending a projected ServiceAccount token
// as "Authorization: Bearer <token>".
func TokenFileHeader(path string) func(ctx context.Context) (http.Header, error) {
	f := &tokenFile{path: path}
	return func(ctx context.Context) (http.Header, error) {
		token, err := f.read()
		if err != nil {
			return nil, err
		}
		return http.Header{"Authorization": {"Bearer " + token}}, nil
	}
}
