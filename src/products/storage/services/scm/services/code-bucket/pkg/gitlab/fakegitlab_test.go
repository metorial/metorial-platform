package gitlab

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
)

const (
	fakeProjectID = 7
	fakeToken     = "glpat-s3cr3t"
)

type recordedCommit struct {
	Message string
	Actions []commitAction
}

// fakeGitLab serves the GitLab REST endpoints manifest exports use on the same host as
// a real git http-backend repository, applying commits to that repository.
type fakeGitLab struct {
	t      *testing.T
	repo   *gittest.Repo
	server *gittest.Server
	lfs    *gittest.LFSServer

	mu       sync.Mutex
	commits  []recordedCommit
	requests []string

	maxBodyBytes  int
	beforeCommit  func(n int)
	commitHandler func(w http.ResponseWriter, n int) bool
	gitDisabled   bool
}

func newFakeGitLab(t *testing.T, files map[string]string) *fakeGitLab {
	t.Helper()

	f := &fakeGitLab{t: t, repo: gittest.NewRepo(t, files)}
	f.server = f.repo.Serve()
	f.server.Intercept = f.intercept
	return f
}

func (f *fakeGitLab) apiURL() string { return f.server.URL + "/api/v4" }

func (f *fakeGitLab) gitAuth() string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(tokenUsername+":"+fakeToken))
}

func (f *fakeGitLab) recordedCommits() []recordedCommit {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]recordedCommit(nil), f.commits...)
}

func (f *fakeGitLab) count(prefix string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, request := range f.requests {
		if strings.HasPrefix(request, prefix) {
			n++
		}
	}
	return n
}

func (f *fakeGitLab) intercept(w http.ResponseWriter, r *http.Request) bool {
	project := fmt.Sprintf("/api/v4/projects/%d", fakeProjectID)
	path := r.URL.Path

	if !strings.HasPrefix(path, "/api/") {
		if r.Header.Get("Authorization") != f.gitAuth() {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return true
		}
		if lfsPath, ok := strings.CutPrefix(path, "/"+gittest.RepoName+"/info/lfs"); ok && f.lfs != nil {
			proxied := r.Clone(r.Context())
			proxied.URL.Path = "/info/lfs" + lfsPath
			f.lfs.Config.Handler.ServeHTTP(w, proxied)
			return true
		}
		if f.gitDisabled {
			http.Error(w, "git over HTTP is disabled", http.StatusForbidden)
			return true
		}
		f.record("git " + path)
		return false
	}

	if r.Header.Get("Authorization") != "Bearer "+fakeToken {
		http.Error(w, `{"message":"401 Unauthorized"}`, http.StatusUnauthorized)
		return true
	}

	rest, ok := strings.CutPrefix(path, project)
	if !ok {
		http.NotFound(w, r)
		return true
	}
	f.record(r.Method + " " + rest)

	switch {
	case r.Method == http.MethodGet && rest == "":
		writeJSON(w, map[string]any{"id": fakeProjectID, "http_url_to_repo": f.server.RepoURL(), "default_branch": "main"})
	case r.Method == http.MethodGet && strings.HasPrefix(rest, "/repository/branches/"):
		branch, _ := url.PathUnescape(strings.TrimPrefix(rest, "/repository/branches/"))
		if !f.repo.Exists(branch) {
			http.Error(w, `{"message":"404 Branch Not Found"}`, http.StatusNotFound)
			return true
		}
		writeJSON(w, map[string]any{"name": branch, "commit": map[string]any{"id": f.repo.Head(branch)}})
	case r.Method == http.MethodGet && rest == "/repository/tree":
		f.tree(w, r)
	case r.Method == http.MethodGet && strings.HasPrefix(rest, "/repository/blobs/"):
		sha := strings.TrimSuffix(strings.TrimPrefix(rest, "/repository/blobs/"), "/raw")
		io.WriteString(w, f.repo.Git("cat-file", "blob", sha))
	case r.Method == http.MethodPost && rest == "/repository/commits":
		f.commit(w, r)
	case r.Method == http.MethodGet && strings.HasPrefix(rest, "/repository/files/"):
		f.fileInfo(w, r, strings.TrimPrefix(rest, "/repository/files/"))
	default:
		http.NotFound(w, r)
	}
	return true
}

func (f *fakeGitLab) record(request string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = append(f.requests, request)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// tree implements keyset pagination by path, like GitLab's pagination=keyset.
func (f *fakeGitLab) tree(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	perPage, _ := strconv.Atoi(query.Get("per_page"))
	if perPage <= 0 {
		perPage = 20
	}
	ref := query.Get("ref")

	var entries []map[string]string
	for _, line := range strings.Split(f.repo.Git("ls-tree", "-r", "-t", "--full-tree", ref), "\n") {
		if line == "" {
			continue
		}
		meta, path, _ := strings.Cut(line, "\t")
		fields := strings.Fields(meta)
		entries = append(entries, map[string]string{"mode": fields[0], "type": fields[1], "id": fields[2], "path": path, "name": path[strings.LastIndex(path, "/")+1:]})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i]["path"] < entries[j]["path"] })

	start := 0
	if token := query.Get("page_token"); token != "" {
		start = sort.Search(len(entries), func(i int) bool { return entries[i]["path"] > token })
	}
	end := min(start+perPage, len(entries))
	page := entries[start:end]
	if end < len(entries) {
		next := *r.URL
		next.Scheme, next.Host = "http", r.Host
		q := next.Query()
		q.Set("page_token", page[len(page)-1]["path"])
		next.RawQuery = q.Encode()
		w.Header().Set("Link", fmt.Sprintf(`<%s>; rel="next"`, next.String()))
	}
	writeJSON(w, page)
}

func (f *fakeGitLab) fileInfo(w http.ResponseWriter, r *http.Request, escaped string) {
	path, _ := url.PathUnescape(escaped)
	ref := r.URL.Query().Get("ref")
	if !f.repo.Has(ref, path) {
		http.Error(w, `{"message":"404 File Not Found"}`, http.StatusNotFound)
		return
	}
	content := f.repo.Show(ref, path)
	writeJSON(w, map[string]any{
		"file_path":      path,
		"blob_id":        f.repo.Git("rev-parse", ref+":"+path),
		"content_sha256": sha256Hex([]byte(content)),
		"content":        base64.StdEncoding.EncodeToString([]byte(content)),
	})
}

func (f *fakeGitLab) commit(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	if f.maxBodyBytes > 0 && len(body) > f.maxBodyBytes {
		http.Error(w, "Request Entity Too Large", http.StatusRequestEntityTooLarge)
		return
	}

	f.mu.Lock()
	n := len(f.commits)
	f.mu.Unlock()
	if f.commitHandler != nil && f.commitHandler(w, n) {
		return
	}

	var req gitlabCommitRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, `{"message":"invalid json"}`, http.StatusBadRequest)
		return
	}
	var actions []commitAction
	_ = json.Unmarshal(body, &struct {
		Actions *[]commitAction `json:"actions"`
	}{&actions})

	if f.beforeCommit != nil {
		f.beforeCommit(n)
	}

	tree := map[string]bool{}
	for _, name := range strings.Split(f.repo.Git("ls-tree", "-r", "--name-only", req.Branch), "\n") {
		if name != "" {
			tree[name] = true
		}
	}

	files := map[string]string{}
	for _, action := range actions {
		exists := tree[action.FilePath]
		switch {
		case action.Action == "create" && exists:
			http.Error(w, `{"message":"A file with this name already exists"}`, http.StatusBadRequest)
			return
		case action.Action != "create" && !exists:
			http.Error(w, `{"message":"A file with this name doesn't exist"}`, http.StatusBadRequest)
			return
		case action.Action == "create" && blocksPath(tree, action.FilePath):
			http.Error(w, `{"message":"A directory or file with this name already exists"}`, http.StatusBadRequest)
			return
		}
		if action.Action == "delete" {
			delete(tree, action.FilePath)
			files[action.FilePath] = ""
			continue
		}
		tree[action.FilePath] = true
		content, err := base64.StdEncoding.DecodeString(action.Content)
		if err != nil || action.Encoding != "base64" {
			http.Error(w, `{"message":"bad content"}`, http.StatusBadRequest)
			return
		}
		files[action.FilePath] = string(content)
	}

	parent := f.repo.Head(req.Branch)
	head := f.repo.CommitOn(req.Branch, files, req.CommitMessage)

	f.mu.Lock()
	f.commits = append(f.commits, recordedCommit{Message: req.CommitMessage, Actions: actions})
	f.mu.Unlock()
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, map[string]any{"id": head, "parent_ids": []string{parent}})
}

// blocksPath reports a file at an ancestor of p, or below p, in a flat file set the way
// Gitaly's commit actions see the tree.
func blocksPath(tree map[string]bool, p string) bool {
	for dir := path.Dir(p); dir != "."; dir = path.Dir(dir) {
		if tree[dir] {
			return true
		}
	}
	for name := range tree {
		if strings.HasPrefix(name, p+"/") {
			return true
		}
	}
	return false
}
