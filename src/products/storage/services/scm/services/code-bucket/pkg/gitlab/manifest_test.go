package gitlab

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitpush"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
)

var manifestScope = manifest.Scope{Dirs: []string{"plugins"}, Files: []string{".claude-plugin/marketplace.json"}}

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

func withUserFiles(files map[string]string, extra ...string) map[string]string {
	out := map[string]string{"README.md": "user readme\n"}
	for k, v := range files {
		out[k] = v
	}
	for i := 0; i+1 < len(extra); i += 2 {
		out[extra[i]] = extra[i+1]
	}
	return out
}

type exportFixture struct {
	t         *testing.T
	gitlab    *fakeGitLab
	manifests *gittest.Manifests
	listings  *gittest.Listings

	mu   sync.Mutex
	logs bytes.Buffer
}

func newExportFixture(t *testing.T, files map[string]string) *exportFixture {
	t.Parallel()
	return &exportFixture{t: t, gitlab: newFakeGitLab(t, files), manifests: gittest.NewManifests(t, manifestScope), listings: gittest.NewListings()}
}

func (f *exportFixture) options(files map[string]string, state *export.RemoteState) ManifestExportOptions {
	options := f.manifests.Options(files)
	options.Listings = f.listings
	options.RemoteState = state
	return ManifestExportOptions{
		UploadOptions: UploadOptions{
			ProjectID:     fakeProjectID,
			Branch:        "main",
			CommitMessage: "Sync skills",
			Token:         fakeToken,
			GitlabAPIURL:  f.gitlab.apiURL(),
		},
		ManifestOptions: options,
		AllowHTTP:       true,
		Sleep:           func(context.Context, time.Duration) error { return nil },
		Logf: func(format string, args ...any) {
			f.mu.Lock()
			defer f.mu.Unlock()
			fmt.Fprintf(&f.logs, format+"\n", args...)
		},
	}
}

func (f *exportFixture) export(opts ManifestExportOptions) (*export.Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return ExportManifest(ctx, opts)
}

func (f *exportFixture) mustExport(opts ManifestExportOptions) *export.Result {
	f.t.Helper()
	result, err := f.export(opts)
	if err != nil {
		f.t.Fatalf("export: %v", err)
	}
	return result
}

func (f *exportFixture) assertTree(want map[string]string) {
	f.t.Helper()

	repo := f.gitlab.repo
	var wantPaths []string
	for path := range want {
		wantPaths = append(wantPaths, path)
	}
	sort.Strings(wantPaths)
	if got := repo.Git("ls-tree", "-r", "--name-only", "main"); got != strings.Join(wantPaths, "\n") {
		f.t.Fatalf("tree:\n%s\nwant:\n%s", got, strings.Join(wantPaths, "\n"))
	}
	for path, content := range want {
		if got := repo.Show("main", path); got != content {
			f.t.Fatalf("%s = %q, want %q", path, got, content)
		}
	}
}

func TestExportManifestReadsOverGitAndCommitsThroughTheAPI(t *testing.T) {
	f := newExportFixture(t, initialFiles)

	result := f.mustExport(f.options(updatedFiles, nil))

	f.assertTree(withUserFiles(updatedFiles))
	if n := f.gitlab.count("GET /repository/files/"); n != 0 {
		t.Fatalf("%d per-file lookups", n)
	}
	if n := f.gitlab.count("GET /repository/tree"); n != 0 {
		t.Fatalf("%d REST tree reads with git available", n)
	}
	if n := f.gitlab.count("git /" + gittest.RepoName + "/git-upload-pack"); n == 0 {
		t.Fatal("no blobless fetch")
	}

	commits := f.gitlab.recordedCommits()
	if result.CommitsCreated != uint32(len(commits)) || len(commits) == 0 {
		t.Fatalf("CommitsCreated = %d, commits = %d", result.CommitsCreated, len(commits))
	}
	actions := map[string]string{}
	for _, commit := range commits {
		for _, action := range commit.Actions {
			actions[action.FilePath] = action.Action
		}
	}
	want := map[string]string{
		"plugins/b/SKILL.md":              "update",
		"plugins/c/SKILL.md":              "create",
		"plugins/c/copy.md":               "create",
		".claude-plugin/marketplace.json": "update",
		"plugins/old/notes.md":            "delete",
	}
	if fmt.Sprint(actions) != fmt.Sprint(want) {
		t.Fatalf("actions = %v, want %v", actions, want)
	}

	head := f.gitlab.repo.Head("main")
	if state := result.NewRemoteState; state == nil || state.CommitSHA != head || state.TreeSHA != f.gitlab.repo.TreeOf(head) {
		t.Fatalf("NewRemoteState = %+v, want %s/%s", result.NewRemoteState, head, f.gitlab.repo.TreeOf(head))
	}
	if result.Stats.GithubRequests == 0 {
		t.Fatal("requests not counted")
	}
}

func TestExportManifestWarmCacheMakesNoReads(t *testing.T) {
	f := newExportFixture(t, initialFiles)
	first := f.mustExport(f.options(updatedFiles, nil))
	fetches := f.gitlab.count("git /" + gittest.RepoName + "/git-upload-pack")

	second := f.mustExport(f.options(updatedFiles, first.NewRemoteState))

	if second.CommitsCreated != 0 {
		t.Fatalf("second export committed %d times", second.CommitsCreated)
	}
	upload := f.gitlab.count("git /" + gittest.RepoName + "/git-upload-pack")
	if upload-fetches > 1 {
		t.Fatalf("warm export made %d upload-pack requests, want only ls-refs", upload-fetches)
	}
	if f.gitlab.count("GET /repository/tree") != 0 {
		t.Fatal("REST tree read")
	}
}

func TestExportManifestFallsBackToRESTListing(t *testing.T) {
	tests := []struct {
		name  string
		setup func(f *exportFixture, opts *ManifestExportOptions)
	}{
		{name: "force rest", setup: func(f *exportFixture, opts *ManifestExportOptions) { opts.ForceREST = true }},
		{name: "git disabled", setup: func(f *exportFixture, opts *ManifestExportOptions) { f.gitlab.gitDisabled = true }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newExportFixture(t, initialFiles)
			opts := f.options(updatedFiles, nil)
			tt.setup(f, &opts)

			f.mustExport(opts)

			f.assertTree(withUserFiles(updatedFiles))
			if f.gitlab.count("GET /repository/tree") == 0 {
				t.Fatal("REST tree API not used")
			}
		})
	}
}

func TestExportManifestRESTFallbackUsesTheGitCache(t *testing.T) {
	f := newExportFixture(t, initialFiles)
	cold := f.options(updatedFiles, nil)
	cold.ForceREST = true
	if result := f.mustExport(cold); result.NewRemoteState != nil {
		t.Fatalf("REST mode cached a listing without a tree SHA from the server: %+v", result.NewRemoteState)
	}

	cached := f.mustExport(f.options(updatedFiles, nil))
	if cached.NewRemoteState == nil {
		t.Fatal("git mode did not cache the listing")
	}
	trees := f.gitlab.count("GET /repository/tree")

	warm := f.options(updatedFiles, cached.NewRemoteState)
	warm.ForceREST = true
	if result := f.mustExport(warm); result.CommitsCreated != 0 {
		t.Fatalf("warm REST run committed %d times", result.CommitsCreated)
	}
	if f.gitlab.count("GET /repository/tree") != trees {
		t.Fatal("warm REST run listed the tree again")
	}
}

func TestRESTListingMatchesBloblessFetch(t *testing.T) {
	t.Parallel()
	files := map[string]string{}
	for i := 0; i < 260; i++ {
		files[fmt.Sprintf("plugins/p%03d/skills/s/SKILL.md", i)] = fmt.Sprintf("skill %d\n", i)
	}
	files["bin/run.sh"] = "#!/bin/sh\n"
	f := newFakeGitLab(t, files)
	head := f.repo.Head("main")

	api := &apiClient{http: http.DefaultClient, projectID: fakeProjectID, token: fakeToken, now: time.Now, sleep: func(context.Context, time.Duration) error { return nil }}
	api.baseURL = mustParse(t, f.apiURL())
	r := &remote{api: api, branch: "main", logf: t.Logf}
	rest, err := r.restListing(context.Background(), head)
	if err != nil {
		t.Fatal(err)
	}

	blobless, _, _, err := gitremote.Client{}.FetchRemoteState(context.Background(), gitremote.FetchOptions{URL: f.server.RepoURL(), Branch: "main", AuthHeader: f.gitAuth(), AllowHTTP: true})
	if err != nil {
		t.Fatal(err)
	}

	if rest.TreeSHA() != blobless.TreeSHA() || rest.TreeSHA() != f.repo.TreeOf(head) {
		t.Fatalf("REST tree %s, blobless %s, git %s", rest.TreeSHA(), blobless.TreeSHA(), f.repo.TreeOf(head))
	}
	if pages := f.count("GET /repository/tree"); pages < 3 {
		t.Fatalf("%d tree pages, want keyset pagination", pages)
	}
}

func TestExportManifestHalvesOn413(t *testing.T) {
	f := newExportFixture(t, initialFiles)
	files := map[string]string{}
	for i := 0; i < 8; i++ {
		files[fmt.Sprintf("plugins/p%d/SKILL.md", i)] = strings.Repeat(fmt.Sprint(i), 40<<10)
	}
	f.gitlab.maxBodyBytes = 150 << 10
	opts := f.options(files, nil)
	opts.Tuning = export.Tuning{BatchInitialBytes: 2 << 20, BatchMaxBytes: 2 << 20}

	result := f.mustExport(opts)

	if result.Stats.BatchSizeReductions == 0 {
		t.Fatal("no batch size reductions")
	}
	f.assertTree(withUserFiles(files))
}

func TestExportManifestReplacesFilesAndDirectoriesOfTheOtherKind(t *testing.T) {
	f := newExportFixture(t, withUserFiles(map[string]string{
		"plugins/a/skills":            "a file where a directory goes\n",
		"plugins/b/notes/one.md":      "1\n",
		"plugins/b/notes/deep/two.md": "2\n",
	}))
	files := map[string]string{
		"plugins/a/skills/s/SKILL.md": "skill s\n",
		"plugins/b/notes":             "a file where a directory was\n",
	}
	for i := 0; i < 4; i++ {
		files[fmt.Sprintf("plugins/p%d/SKILL.md", i)] = strings.Repeat(fmt.Sprint(i), 40<<10)
	}
	f.gitlab.maxBodyBytes = 150 << 10
	opts := f.options(files, nil)
	opts.Tuning = export.Tuning{BatchInitialBytes: 2 << 20, BatchMaxBytes: 2 << 20}

	result := f.mustExport(opts)

	if result.CommitsCreated < 2 || result.Stats.Deleted != 3 {
		t.Fatalf("commits = %d, stats = %+v", result.CommitsCreated, result.Stats)
	}
	f.assertTree(withUserFiles(files))
}

func TestExportManifestForeignParentRecomputes(t *testing.T) {
	f := newExportFixture(t, initialFiles)
	var once sync.Once
	f.gitlab.beforeCommit = func(n int) {
		once.Do(func() {
			f.gitlab.repo.Commit(map[string]string{"docs/race.md": "race\n", "plugins/old/notes.md": ""}, "racing commit")
		})
	}

	result := f.mustExport(f.options(updatedFiles, nil))

	f.assertTree(withUserFiles(updatedFiles, "docs/race.md", "race\n"))
	if result.NewRemoteState != nil && result.NewRemoteState.TreeSHA != f.gitlab.repo.TreeOf("main") {
		t.Fatalf("cached a wrong tree: %+v", result.NewRemoteState)
	}
}

func TestExportManifestRateLimitReset(t *testing.T) {
	t.Run("too long to wait", func(t *testing.T) {
		f := newExportFixture(t, initialFiles)
		reset := time.Now().Add(10 * time.Minute).Unix()
		f.gitlab.commitHandler = func(w http.ResponseWriter, n int) bool {
			w.Header().Set("RateLimit-Reset", fmt.Sprint(reset))
			http.Error(w, `{"message":"Retry later"}`, http.StatusTooManyRequests)
			return true
		}

		_, err := f.export(f.options(updatedFiles, nil))

		exportErr, ok := export.As(err)
		if !ok || exportErr.Code != export.CodeRateLimited || exportErr.Progress.RetryAfter.Unix() != reset {
			t.Fatalf("err = %v, want rate_limited until %d", err, reset)
		}
	})

	t.Run("short wait", func(t *testing.T) {
		f := newExportFixture(t, initialFiles)
		f.gitlab.commitHandler = func(w http.ResponseWriter, n int) bool {
			if n > 0 {
				return false
			}
			f.gitlab.commitHandler = nil
			w.Header().Set("Retry-After", "5")
			http.Error(w, `{"message":"Retry later"}`, http.StatusTooManyRequests)
			return true
		}
		var slept time.Duration
		opts := f.options(updatedFiles, nil)
		opts.Sleep = func(ctx context.Context, d time.Duration) error { slept += d; return nil }

		result := f.mustExport(opts)

		if slept < 4*time.Second || result.Stats.RateLimitWaitMs == 0 {
			t.Fatalf("slept %s, RateLimitWaitMs %d", slept, result.Stats.RateLimitWaitMs)
		}
		f.assertTree(withUserFiles(updatedFiles))
	})
}

func TestExportManifestUploadsLFS(t *testing.T) {
	f := newExportFixture(t, initialFiles)
	f.gitlab.lfs = gittest.NewLFSServer(t)
	big := strings.Repeat("model weights ", 50)
	files := withUserFiles(updatedFiles, "plugins/c/model.bin", big)
	delete(files, "README.md")

	opts := f.options(files, nil)
	opts.LFSThresholdBytes = 200
	result := f.mustExport(opts)

	oid := gittest.PointerOID(f.gitlab.repo.Show("main", "plugins/c/model.bin"))
	if data, ok := f.gitlab.lfs.Object(oid); oid == "" || !ok || string(data) != big {
		t.Fatal("LFS object not uploaded")
	}
	if !strings.Contains(f.gitlab.repo.Show("main", ".gitattributes"), "plugins/c/model.bin filter=lfs") {
		t.Fatal(".gitattributes missing the LFS rule")
	}
	for _, auth := range f.gitlab.lfs.Authorizations() {
		if auth != f.gitlab.gitAuth() {
			t.Fatalf("LFS Authorization = %q", auth)
		}
	}
	if result.Stats.LFSUploaded != 1 {
		t.Fatalf("LFSUploaded = %d", result.Stats.LFSUploaded)
	}
}

func TestExportManifestContentMismatch(t *testing.T) {
	f := newExportFixture(t, initialFiles)
	opts := f.options(updatedFiles, nil)
	entry := gittest.NewManifests(t, manifestScope).Storage.PutContent("plugins/c/SKILL.md", []byte("skill c\n"))
	f.manifests.Storage.Put("test-files", entry.Key, []byte("tampered\n"))

	_, err := f.export(opts)

	if exportErr, ok := export.As(err); !ok || exportErr.Code != export.CodeContentMismatch {
		t.Fatalf("err = %v, want content_mismatch", err)
	}
	for _, commit := range f.gitlab.recordedCommits() {
		for _, action := range commit.Actions {
			if action.FilePath == "plugins/c/SKILL.md" {
				t.Fatal("tampered file was committed")
			}
		}
	}
}

func TestExportManifestTokensNeverLogged(t *testing.T) {
	f := newExportFixture(t, initialFiles)
	f.gitlab.commitHandler = func(w http.ResponseWriter, n int) bool {
		http.Error(w, `{"message":"403 Forbidden"}`, http.StatusForbidden)
		return true
	}

	_, err := f.export(f.options(updatedFiles, &export.RemoteState{CommitSHA: strings.Repeat("a", 40), TreeSHA: strings.Repeat("b", 40), ListingKey: "missing"}))

	if err == nil {
		t.Fatal("expected an error")
	}
	for _, text := range []string{err.Error(), f.logs.String()} {
		if strings.Contains(text, fakeToken) {
			t.Fatalf("token leaked: %s", text)
		}
	}
}

func TestExportManifestRefusesForeignGitHost(t *testing.T) {
	t.Parallel()
	logf := func(string, ...any) {}
	api := mustParse(t, "https://gitlab.example.com/api/v4")
	if got := sameHostGitURL(api, "https://evil.example.net/group/repo.git", logf); got != "" {
		t.Fatalf("accepted %q", got)
	}
	if got := sameHostGitURL(api, "http://gitlab.example.com/group/repo.git", logf); got != "" {
		t.Fatalf("accepted a downgrade: %q", got)
	}
	if got := sameHostGitURL(api, "https://gitlab.example.com/group/repo.git", logf); got != "https://gitlab.example.com/group/repo.git" {
		t.Fatalf("got %q", got)
	}
}

func TestEffectiveThresholdForGitLab(t *testing.T) {
	if got := gitpush.EffectiveLFSThreshold(0, DefaultMaxFileBytes); got != DefaultMaxFileBytes+1 {
		t.Fatalf("got %d", got)
	}
}

func mustParse(t *testing.T, raw string) *url.URL {
	t.Helper()
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}

func TestExportManifestReportsASampleOfMissingSources(t *testing.T) {
	f := newExportFixture(t, initialFiles)
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
	if len(f.gitlab.recordedCommits()) != 0 {
		t.Fatal("nothing should be committed while sources are missing")
	}
}
