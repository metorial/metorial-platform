package gitremote_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const testToken = "super-secret-token-1234"

var sampleFiles = map[string]string{
	"README.md":                          "hello\n",
	"plugins/a/plugin.json":              `{"name":"a"}`,
	"plugins/a/skills/one/SKILL.md":      "# one\n",
	"plugins/a/skills/two/SKILL.md":      "# two\n",
	"plugins/b/plugin.json":              `{"name":"b"}`,
	"plugins/b/skills/three/SKILL.md":    "# three\n",
	"plugins/b/skills/three/assets/x.sh": "#!/bin/sh\necho x\n",
	".claude-plugin/marketplace.json":    `{"plugins":[]}`,
}

func listingLines(t *testing.T, l *remotestate.Listing) []string {
	t.Helper()

	var lines []string
	if err := l.Walk(func(e remotestate.Entry) error {
		lines = append(lines, fmt.Sprintf("%s %s %s", e.Mode, e.SHA, e.Path))
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	sort.Strings(lines)
	return lines
}

func assertMatchesLsTree(t *testing.T, repo *gittest.Repo, l *remotestate.Listing, commit, tree string) {
	t.Helper()

	want := repo.LsTree(commit)
	got := listingLines(t, l)
	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("listing differs from git ls-tree\n got: %v\nwant: %v", got, want)
	}
	if tree != repo.TreeOf(commit) || l.TreeSHA() != tree {
		t.Fatalf("tree = %s, listing tree = %s, want %s", tree, l.TreeSHA(), repo.TreeOf(commit))
	}
	if l.CommitSHA != commit {
		t.Fatalf("commit = %s, want %s", l.CommitSHA, commit)
	}
}

func fetchOptions(server *gittest.Server) gitremote.FetchOptions {
	return gitremote.FetchOptions{
		URL:        server.RepoURL(),
		Branch:     "main",
		AuthHeader: gitremote.BasicAuth("x-access-token", testToken),
		AllowHTTP:  true,
	}
}

func uploadPackBodies(server *gittest.Server) []string {
	var bodies []string
	for _, req := range server.Requests() {
		if req.Method == http.MethodPost && strings.HasSuffix(req.Path, "/git-upload-pack") {
			bodies = append(bodies, string(req.Body))
		}
	}
	return bodies
}

func TestBloblessFetchMatchesLsTree(t *testing.T) {
	for _, protocol := range []struct {
		name string
		v0   bool
	}{{"v2", false}, {"v0", true}} {
		t.Run(protocol.name, func(t *testing.T) {
			repo := gittest.NewRepo(t, sampleFiles)
			repo.Commit(map[string]string{"plugins/a/skills/one/SKILL.md": "# one v2\n"}, "second")
			server := repo.Serve()
			server.AuthHeader = gitremote.BasicAuth("x-access-token", testToken)

			opts := fetchOptions(server)
			opts.DisableProtocolV2 = protocol.v0

			listing, commit, tree, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
			if err != nil {
				t.Fatal(err)
			}
			assertMatchesLsTree(t, repo, listing, repo.Head("main"), tree)
			if commit != repo.Head("main") {
				t.Fatalf("commit = %s", commit)
			}

			bodies := uploadPackBodies(server)
			fetch := bodies[len(bodies)-1]
			if !strings.Contains(fetch, "filter blob:none") || !strings.Contains(fetch, "deepen 1") {
				t.Fatalf("fetch request lacks filter/deepen: %q", fetch)
			}
			if protocol.v0 == strings.Contains(fetch, "command=fetch") {
				t.Fatalf("wrong protocol in %q", fetch)
			}
		})
	}
}

func TestIncrementalFetchSendsHaveAndReusesCachedTrees(t *testing.T) {
	files := map[string]string{}
	for i := 0; i < 40; i++ {
		files[fmt.Sprintf("plugins/p%02d/skills/s/SKILL.md", i)] = fmt.Sprintf("# %d\n", i)
	}
	repo := gittest.NewRepo(t, files)
	first := repo.Head("main")
	server := repo.Serve()

	base, _, _, err := gitremote.Client{}.FetchRemoteState(context.Background(), fetchOptions(server))
	if err != nil {
		t.Fatal(err)
	}
	fullBytes := lastFetchResponseBytes(server)

	repo.Commit(map[string]string{
		"plugins/p03/skills/s/SKILL.md": "# changed\n",
		"README.md":                     "readme\n",
	}, "edit")
	repo.Git("update-ref", "refs/heads/main", repo.Head("main"))
	head := repo.Head("main")

	for _, v0 := range []bool{false, true} {
		server.Reset()
		opts := fetchOptions(server)
		opts.DisableProtocolV2 = v0
		opts.Have = []string{first}
		opts.Base = cloneListing(t, base)

		listing, commit, tree, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
		if err != nil {
			t.Fatal(err)
		}
		if commit != head {
			t.Fatalf("commit = %s, want %s", commit, head)
		}
		assertMatchesLsTree(t, repo, listing, head, tree)

		bodies := uploadPackBodies(server)
		if !strings.Contains(bodies[len(bodies)-1], "have "+first) {
			t.Fatalf("fetch did not send have: %q", bodies[len(bodies)-1])
		}
		if incremental := lastFetchResponseBytes(server); incremental >= fullBytes {
			t.Fatalf("incremental fetch returned %d bytes, full fetch %d", incremental, fullBytes)
		}
	}
}

func cloneListing(t *testing.T, l *remotestate.Listing) *remotestate.Listing {
	t.Helper()

	var entries []remotestate.Entry
	_ = l.Walk(func(e remotestate.Entry) error {
		entries = append(entries, e)
		return nil
	})
	clone, err := remotestate.FromEntries(l.CommitSHA, entries)
	if err != nil {
		t.Fatal(err)
	}
	return clone
}

func lastFetchResponseBytes(server *gittest.Server) int64 {
	requests := server.Requests()
	for i := len(requests) - 1; i >= 0; i-- {
		if strings.HasSuffix(requests[i].Path, "/git-upload-pack") && strings.Contains(string(requests[i].Body), "done") {
			return requests[i].ResponseBytes
		}
	}
	return -1
}

func TestIncrementalFetchFallsBackWhenCacheIsInconsistent(t *testing.T) {
	repo := gittest.NewRepo(t, sampleFiles)
	first := repo.Head("main")
	repo.Commit(map[string]string{"README.md": "changed\n"}, "edit")
	server := repo.Serve()

	bogus, err := remotestate.FromEntries(first, []remotestate.Entry{{Path: "other.txt", Mode: remotestate.ModeFile, SHA: strings.Repeat("a", 40)}})
	if err != nil {
		t.Fatal(err)
	}

	opts := fetchOptions(server)
	opts.Have = []string{first}
	opts.Base = bogus

	listing, commit, tree, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
	if err != nil {
		t.Fatal(err)
	}
	assertMatchesLsTree(t, repo, listing, commit, tree)
	if n := len(uploadPackBodies(server)); n < 2 {
		t.Fatalf("expected a retry without have, got %d upload-pack requests", n)
	}
}

func TestIncrementalFetchAfterHistoryRewrite(t *testing.T) {
	repo := gittest.NewRepo(t, sampleFiles)
	first := repo.Head("main")
	server := repo.Serve()

	base, _, _, err := gitremote.Client{}.FetchRemoteState(context.Background(), fetchOptions(server))
	if err != nil {
		t.Fatal(err)
	}

	orphan := repo.Git("commit-tree", repo.TreeOf(first), "-m", "rewritten")
	repo.Git("update-ref", "refs/heads/main", orphan)

	opts := fetchOptions(server)
	opts.Have, opts.Base = []string{first}, base
	listing, commit, tree, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
	if err != nil {
		t.Fatal(err)
	}
	if commit != orphan {
		t.Fatalf("commit = %s, want %s", commit, orphan)
	}
	assertMatchesLsTree(t, repo, listing, orphan, tree)
}

func TestUnchangedHeadSkipsFetch(t *testing.T) {
	repo := gittest.NewRepo(t, sampleFiles)
	server := repo.Serve()
	head := repo.Head("main")

	base, _, _, err := gitremote.Client{}.FetchRemoteState(context.Background(), fetchOptions(server))
	if err != nil {
		t.Fatal(err)
	}
	server.Reset()

	opts := fetchOptions(server)
	opts.Have, opts.Base = []string{head}, base
	listing, _, tree, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
	if err != nil {
		t.Fatal(err)
	}
	if listing != base || tree != repo.TreeOf(head) {
		t.Fatal("expected the cached listing back")
	}
	for _, body := range uploadPackBodies(server) {
		if strings.Contains(body, "command=fetch") {
			t.Fatal("fetched although the head was unchanged")
		}
	}
	if n := len(server.Requests()); n > 2 {
		t.Fatalf("made %d requests", n)
	}
}

func TestFilterUnsupported(t *testing.T) {
	repo := gittest.NewRepo(t, sampleFiles)
	repo.Git("config", "uploadpack.allowFilter", "false")
	server := repo.Serve()

	for _, v0 := range []bool{false, true} {
		opts := fetchOptions(server)
		opts.DisableProtocolV2 = v0

		if _, _, _, err := (gitremote.Client{}).FetchRemoteState(context.Background(), opts); !errors.Is(err, gitremote.ErrFilterUnsupported) {
			t.Fatalf("err = %v, want ErrFilterUnsupported", err)
		}

		server.Reset()
		opts.AllowUnfiltered = true
		listing, commit, tree, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
		if err != nil {
			t.Fatal(err)
		}
		assertMatchesLsTree(t, repo, listing, commit, tree)

		bodies := uploadPackBodies(server)
		if fetch := bodies[len(bodies)-1]; strings.Contains(fetch, "filter") || !strings.Contains(fetch, "deepen 1") {
			t.Fatalf("unexpected fallback request %q", fetch)
		}
	}
}

func TestBranchMissing(t *testing.T) {
	for _, files := range []map[string]string{sampleFiles, nil} {
		repo := gittest.NewRepo(t, files)
		server := repo.Serve()

		for _, v0 := range []bool{false, true} {
			opts := fetchOptions(server)
			opts.Branch = "does-not-exist"
			opts.DisableProtocolV2 = v0
			if _, _, _, err := (gitremote.Client{}).FetchRemoteState(context.Background(), opts); !errors.Is(err, gitremote.ErrBranchMissing) {
				t.Fatalf("err = %v, want ErrBranchMissing", err)
			}
		}
	}
}

func TestSizeLimits(t *testing.T) {
	repo := gittest.NewRepo(t, sampleFiles)
	server := repo.Serve()

	tests := []struct {
		name   string
		modify func(*gitremote.FetchOptions)
	}{
		{"pack", func(o *gitremote.FetchOptions) { o.MaxPackBytes = 64 }},
		{"advertisement", func(o *gitremote.FetchOptions) { o.MaxAdvertisementBytes = 16; o.DisableProtocolV2 = true }},
		{"entries", func(o *gitremote.FetchOptions) { o.MaxEntries = 3 }},
		{"objects", func(o *gitremote.FetchOptions) { o.MaxObjects = 2 }},
		{"object bytes", func(o *gitremote.FetchOptions) { o.MaxObjectBytes = 16 }},
		{"inflated bytes", func(o *gitremote.FetchOptions) { o.MaxInflatedBytes = 64 }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts := fetchOptions(server)
			tt.modify(&opts)
			if _, _, _, err := (gitremote.Client{}).FetchRemoteState(context.Background(), opts); !errors.Is(err, gitremote.ErrTooLarge) {
				t.Fatalf("err = %v, want ErrTooLarge", err)
			}
		})
	}
}

func TestCrossHostRedirectIsRefused(t *testing.T) {
	var leaked []string
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		leaked = append(leaked, r.Header.Get("Authorization"))
		http.Error(w, "nope", http.StatusNotFound)
	}))
	defer other.Close()

	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, other.URL+r.URL.RequestURI(), http.StatusFound)
	}))
	defer redirector.Close()

	opts := gitremote.FetchOptions{URL: redirector.URL + "/repo.git", Branch: "main", AuthHeader: gitremote.BasicAuth("x", testToken), AllowHTTP: true}
	_, _, _, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
	if !errors.Is(err, gitremote.ErrRedirect) {
		t.Fatalf("err = %v, want ErrRedirect", err)
	}
	if len(leaked) != 0 {
		t.Fatalf("redirect target was contacted: %v", leaked)
	}
}

func TestCredentialsStayInTheHeader(t *testing.T) {
	repo := gittest.NewRepo(t, sampleFiles)
	server := repo.Serve()
	server.AuthHeader = gitremote.BasicAuth("x-access-token", "right-token")

	opts := fetchOptions(server)
	_, _, _, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)
	if !errors.Is(err, gitremote.ErrUnauthorized) {
		t.Fatalf("err = %v, want ErrUnauthorized", err)
	}
	if strings.Contains(err.Error(), testToken) {
		t.Fatalf("error leaks the token: %v", err)
	}
	for _, req := range server.Requests() {
		if strings.Contains(req.Path+"?"+req.Query, testToken) {
			t.Fatalf("token in URL: %s?%s", req.Path, req.Query)
		}
	}

	for _, bad := range []string{"https://user:pass@example.com/repo.git", "http://example.com/repo.git", "ftp://example.com/repo.git"} {
		opts := gitremote.FetchOptions{URL: bad, Branch: "main"}
		if _, _, _, err := (gitremote.Client{}).FetchRemoteState(context.Background(), opts); err == nil || strings.Contains(err.Error(), "pass") {
			t.Fatalf("%s: err = %v", bad, err)
		}
	}
}

func TestRateLimited(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "120")
		http.Error(w, "slow down", http.StatusTooManyRequests)
	}))
	defer server.Close()

	before := time.Now()
	opts := gitremote.FetchOptions{URL: server.URL + "/repo.git", Branch: "main", AllowHTTP: true}
	_, _, _, err := gitremote.Client{}.FetchRemoteState(context.Background(), opts)

	var rateLimited *commitbatch.RateLimitedError
	if !errors.As(err, &rateLimited) {
		t.Fatalf("err = %v, want RateLimitedError", err)
	}
	if wait := rateLimited.RetryAfter.Sub(before); wait < 119*time.Second || wait > 125*time.Second {
		t.Fatalf("retry after %v", wait)
	}
}

func TestRetryAfterHeaders(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	tests := []struct {
		name   string
		header http.Header
		want   time.Time
	}{
		{"seconds", http.Header{"Retry-After": {"30"}}, now.Add(30 * time.Second)},
		{"date", http.Header{"Retry-After": {now.Add(time.Minute).UTC().Format(http.TimeFormat)}}, now.Add(time.Minute)},
		{"gitlab reset", http.Header{"Ratelimit-Reset": {"1800000090"}}, time.Unix(1_800_000_090, 0)},
		{"github reset", http.Header{"X-Ratelimit-Reset": {"1800000060"}}, time.Unix(1_800_000_060, 0)},
		{"delta reset", http.Header{"Ratelimit-Reset": {"15"}}, now.Add(15 * time.Second)},
		{"none", http.Header{}, time.Time{}},
		{"garbage", http.Header{"Retry-After": {"soon"}}, time.Time{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := gitremote.RetryAfter(tt.header, now); !got.Equal(tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}
