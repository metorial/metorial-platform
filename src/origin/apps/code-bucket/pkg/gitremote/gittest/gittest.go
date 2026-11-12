// Package gittest serves real bare repositories through `git http-backend` for tests.
// It runs the git binary and must only be imported from _test files.
package gittest

import (
	"bytes"
	"io"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
)

const RepoName = "repo.git"

func RequireGit(t testing.TB) string {
	t.Helper()

	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}
	execPath := strings.TrimSpace(run(t, "", nil, "git", "--exec-path"))
	backend := filepath.Join(execPath, "git-http-backend")
	if _, err := os.Stat(backend); err != nil {
		t.Skip("git http-backend is not available")
	}
	return backend
}

type Repo struct {
	t       testing.TB
	Root    string
	Bare    string
	work    string
	backend string
}

// NewRepo creates a bare repository with branch main holding files (path → content).
// A nil files map leaves the repository empty.
func NewRepo(t testing.TB, files map[string]string) *Repo {
	t.Helper()

	backend := RequireGit(t)
	root := t.TempDir()
	r := &Repo{t: t, Root: root, Bare: filepath.Join(root, RepoName), work: filepath.Join(root, "work"), backend: backend}

	r.git("", "init", "--quiet", "--bare", "--initial-branch=main", r.Bare)
	r.git(r.Bare, "config", "http.receivepack", "true")
	r.git(r.Bare, "config", "uploadpack.allowFilter", "true")
	r.git(r.Bare, "config", "uploadpack.allowAnySHA1InWant", "true")
	r.git(r.Bare, "config", "receive.fsckObjects", "true")

	r.git("", "init", "--quiet", "--initial-branch=main", r.work)
	r.git(r.work, "config", "user.name", "Test")
	r.git(r.work, "config", "user.email", "test@example.com")
	r.git(r.work, "config", "core.autocrlf", "false")
	r.git(r.work, "remote", "add", "origin", r.Bare)

	if files != nil {
		r.Commit(files, "initial")
	}
	return r
}

func (r *Repo) git(dir string, args ...string) string {
	r.t.Helper()
	return run(r.t, dir, nil, "git", args...)
}

func (r *Repo) Git(args ...string) string {
	r.t.Helper()
	return strings.TrimSpace(r.git(r.Bare, args...))
}

func run(t testing.TB, dir string, stdin io.Reader, name string, args ...string) string {
	t.Helper()

	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stdin = stdin
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0", "HOME="+os.TempDir())
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("%s %s: %v\n%s", name, strings.Join(args, " "), err, stderr.String())
	}
	return stdout.String()
}

// Commit writes files into the work tree (an empty string deletes the path), commits
// and pushes to the bare repo's branch main. It returns the new commit SHA.
func (r *Repo) Commit(files map[string]string, message string) string {
	r.t.Helper()
	return r.CommitOn("main", files, message)
}

func (r *Repo) CommitOn(branch string, files map[string]string, message string) string {
	r.t.Helper()

	if r.Exists(branch) {
		r.git(r.work, "fetch", "--quiet", "origin", branch)
		r.git(r.work, "checkout", "--quiet", "--force", "-B", branch, "FETCH_HEAD")
		r.git(r.work, "clean", "-fdxq")
	} else if exec.Command("git", "-C", r.work, "rev-parse", "--verify", "--quiet", "HEAD").Run() == nil {
		r.git(r.work, "checkout", "--quiet", "-B", branch)
	}

	for name, content := range files {
		if content != "" {
			continue
		}
		full := filepath.Join(r.work, filepath.FromSlash(name))
		_ = os.Remove(full)
		for dir := filepath.Dir(full); dir != r.work && os.Remove(dir) == nil; dir = filepath.Dir(dir) {
		}
	}
	for name, content := range files {
		if content == "" {
			continue
		}
		full := filepath.Join(r.work, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			r.t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			r.t.Fatal(err)
		}
	}

	r.git(r.work, "add", "-A")
	r.git(r.work, "commit", "--quiet", "--allow-empty", "-m", message)
	r.git(r.work, "push", "--quiet", "--force", "origin", "HEAD:refs/heads/"+branch)
	return r.Head(branch)
}

// FastImport feeds a `git fast-import` stream into the bare repository.
func (r *Repo) FastImport(stream io.Reader) {
	r.t.Helper()
	run(r.t, r.Bare, stream, "git", "fast-import", "--quiet")
}

func (r *Repo) Exists(branch string) bool {
	cmd := exec.Command("git", "--git-dir", r.Bare, "rev-parse", "--verify", "--quiet", "refs/heads/"+branch)
	return cmd.Run() == nil
}

// Has reports whether path exists at ref; safe to call outside the test goroutine.
func (r *Repo) Has(ref, path string) bool {
	return exec.Command("git", "--git-dir", r.Bare, "cat-file", "-e", ref+":"+path).Run() == nil
}

func (r *Repo) Head(branch string) string {
	r.t.Helper()
	return r.Git("rev-parse", "refs/heads/"+branch)
}

func (r *Repo) TreeOf(commit string) string {
	r.t.Helper()
	return r.Git("rev-parse", commit+"^{tree}")
}

// LsTree is `git ls-tree -r -t` as "mode sha path" lines, sorted.
func (r *Repo) LsTree(ref string) []string {
	r.t.Helper()

	out := r.Git("ls-tree", "-r", "-t", "--full-tree", ref)
	var lines []string
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		meta, p, _ := strings.Cut(line, "\t")
		fields := strings.Fields(meta)
		mode := strings.TrimLeft(fields[0], "0")
		lines = append(lines, mode+" "+fields[2]+" "+p)
	}
	sort.Strings(lines)
	return lines
}

func (r *Repo) Show(ref, path string) string {
	r.t.Helper()
	return r.git(r.Bare, "show", ref+":"+path)
}

func (r *Repo) Fsck() {
	r.t.Helper()
	r.git(r.Bare, "fsck", "--strict", "--no-dangling")
}

func (r *Repo) ObjectCount() int {
	r.t.Helper()
	out := r.Git("count-objects", "-v")
	total := 0
	for _, line := range strings.Split(out, "\n") {
		key, value, _ := strings.Cut(line, ": ")
		if key == "count" || key == "in-pack" {
			var n int
			for _, c := range value {
				n = n*10 + int(c-'0')
			}
			total += n
		}
	}
	return total
}

type Request struct {
	Method string
	Path   string
	Query  string
	Header http.Header
	Body   []byte

	ResponseBytes int64
}

type countingWriter struct {
	http.ResponseWriter
	n int64
}

func (c *countingWriter) Write(p []byte) (int, error) {
	n, err := c.ResponseWriter.Write(p)
	c.n += int64(n)
	return n, err
}

type Server struct {
	*httptest.Server
	Repo *Repo

	// AuthHeader, when set, is required on every request.
	AuthHeader string
	// Intercept runs before the backend; returning true means it handled the request.
	Intercept func(w http.ResponseWriter, r *http.Request) bool

	backend  http.Handler
	mu       sync.Mutex
	requests []Request
}

// ServeBackend passes a request to git http-backend, e.g. from Intercept.
func (s *Server) ServeBackend(w http.ResponseWriter, r *http.Request) {
	s.backend.ServeHTTP(w, r)
}

// Serve exposes the repo at <URL>/repo.git through git http-backend.
func (r *Repo) Serve() *Server {
	r.t.Helper()

	s := &Server{Repo: r}
	backend := &cgi.Handler{
		Path: r.backend,
		Env: []string{
			"GIT_PROJECT_ROOT=" + r.Root,
			"GIT_HTTP_EXPORT_ALL=1",
			"GIT_CONFIG_NOSYSTEM=1",
			"HOME=" + os.TempDir(),
		},
	}

	s.backend = backend
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, _ := io.ReadAll(req.Body)
		s.mu.Lock()
		s.requests = append(s.requests, Request{Method: req.Method, Path: req.URL.Path, Query: req.URL.RawQuery, Header: req.Header.Clone(), Body: body})
		s.mu.Unlock()
		req.Body = io.NopCloser(bytes.NewReader(body))
		req.ContentLength = int64(len(body))
		req.TransferEncoding = nil

		if s.AuthHeader != "" && req.Header.Get("Authorization") != s.AuthHeader {
			w.Header().Set("WWW-Authenticate", `Basic realm="git"`)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if s.Intercept != nil && s.Intercept(w, req) {
			return
		}
		counter := &countingWriter{ResponseWriter: w}
		backend.ServeHTTP(counter, req)
		s.mu.Lock()
		s.requests[len(s.requests)-1].ResponseBytes = counter.n
		s.mu.Unlock()
	}))
	r.t.Cleanup(s.Close)
	return s
}

func (s *Server) RepoURL() string { return s.URL + "/" + RepoName }

func (s *Server) Requests() []Request {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Request(nil), s.requests...)
}

func (s *Server) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.requests = nil
}
