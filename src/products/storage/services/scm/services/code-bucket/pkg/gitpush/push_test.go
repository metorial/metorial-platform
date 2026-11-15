package gitpush_test

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/packfile"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitpush"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
)

const token = "s3cr3t-push-token"

var scope = manifest.Scope{Dirs: []string{"plugins"}, Files: []string{".claude-plugin/marketplace.json"}}

var initialFiles = map[string]string{
	"README.md":                       "user readme\n",
	"plugins/a/SKILL.md":              "skill a\n",
	"plugins/b/SKILL.md":              "skill b\n",
	"plugins/old/notes.md":            "old\n",
	".claude-plugin/marketplace.json": `{"v":1}`,
}

var updatedFiles = map[string]string{
	"plugins/a/SKILL.md":              "skill a\n",
	"plugins/b/SKILL.md":              "skill b v2\n",
	"plugins/c/SKILL.md":              "skill c\n",
	"plugins/c/copy.md":               "skill a\n",
	".claude-plugin/marketplace.json": `{"v":2}`,
}

type fixture struct {
	t         *testing.T
	repo      *gittest.Repo
	server    *gittest.Server
	manifests *gittest.Manifests
	listings  *gittest.Listings

	mu   sync.Mutex
	logs bytes.Buffer
}

func newFixture(t *testing.T, files map[string]string) *fixture {
	t.Parallel()

	repo := gittest.NewRepo(t, files)
	server := repo.Serve()
	server.AuthHeader = gitremote.BasicAuth("x-token-auth", token)
	return &fixture{t: t, repo: repo, server: server, manifests: gittest.NewManifests(t, scope), listings: gittest.NewListings()}
}

func (f *fixture) logf(format string, args ...any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	fmt.Fprintf(&f.logs, format+"\n", args...)
}

func (f *fixture) options(files map[string]string, state *export.RemoteState) gitpush.ExportOptions {
	options := f.manifests.Options(files)
	options.Listings = f.listings
	options.RemoteState = state
	return gitpush.ExportOptions{
		Fetch: gitremote.FetchOptions{
			URL:        f.server.RepoURL(),
			Branch:     "main",
			AuthHeader: f.server.AuthHeader,
			AllowHTTP:  true,
		},
		Options:       options,
		CommitMessage: "Sync skills",
		Logf:          f.logf,
	}
}

func (f *fixture) export(opts gitpush.ExportOptions) (*export.Result, error) {
	f.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return gitpush.Export(ctx, opts)
}

func (f *fixture) mustExport(opts gitpush.ExportOptions) *export.Result {
	f.t.Helper()
	result, err := f.export(opts)
	if err != nil {
		f.t.Fatalf("export: %v", err)
	}
	return result
}

func (f *fixture) objects() map[string]bool {
	out := f.repo.Git("rev-list", "--objects", "--all")
	objects := map[string]bool{}
	for _, line := range strings.Split(out, "\n") {
		if sha, _, _ := strings.Cut(line, " "); sha != "" {
			objects[sha] = true
		}
	}
	return objects
}

func (f *fixture) pushes() []gittest.Request {
	var pushes []gittest.Request
	for _, req := range f.server.Requests() {
		if req.Method == http.MethodPost && strings.HasSuffix(req.Path, "/git-receive-pack") {
			pushes = append(pushes, req)
		}
	}
	return pushes
}

func (f *fixture) fetches() []gittest.Request {
	var fetches []gittest.Request
	for _, req := range f.server.Requests() {
		if req.Method == http.MethodPost && strings.HasSuffix(req.Path, "/git-upload-pack") && bytes.Contains(req.Body, []byte("command=fetch")) {
			fetches = append(fetches, req)
		}
	}
	return fetches
}

func (f *fixture) assertTree(want map[string]string) {
	f.t.Helper()

	var paths []string
	for _, line := range strings.Split(f.repo.Git("ls-tree", "-r", "--name-only", "main"), "\n") {
		if line != "" {
			paths = append(paths, line)
		}
	}
	var wantPaths []string
	for path := range want {
		wantPaths = append(wantPaths, path)
	}
	sort.Strings(wantPaths)
	if strings.Join(paths, ",") != strings.Join(wantPaths, ",") {
		f.t.Fatalf("paths = %v, want %v", paths, wantPaths)
	}
	for path, content := range want {
		if got := f.repo.Show("main", path); got != content {
			f.t.Fatalf("%s = %q, want %q", path, got, content)
		}
	}
}

type packObject struct {
	Hash plumbing.Hash
	Type plumbing.ObjectType
	Size int64
}

// packObjects decodes the pack in a receive-pack request body.
func packObjects(t *testing.T, body []byte) []packObject {
	t.Helper()

	index := bytes.Index(body, []byte("0000PACK"))
	if index < 0 {
		t.Fatalf("no pack in push body")
	}
	scanner := packfile.NewScanner(bytes.NewReader(body[index+4:]))
	_, count, err := scanner.Header()
	if err != nil {
		t.Fatal(err)
	}

	objects := make([]packObject, 0, count)
	for i := uint32(0); i < count; i++ {
		header, err := scanner.NextObjectHeader()
		if err != nil {
			t.Fatal(err)
		}
		if header.Type.IsDelta() {
			t.Fatalf("pushed pack contains a delta")
		}
		var content bytes.Buffer
		if _, _, err := scanner.NextObject(&content); err != nil {
			t.Fatal(err)
		}
		h := sha1.New()
		fmt.Fprintf(h, "%s %d\x00", header.Type, content.Len())
		h.Write(content.Bytes())
		objects = append(objects, packObject{Hash: plumbing.NewHash(hex.EncodeToString(h.Sum(nil))), Type: header.Type, Size: int64(content.Len())})
	}
	if _, err := scanner.Checksum(); err != nil {
		t.Fatal(err)
	}
	return objects
}

func merge(base map[string]string, files map[string]string, deleted ...string) map[string]string {
	out := map[string]string{}
	for k, v := range base {
		out[k] = v
	}
	for k, v := range files {
		out[k] = v
	}
	for _, path := range deleted {
		delete(out, path)
	}
	return out
}

func TestExportPushesOnlyNewObjects(t *testing.T) {
	f := newFixture(t, initialFiles)
	before := f.objects()
	baseHead := f.repo.Head("main")

	result := f.mustExport(f.options(updatedFiles, nil))

	f.assertTree(merge(updatedFiles, map[string]string{"README.md": "user readme\n"}))
	f.repo.Fsck()
	if base := f.repo.Git("merge-base", "--is-ancestor", baseHead, "main"); base != "" {
		t.Fatalf("unexpected output %q", base)
	}

	seen := map[plumbing.Hash]bool{}
	blobs := 0
	for _, push := range f.pushes() {
		for _, object := range packObjects(t, push.Body) {
			if before[object.Hash.String()] {
				t.Errorf("pushed %s %s, which the remote already had", object.Type, object.Hash)
			}
			if seen[object.Hash] {
				t.Errorf("pushed %s twice", object.Hash)
			}
			seen[object.Hash] = true
			if object.Type == plumbing.BlobObject {
				blobs++
			}
		}
		if bytes.Contains(push.Body, []byte(token)) {
			t.Fatal("token in push body")
		}
		if !bytes.Contains(push.Body, []byte("report-status")) || !bytes.Contains(push.Body, []byte("atomic")) {
			t.Fatalf("push did not request report-status and atomic: %q", push.Body[:min(len(push.Body), 200)])
		}
	}
	if blobs != 3 {
		t.Fatalf("pushed %d blobs, want 3 (b v2, c, marketplace v2)", blobs)
	}

	head := f.repo.Head("main")
	if result.CommitsCreated != uint32(len(f.pushes())) || result.CommitsCreated == 0 {
		t.Fatalf("CommitsCreated = %d with %d pushes", result.CommitsCreated, len(f.pushes()))
	}
	if result.Partial {
		t.Fatal("partial")
	}
	state := result.NewRemoteState
	if state == nil || state.CommitSHA != head || state.TreeSHA != f.repo.TreeOf(head) {
		t.Fatalf("NewRemoteState = %+v, want head %s tree %s", state, head, f.repo.TreeOf(head))
	}
	if commits := f.repo.Git("rev-list", "--count", baseHead+"..main"); commits != fmt.Sprint(result.CommitsCreated) {
		t.Fatalf("%s commits on the branch, result says %d", commits, result.CommitsCreated)
	}
	author := f.repo.Git("log", "-1", "--format=%an <%ae>|%s", "main")
	if !strings.HasPrefix(author, "Metorial <code-bucket@metorial.com>|Sync skills") {
		t.Fatalf("author/message = %q", author)
	}
}

func TestExportTypicalSyncIsOnePush(t *testing.T) {
	f := newFixture(t, initialFiles)
	baseHead := f.repo.Head("main")

	result := f.mustExport(f.options(updatedFiles, nil))

	f.assertTree(merge(updatedFiles, map[string]string{"README.md": "user readme\n"}))
	if pushes := len(f.pushes()); pushes != 1 || result.CommitsCreated != 1 {
		t.Fatalf("%d pushes, %d commits; want content, references, index files and deletes in one", pushes, result.CommitsCreated)
	}
	if result.Stats.BlobsReused != 1 || result.Stats.Deleted != 1 {
		t.Fatalf("stats = %+v", result.Stats)
	}
	if commits := f.repo.Git("rev-list", "--count", baseHead+"..main"); commits != "1" {
		t.Fatalf("%s commits on the branch", commits)
	}
	if subject := f.repo.Git("log", "-1", "--format=%s", "main"); subject != "Sync skills" {
		t.Fatalf("subject %q", subject)
	}
}

func TestExportWarmCacheSkipsFetch(t *testing.T) {
	f := newFixture(t, initialFiles)
	first := f.mustExport(f.options(updatedFiles, nil))
	f.server.Reset()

	second := f.mustExport(f.options(updatedFiles, first.NewRemoteState))

	if len(f.fetches()) != 0 || len(f.pushes()) != 0 {
		t.Fatalf("warm export made %d fetches and %d pushes", len(f.fetches()), len(f.pushes()))
	}
	if second.CommitsCreated != 0 || second.Stats.FilesUploaded != 0 {
		t.Fatalf("warm export wrote: %+v", second)
	}
	if second.NewRemoteState != nil {
		t.Fatalf("NewRemoteState = %+v, want nil (cache unchanged)", second.NewRemoteState)
	}
}

func TestExportForeignCommitFetchesIncrementally(t *testing.T) {
	f := newFixture(t, initialFiles)
	first := f.mustExport(f.options(updatedFiles, nil))
	f.repo.Commit(map[string]string{"docs/user.md": "user change\n"}, "user commit")
	f.server.Reset()

	files := merge(updatedFiles, map[string]string{"plugins/d/SKILL.md": "skill d\n"})
	second := f.mustExport(f.options(files, first.NewRemoteState))

	fetches := f.fetches()
	if len(fetches) != 1 {
		t.Fatalf("%d fetches, want 1", len(fetches))
	}
	if !bytes.Contains(fetches[0].Body, []byte("have "+first.NewRemoteState.CommitSHA)) {
		t.Fatalf("fetch did not offer the cached commit as a have")
	}
	f.assertTree(merge(files, map[string]string{"README.md": "user readme\n", "docs/user.md": "user change\n"}))
	if second.NewRemoteState.CommitSHA != f.repo.Head("main") {
		t.Fatal("stale remote state")
	}
}

func TestExportNonFastForwardRecomputes(t *testing.T) {
	f := newFixture(t, initialFiles)
	foreignHead := ""
	var once sync.Once
	f.server.Intercept = func(w http.ResponseWriter, r *http.Request) bool {
		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/git-receive-pack") {
			once.Do(func() {
				foreignHead = f.repo.Commit(map[string]string{"plugins/b/SKILL.md": "", "docs/race.md": "race\n"}, "racing commit")
			})
		}
		return false
	}

	result := f.mustExport(f.options(updatedFiles, nil))

	if foreignHead == "" {
		t.Fatal("no push happened")
	}
	if out := f.repo.Git("merge-base", "--is-ancestor", foreignHead, "main"); out != "" {
		t.Fatal(out)
	}
	f.assertTree(merge(updatedFiles, map[string]string{"README.md": "user readme\n", "docs/race.md": "race\n"}))
	f.repo.Fsck()
	if result.NewRemoteState == nil || result.NewRemoteState.TreeSHA != f.repo.TreeOf("main") {
		t.Fatalf("NewRemoteState = %+v", result.NewRemoteState)
	}
}

func TestExportAdvertisedHeadMovedRecomputes(t *testing.T) {
	f := newFixture(t, initialFiles)
	var once sync.Once
	f.server.Intercept = func(w http.ResponseWriter, r *http.Request) bool {
		if r.URL.Query().Get("service") == gitremote.ServiceReceivePack {
			once.Do(func() { f.repo.Commit(map[string]string{"docs/race.md": "race\n"}, "racing commit") })
		}
		return false
	}

	f.mustExport(f.options(updatedFiles, nil))
	f.assertTree(merge(updatedFiles, map[string]string{"README.md": "user readme\n", "docs/race.md": "race\n"}))
}

func TestExportContentMismatchAbortsThePush(t *testing.T) {
	f := newFixture(t, initialFiles)
	head := f.repo.Head("main")
	opts := f.options(updatedFiles, nil)
	entry := gittest.NewManifests(t, scope).Storage.PutContent("plugins/c/SKILL.md", []byte("skill c\n"))
	f.manifests.Storage.Put("test-files", entry.Key, []byte("tampered\n"))

	_, err := f.export(opts)

	exportErr, ok := export.As(err)
	if !ok || exportErr.Code != export.CodeContentMismatch || exportErr.Details.Path != "plugins/c/SKILL.md" {
		t.Fatalf("err = %v, want content_mismatch for plugins/c/SKILL.md", err)
	}
	if f.repo.Head("main") != head {
		t.Fatal("branch moved despite the mismatch")
	}
	f.repo.Fsck()
}

func TestExportUploadsLFSBeforePushing(t *testing.T) {
	f := newFixture(t, initialFiles)
	lfs := gittest.NewLFSServer(t)
	big := strings.Repeat("large binary payload ", 20)
	files := merge(updatedFiles, map[string]string{"plugins/c/model.bin": big})

	opts := f.options(files, nil)
	opts.LFSThresholdBytes = 100
	opts.LFS = gitlfs.Uploader{Client: gitlfs.NewClient(lfs.Endpoint(), "x-token-auth", token, nil), Ref: "refs/heads/main"}
	result := f.mustExport(opts)

	pointer := f.repo.Show("main", "plugins/c/model.bin")
	oid := gittest.PointerOID(pointer)
	if oid == "" {
		t.Fatalf("model.bin is not an LFS pointer: %q", pointer)
	}
	if data, ok := lfs.Object(oid); !ok || string(data) != big {
		t.Fatal("LFS server did not receive the object")
	}
	if attributes := f.repo.Show("main", ".gitattributes"); !strings.Contains(attributes, "plugins/c/model.bin filter=lfs") {
		t.Fatalf(".gitattributes = %q", attributes)
	}
	if result.Stats.LFSUploaded != 1 {
		t.Fatalf("LFSUploaded = %d", result.Stats.LFSUploaded)
	}
	for _, auth := range lfs.Authorizations() {
		if auth != gitremote.BasicAuth("x-token-auth", token) {
			t.Fatalf("LFS Authorization = %q", auth)
		}
	}
	f.repo.Fsck()
}

func TestExportSplitsLargePacks(t *testing.T) {
	f := newFixture(t, initialFiles)
	files := map[string]string{}
	for i := 0; i < 6; i++ {
		files[fmt.Sprintf("plugins/p%d/SKILL.md", i)] = strings.Repeat(fmt.Sprint(i), 300)
	}

	opts := f.options(files, nil)
	opts.MaxPackBytes = 700
	result := f.mustExport(opts)

	if len(f.pushes()) < 3 {
		t.Fatalf("%d pushes, want the content split over at least 3", len(f.pushes()))
	}
	for _, push := range f.pushes() {
		var blobBytes int64
		for _, object := range packObjects(t, push.Body) {
			if object.Type == plumbing.BlobObject {
				blobBytes += object.Size
			}
		}
		if blobBytes > 700 {
			t.Fatalf("a push carried %d bytes of blobs", blobBytes)
		}
	}
	f.assertTree(merge(files, map[string]string{"README.md": "user readme\n"}))
	if result.CommitsCreated != uint32(len(f.pushes())) {
		t.Fatalf("CommitsCreated = %d, pushes = %d", result.CommitsCreated, len(f.pushes()))
	}
}

func TestExportReplacesFilesAndDirectoriesOfTheOtherKind(t *testing.T) {
	remote := merge(initialFiles, map[string]string{
		"plugins/a/skills":            "a file where a directory goes\n",
		"plugins/b/notes/one.md":      "1\n",
		"plugins/b/notes/deep/two.md": "2\n",
	})
	files := map[string]string{
		"plugins/a/skills/s/SKILL.md": "skill s\n",
		"plugins/b/notes":             "a file where a directory was\n",
	}
	for i := 0; i < 4; i++ {
		files[fmt.Sprintf("plugins/p%d/SKILL.md", i)] = strings.Repeat(fmt.Sprint(i), 300)
	}

	for _, tc := range []struct {
		name         string
		maxPackBytes int64
		pushes       func(int) bool
	}{
		{name: "one push", pushes: func(n int) bool { return n == 1 }},
		{name: "split pushes", maxPackBytes: 700, pushes: func(n int) bool { return n >= 3 }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t, remote)
			opts := f.options(files, nil)
			if tc.maxPackBytes > 0 {
				opts.MaxPackBytes = tc.maxPackBytes
			}

			result := f.mustExport(opts)

			if pushes := len(f.pushes()); !tc.pushes(pushes) {
				t.Fatalf("%d pushes", pushes)
			}
			if result.Stats.Deleted != 7 {
				t.Fatalf("stats = %+v", result.Stats)
			}
			f.assertTree(merge(files, map[string]string{"README.md": "user readme\n"}))
			f.repo.Fsck()
		})
	}
}

func TestExportWriteBudgetIsPartial(t *testing.T) {
	f := newFixture(t, initialFiles)
	opts := f.options(updatedFiles, nil)
	opts.Options.WriteBudget = 1
	opts.MaxPackBytes = 12

	result := f.mustExport(opts)

	if !result.Partial || result.CommitsCreated != 1 || len(f.pushes()) != 1 {
		t.Fatalf("partial=%v commits=%d pushes=%d", result.Partial, result.CommitsCreated, len(f.pushes()))
	}

	f.server.Reset()
	resumed := f.mustExport(f.options(updatedFiles, result.NewRemoteState))
	if resumed.Partial {
		t.Fatal("resumed export is partial")
	}
	f.assertTree(merge(updatedFiles, map[string]string{"README.md": "user readme\n"}))
}

func TestExportSliceDeadlineIsPartial(t *testing.T) {
	f := newFixture(t, initialFiles)
	opts := f.options(updatedFiles, nil)
	opts.Options.Deadline = time.Now().Add(-time.Second)

	result := f.mustExport(opts)
	if !result.Partial || len(f.pushes()) != 0 {
		t.Fatalf("partial=%v pushes=%d", result.Partial, len(f.pushes()))
	}
}

func TestExportRateLimited(t *testing.T) {
	f := newFixture(t, initialFiles)
	f.server.Intercept = func(w http.ResponseWriter, r *http.Request) bool {
		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/git-receive-pack") {
			w.Header().Set("Retry-After", "600")
			w.WriteHeader(http.StatusTooManyRequests)
			return true
		}
		return false
	}

	_, err := f.export(f.options(updatedFiles, nil))

	exportErr, ok := export.As(err)
	if !ok || exportErr.Code != export.CodeRateLimited {
		t.Fatalf("err = %v, want rate_limited", err)
	}
	if wait := time.Until(exportErr.Progress.RetryAfter); wait < 9*time.Minute || wait > 11*time.Minute {
		t.Fatalf("RetryAfter in %s, want ~10m", wait)
	}
}

func TestExportDroppedResponseIsResolvedFromTheHead(t *testing.T) {
	f := newFixture(t, initialFiles)
	var once sync.Once
	f.server.Intercept = func(w http.ResponseWriter, r *http.Request) bool {
		if r.Method != http.MethodPost || !strings.HasSuffix(r.URL.Path, "/git-receive-pack") {
			return false
		}
		dropped := false
		once.Do(func() {
			dropped = true
			f.server.ServeBackend(httptest.NewRecorder(), r)
			conn, _, err := w.(http.Hijacker).Hijack()
			if err == nil {
				conn.Close()
			}
		})
		return dropped
	}

	result := f.mustExport(f.options(updatedFiles, nil))

	f.assertTree(merge(updatedFiles, map[string]string{"README.md": "user readme\n"}))
	if commits := f.repo.Git("rev-list", "--count", "main"); commits != fmt.Sprint(1+result.CommitsCreated) {
		t.Fatalf("%s commits, result says %d created", commits, result.CommitsCreated)
	}
}

func TestExportCrossHostRedirectIsRefused(t *testing.T) {
	f := newFixture(t, initialFiles)
	var leaked []string
	var mu sync.Mutex
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		leaked = append(leaked, r.Header.Get("Authorization"))
		mu.Unlock()
		http.NotFound(w, r)
	}))
	t.Cleanup(other.Close)
	f.server.Intercept = func(w http.ResponseWriter, r *http.Request) bool {
		if r.URL.Query().Get("service") == gitremote.ServiceReceivePack {
			http.Redirect(w, r, other.URL+r.URL.RequestURI(), http.StatusFound)
			return true
		}
		return false
	}

	_, err := f.export(f.options(updatedFiles, nil))

	if !errors.Is(err, gitremote.ErrRedirect) {
		t.Fatalf("err = %v, want ErrRedirect", err)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(leaked) != 0 {
		t.Fatalf("the other host received %d requests", len(leaked))
	}
}

func TestExportTokensNeverLogged(t *testing.T) {
	f := newFixture(t, initialFiles)
	f.server.Intercept = func(w http.ResponseWriter, r *http.Request) bool {
		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/git-receive-pack") {
			io.Copy(io.Discard, r.Body)
			http.Error(w, "denied for "+r.Header.Get("User-Agent"), http.StatusForbidden)
			return true
		}
		return false
	}
	opts := f.options(updatedFiles, &export.RemoteState{CommitSHA: strings.Repeat("a", 40), TreeSHA: strings.Repeat("b", 40), ListingKey: "missing"})

	_, err := f.export(opts)

	if err == nil {
		t.Fatal("expected an error")
	}
	for _, text := range []string{err.Error(), f.logs.String()} {
		if strings.Contains(text, token) || strings.Contains(text, gitremote.BasicAuth("x-token-auth", token)) {
			t.Fatalf("token leaked: %s", text)
		}
	}
}

func TestEffectiveLFSThreshold(t *testing.T) {
	tests := []struct {
		threshold, want int64
	}{
		{0, gitpush.MaxFileBytes + 1},
		{-1, gitpush.MaxFileBytes + 1},
		{10 << 20, 10 << 20},
		{gitpush.MaxFileBytes, gitpush.MaxFileBytes},
		{gitpush.MaxFileBytes * 2, gitpush.MaxFileBytes + 1},
	}
	for _, tt := range tests {
		if got := gitpush.EffectiveLFSThreshold(tt.threshold, gitpush.MaxFileBytes); got != tt.want {
			t.Errorf("EffectiveLFSThreshold(%d) = %d, want %d", tt.threshold, got, tt.want)
		}
	}
}

func TestExportReportsASampleOfMissingSources(t *testing.T) {
	f := newFixture(t, initialFiles)
	head := f.repo.Head("main")
	opts := f.options(updatedFiles, nil)
	missing := map[string]bool{}
	for _, p := range []string{"plugins/b/SKILL.md", "plugins/c/SKILL.md"} {
		key := manifesttest.EntryFor(p, []byte(updatedFiles[p])).Key
		f.manifests.Storage.Delete(manifesttest.SourceBucket, key)
		missing[key] = true
	}

	_, err := f.export(opts)

	exportErr, ok := export.As(err)
	if !ok || exportErr.Code != export.CodeSourceNotFound {
		t.Fatalf("err = %v, want source_not_found", err)
	}
	if len(exportErr.Details.Keys) != len(missing) {
		t.Fatalf("keys = %v, want %d missing keys", exportErr.Details.Keys, len(missing))
	}
	for _, key := range exportErr.Details.Keys {
		if !missing[key] {
			t.Fatalf("unexpected key %s", key)
		}
	}
	if f.repo.Head("main") != head {
		t.Fatal("branch moved despite the missing sources")
	}
}
