package github

import (
	"bytes"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"path"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	hubOwner  = "acme"
	hubRepo   = "marketplace"
	hubBranch = "main"
	hubToken  = "ghs_test"
)

type hubEntry struct {
	Mode string
	SHA  string
}

type hubTreeItem struct {
	Name string
	Mode string
	SHA  string
}

func (i hubTreeItem) isTree() bool { return i.Mode == "40000" }

type hubCommit struct {
	Tree    string
	Parent  string
	Message string
}

type hubFault int

const (
	faultNone hubFault = iota
	// faultRateLimit is a spent primary quota that resets in an hour.
	faultRateLimit
	// faultShortRateLimit is a secondary limit asking for a 2 s pause.
	faultShortRateLimit
	faultBadGateway
	// faultDropAfterLanding commits, then drops the connection before answering.
	faultDropAfterLanding
)

// fakeHub is a GitHub repository with real git object SHAs behind the REST, GraphQL and
// LFS APIs that manifest exports use.
type fakeHub struct {
	t   *testing.T
	srv *httptest.Server

	mu      sync.Mutex
	blobs   map[string][]byte
	trees   map[string][]hubTreeItem
	commits map[string]hubCommit
	head    string
	lfs     map[string][]byte

	truncateAbove   int
	mutationBodyCap int
	blobBodyCap     int
	noGraphQL       bool
	lfsQuota        bool
	beforeMutation  func(n int) hubFault
	beforeRefUpdate func(n int) hubFault

	treeGets      int
	treeBatches   int
	commitsMade   int
	blobPosts     int
	blobGets      int
	lfsBatches    int
	lfsPuts       int
	mutations     int
	refUpdates    int
	mutationBytes []int
	landedAdds    [][]string
	requests      int
	log           []string
}

func newFakeHub(t *testing.T, files map[string][]byte) *fakeHub {
	t.Helper()

	f := &fakeHub{
		t:       t,
		blobs:   map[string][]byte{},
		trees:   map[string][]hubTreeItem{},
		commits: map[string]hubCommit{},
		lfs:     map[string][]byte{},
	}
	f.srv = httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(f.srv.Close)

	flat := map[string]hubEntry{}
	for p, content := range files {
		flat[p] = hubEntry{Mode: "100644", SHA: f.putBlob(content)}
	}
	tree := f.writeTree(flat)
	f.head = f.putCommit(hubCommit{Tree: tree, Message: "initial"})
	return f
}

func (f *fakeHub) options() ManifestExportOptions {
	return ManifestExportOptions{UploadOptions: UploadOptions{
		Owner:         hubOwner,
		Repo:          hubRepo,
		Branch:        hubBranch,
		CommitMessage: "Sync marketplace",
		Token:         hubToken,
		BaseURL:       f.srv.URL,
		LFSEndpoint:   f.srv.URL + "/" + hubOwner + "/" + hubRepo + ".git/info/lfs",
	}}
}

func gitObjectSHA(kind string, body []byte) string {
	h := sha1.New()
	fmt.Fprintf(h, "%s %d\x00", kind, len(body))
	h.Write(body)
	return hex.EncodeToString(h.Sum(nil))
}

func (f *fakeHub) putBlob(content []byte) string {
	sha := gitObjectSHA("blob", content)
	f.blobs[sha] = append([]byte(nil), content...)
	return sha
}

func (f *fakeHub) putCommit(c hubCommit) string {
	sha := gitObjectSHA("commit", []byte(fmt.Sprintf("tree %s\nparent %s\n\n%s %d", c.Tree, c.Parent, c.Message, len(f.commits))))
	f.commits[sha] = c
	return sha
}

func gitTreeOrder(items []hubTreeItem) {
	key := func(i hubTreeItem) string {
		if i.isTree() {
			return i.Name + "/"
		}
		return i.Name
	}
	sort.Slice(items, func(a, b int) bool { return key(items[a]) < key(items[b]) })
}

func (f *fakeHub) putTree(items []hubTreeItem) string {
	gitTreeOrder(items)
	var body bytes.Buffer
	for _, item := range items {
		raw, _ := hex.DecodeString(item.SHA)
		fmt.Fprintf(&body, "%s %s\x00", item.Mode, item.Name)
		body.Write(raw)
	}
	sha := gitObjectSHA("tree", body.Bytes())
	f.trees[sha] = items
	return sha
}

func (f *fakeHub) writeTree(flat map[string]hubEntry) string {
	children := map[string]map[string]hubEntry{}
	var items []hubTreeItem
	for p, e := range flat {
		dir, rest, nested := strings.Cut(p, "/")
		if !nested {
			items = append(items, hubTreeItem{Name: p, Mode: e.Mode, SHA: e.SHA})
			continue
		}
		if children[dir] == nil {
			children[dir] = map[string]hubEntry{}
		}
		children[dir][rest] = e
	}
	for dir, sub := range children {
		items = append(items, hubTreeItem{Name: dir, Mode: "40000", SHA: f.writeTree(sub)})
	}
	return f.putTree(items)
}

func (f *fakeHub) flatten(tree string) map[string]hubEntry {
	out := map[string]hubEntry{}
	var walk func(prefix, sha string)
	walk = func(prefix, sha string) {
		for _, item := range f.trees[sha] {
			full := joinTreePath(prefix, item.Name)
			if item.isTree() {
				walk(full, item.SHA)
				continue
			}
			out[full] = hubEntry{Mode: item.Mode, SHA: item.SHA}
		}
	}
	walk("", tree)
	return out
}

// Files returns the content at the branch head.
func (f *fakeHub) Files() map[string][]byte {
	f.mu.Lock()
	defer f.mu.Unlock()

	out := map[string][]byte{}
	for p, e := range f.flatten(f.commits[f.head].Tree) {
		out[p] = f.blobs[e.SHA]
	}
	return out
}

func (f *fakeHub) Mode(p string) string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.flatten(f.commits[f.head].Tree)[p].Mode
}

func (f *fakeHub) Head() (string, string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.head, f.commits[f.head].Tree
}

func (f *fakeHub) LFSObject(oid string) ([]byte, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	content, ok := f.lfs[oid]
	return content, ok
}

// Push lands a commit from someone else.
func (f *fakeHub) Push(files map[string][]byte, deletes ...string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pushLocked(files, deletes, "foreign push")
}

func (f *fakeHub) pushLocked(files map[string][]byte, deletes []string, message string) {
	flat := f.flatten(f.commits[f.head].Tree)
	for p, content := range files {
		flat[p] = hubEntry{Mode: "100644", SHA: f.putBlob(content)}
	}
	for _, p := range deletes {
		delete(flat, p)
	}
	f.head = f.putCommit(hubCommit{Tree: f.writeTree(flat), Parent: f.head, Message: message})
}

func (f *fakeHub) counts() map[string]int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return map[string]int{
		"treeGets": f.treeGets, "treeBatches": f.treeBatches, "commits": f.commitsMade, "blobPosts": f.blobPosts,
		"lfsBatches": f.lfsBatches, "lfsPuts": f.lfsPuts, "mutations": f.mutations, "requests": f.requests,
	}
}

func (f *fakeHub) resetCounters() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.treeGets, f.treeBatches, f.commitsMade, f.blobPosts, f.blobGets = 0, 0, 0, 0, 0
	f.lfsBatches, f.lfsPuts, f.mutations, f.refUpdates, f.requests = 0, 0, 0, 0, 0
	f.mutationBytes = nil
	f.landedAdds = nil
	f.log = nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (f *fakeHub) serve(w http.ResponseWriter, r *http.Request) {
	urlPath := strings.TrimPrefix(r.URL.Path, "/api/v3")
	repoPrefix := "/repos/" + hubOwner + "/" + hubRepo
	lfsPrefix := "/" + hubOwner + "/" + hubRepo + ".git/info/lfs"

	f.mu.Lock()
	f.requests++
	f.log = append(f.log, r.Method+" "+r.URL.Path)
	f.mu.Unlock()

	switch {
	case r.Method == http.MethodPost && (urlPath == "/graphql" || r.URL.Path == "/api/graphql"):
		f.handleGraphQL(w, r)
	case strings.HasPrefix(urlPath, lfsPrefix+"/objects/batch"):
		f.handleLFSBatch(w, r)
	case strings.HasPrefix(urlPath, "/lfs-storage/"):
		f.handleLFSPut(w, r, strings.TrimPrefix(urlPath, "/lfs-storage/"))
	case strings.HasPrefix(urlPath, repoPrefix+"/"):
		if r.Header.Get("Authorization") != "Bearer "+hubToken {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Bad credentials"})
			return
		}
		f.handleREST(w, r, strings.TrimPrefix(urlPath, repoPrefix+"/"))
	default:
		http.NotFound(w, r)
	}
}

func (f *fakeHub) handleREST(w http.ResponseWriter, r *http.Request, route string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	switch {
	case r.Method == http.MethodGet && route == "branches/"+hubBranch:
		if f.head == "" {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "Branch not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"name": hubBranch, "commit": map[string]any{
			"sha": f.head, "commit": map[string]any{"tree": map[string]string{"sha": f.commits[f.head].Tree}},
		}})

	case r.Method == http.MethodGet && route == "git/ref/heads/"+hubBranch:
		writeJSON(w, http.StatusOK, map[string]any{"object": map[string]string{"sha": f.head}})

	case r.Method == http.MethodGet && strings.HasPrefix(route, "git/commits/"):
		sha := strings.TrimPrefix(route, "git/commits/")
		commit, ok := f.commits[sha]
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "Not Found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"sha": sha, "tree": map[string]string{"sha": commit.Tree}})

	case r.Method == http.MethodGet && strings.HasPrefix(route, "git/trees/"):
		f.treeGets++
		f.serveTree(w, strings.TrimPrefix(route, "git/trees/"), r.URL.Query().Get("recursive") != "")

	case r.Method == http.MethodGet && strings.HasPrefix(route, "git/blobs/"):
		f.blobGets++
		sha := strings.TrimPrefix(route, "git/blobs/")
		content, ok := f.blobs[sha]
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"message": "Not Found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"sha": sha, "encoding": "base64", "content": base64.StdEncoding.EncodeToString(content), "size": len(content)})

	case r.Method == http.MethodPost && route == "git/blobs":
		f.blobPosts++
		body, _ := io.ReadAll(r.Body)
		if f.blobBodyCap > 0 && len(body) > f.blobBodyCap {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"message": "Request body too large"})
			return
		}
		var req struct{ Content, Encoding string }
		if err := json.Unmarshal(body, &req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
			return
		}
		content := []byte(req.Content)
		if req.Encoding == "base64" {
			content, _ = base64.StdEncoding.DecodeString(req.Content)
		}
		writeJSON(w, http.StatusCreated, map[string]string{"sha": f.putBlob(content)})

	case r.Method == http.MethodPost && route == "git/trees":
		f.treeBatches++
		f.createTree(w, r)

	case r.Method == http.MethodPost && route == "git/commits":
		var req struct {
			Message string
			Tree    string
			Parents []string
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || f.trees[req.Tree] == nil && req.Tree != f.putTree(nil) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"message": "Tree SHA does not exist"})
			return
		}
		f.commitsMade++
		sha := f.putCommit(hubCommit{Tree: req.Tree, Parent: req.Parents[0], Message: req.Message})
		writeJSON(w, http.StatusCreated, map[string]any{"sha": sha, "tree": map[string]string{"sha": req.Tree}})

	case r.Method == http.MethodPatch && route == "git/refs/heads/"+hubBranch:
		f.refUpdates++
		var req struct {
			SHA   string
			Force bool
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if hook := f.beforeRefUpdate; hook != nil {
			f.mu.Unlock()
			fault := hook(f.refUpdates)
			f.mu.Lock()
			if f.fault(w, fault, func() { f.head = req.SHA }) {
				return
			}
		}
		commit, ok := f.commits[req.SHA]
		if !ok {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"message": "Object does not exist"})
			return
		}
		if commit.Parent != f.head && !req.Force {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"message": "Update is not a fast forward"})
			return
		}
		f.head = req.SHA
		writeJSON(w, http.StatusOK, map[string]any{"object": map[string]string{"sha": req.SHA}})

	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Not Found: " + r.Method + " " + route})
	}
}

func (f *fakeHub) serveTree(w http.ResponseWriter, sha string, recursive bool) {
	items, ok := f.trees[sha]
	if !ok && sha != f.putTree(nil) {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Not Found"})
		return
	}

	type entry struct {
		Path string `json:"path"`
		Mode string `json:"mode"`
		Type string `json:"type"`
		SHA  string `json:"sha"`
		Size int    `json:"size,omitempty"`
	}
	var entries []entry
	var walk func(prefix string, items []hubTreeItem)
	walk = func(prefix string, items []hubTreeItem) {
		for _, item := range items {
			full := joinTreePath(prefix, item.Name)
			if item.isTree() {
				entries = append(entries, entry{Path: full, Mode: "040000", Type: "tree", SHA: item.SHA})
				if recursive {
					walk(full, f.trees[item.SHA])
				}
				continue
			}
			entries = append(entries, entry{Path: full, Mode: item.Mode, Type: "blob", SHA: item.SHA, Size: len(f.blobs[item.SHA])})
		}
	}
	walk("", items)

	truncated := false
	if f.truncateAbove > 0 && len(entries) > f.truncateAbove {
		entries, truncated = entries[:f.truncateAbove], true
	}
	writeJSON(w, http.StatusOK, map[string]any{"sha": sha, "tree": entries, "truncated": truncated})
}

func (f *fakeHub) createTree(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BaseTree string `json:"base_tree"`
		Tree     []struct {
			Path    string  `json:"path"`
			Mode    string  `json:"mode"`
			Type    string  `json:"type"`
			SHA     *string `json:"sha"`
			Content *string `json:"content"`
		} `json:"tree"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	flat := map[string]hubEntry{}
	if req.BaseTree != "" {
		if _, ok := f.trees[req.BaseTree]; !ok && req.BaseTree != f.putTree(nil) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"message": "base_tree is not a valid tree"})
			return
		}
		flat = f.flatten(req.BaseTree)
	}
	for _, e := range req.Tree {
		switch {
		case e.Content != nil:
			flat[e.Path] = hubEntry{Mode: e.Mode, SHA: f.putBlob([]byte(*e.Content))}
		case e.SHA == nil:
			delete(flat, e.Path)
		default:
			if _, ok := f.blobs[*e.SHA]; !ok {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"message": "tree.sha " + *e.SHA + " is not a valid blob"})
				return
			}
			flat[e.Path] = hubEntry{Mode: strings.TrimPrefix(e.Mode, "0"), SHA: *e.SHA}
		}
	}
	if conflict := fileDirConflict(flat); conflict != "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"message": "GitRPC::BadObjectState: " + conflict + " is both a file and a directory"})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"sha": f.writeTree(flat)})
}

// fileDirConflict returns a path the flat tree has as a file and, through a longer
// path, as a directory; GitHub rejects such trees.
func fileDirConflict(flat map[string]hubEntry) string {
	for p := range flat {
		for dir := path.Dir(p); dir != "."; dir = path.Dir(dir) {
			if _, ok := flat[dir]; ok {
				return dir
			}
		}
	}
	return ""
}

// fault answers a request with an injected failure; land is applied first for
// faultDropAfterLanding. It reports whether the request was answered.
func (f *fakeHub) fault(w http.ResponseWriter, fault hubFault, land func()) bool {
	switch fault {
	case faultRateLimit:
		w.Header().Set("X-RateLimit-Remaining", "0")
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Hour).Unix(), 10))
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "API rate limit exceeded"})
	case faultShortRateLimit:
		w.Header().Set("Retry-After", "2")
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "You have exceeded a secondary rate limit"})
	case faultBadGateway:
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": "Server Error"})
	case faultDropAfterLanding:
		land()
		hijacker, ok := w.(http.Hijacker)
		if !ok {
			f.t.Fatal("response writer can't be hijacked")
		}
		conn, _, err := hijacker.Hijack()
		if err != nil {
			f.t.Fatal(err)
		}
		conn.Close()
	default:
		return false
	}
	return true
}

func (f *fakeHub) handleGraphQL(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)

	f.mu.Lock()
	defer f.mu.Unlock()

	if f.noGraphQL {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Not Found"})
		return
	}
	if !strings.Contains(string(body), "createCommitOnBranch") {
		writeJSON(w, http.StatusOK, map[string]any{"errors": []map[string]string{{"message": "unexpected query"}}})
		return
	}

	f.mutations++
	f.mutationBytes = append(f.mutationBytes, len(body))
	if f.mutationBodyCap > 0 && len(body) > f.mutationBodyCap {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"message": "Request body too large"})
		return
	}

	var req struct {
		Variables struct {
			Input struct {
				Branch struct {
					RepositoryNameWithOwner string
					BranchName              string
				}
				ExpectedHeadOid string
				Message         struct{ Headline, Body string }
				FileChanges     struct {
					Additions []struct{ Path, Contents string }
					Deletions []struct{ Path string }
				}
			}
		}
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}
	input := req.Variables.Input
	if input.Branch.RepositoryNameWithOwner != hubOwner+"/"+hubRepo || input.Branch.BranchName != hubBranch {
		writeJSON(w, http.StatusOK, map[string]any{"errors": []map[string]string{{"type": "NOT_FOUND", "message": "Could not resolve to a Ref"}}})
		return
	}

	apply := func() map[string]hubEntry {
		base := f.flatten(f.commits[f.head].Tree)
		flat := maps.Clone(base)
		for _, d := range input.FileChanges.Deletions {
			delete(flat, d.Path)
		}
		for _, a := range input.FileChanges.Additions {
			content, _ := base64.StdEncoding.DecodeString(a.Contents)
			mode := "100644"
			if existing, ok := base[a.Path]; ok {
				mode = existing.Mode
			}
			flat[a.Path] = hubEntry{Mode: mode, SHA: f.putBlob(content)}
		}
		return flat
	}
	land := func() string {
		flat := apply()
		var added []string
		for _, a := range input.FileChanges.Additions {
			added = append(added, a.Path)
		}
		f.commitsMade++
		f.landedAdds = append(f.landedAdds, added)
		f.head = f.putCommit(hubCommit{Tree: f.writeTree(flat), Parent: f.head, Message: input.Message.Headline})
		return f.head
	}

	if hook := f.beforeMutation; hook != nil {
		f.mu.Unlock()
		fault := hook(f.mutations)
		f.mu.Lock()
		if f.fault(w, fault, func() {
			if input.ExpectedHeadOid == f.head {
				land()
			}
		}) {
			return
		}
	}

	if input.ExpectedHeadOid != f.head {
		writeJSON(w, http.StatusOK, map[string]any{"errors": []map[string]string{{
			"type":    "STALE_DATA",
			"message": fmt.Sprintf("Expected branch to point to %q but it did not. Pull and try again.", input.ExpectedHeadOid),
		}}})
		return
	}
	for _, d := range input.FileChanges.Deletions {
		if _, ok := f.flatten(f.commits[f.head].Tree)[d.Path]; !ok {
			writeJSON(w, http.StatusOK, map[string]any{"errors": []map[string]string{{"message": "A path was requested for deletion which does not exist as of commit oid"}}})
			return
		}
	}

	if conflict := fileDirConflict(apply()); conflict != "" {
		writeJSON(w, http.StatusOK, map[string]any{"errors": []map[string]string{{"message": "A path was requested for addition that conflicts with " + conflict}}})
		return
	}

	head := land()
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"createCommitOnBranch": map[string]any{
		"commit": map[string]any{"oid": head, "tree": map[string]string{"oid": f.commits[head].Tree}},
	}}})
}

func (f *fakeHub) handleLFSBatch(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.lfsBatches++
	if f.lfsQuota {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"message": "LFS storage quota exceeded"})
		return
	}

	var req struct {
		Operation string
		Objects   []struct {
			OID  string
			Size int64
		}
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	var objects []map[string]any
	for _, o := range req.Objects {
		object := map[string]any{"oid": o.OID, "size": o.Size}
		if _, ok := f.lfs[o.OID]; !ok {
			object["actions"] = map[string]any{"upload": map[string]any{"href": f.srv.URL + "/lfs-storage/" + o.OID}}
		}
		objects = append(objects, object)
	}
	w.Header().Set("Content-Type", "application/vnd.git-lfs+json")
	writeJSON(w, http.StatusOK, map[string]any{"transfer": "basic", "objects": objects})
}

func (f *fakeHub) handleLFSPut(w http.ResponseWriter, r *http.Request, oid string) {
	content, err := io.ReadAll(r.Body)
	if err != nil {
		return
	}
	sum := sha256.Sum256(content)
	if hex.EncodeToString(sum[:]) != oid {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"message": "oid mismatch"})
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.lfsPuts++
	f.lfs[oid] = content
	w.WriteHeader(http.StatusOK)
}

// setHeadTree points the branch at an arbitrary tree SHA without storing the tree, for
// runs that must never read it.
func (f *fakeHub) setHeadTree(tree string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.head = f.putCommit(hubCommit{Tree: tree, Parent: f.head, Message: "synthetic"})
}
