package github

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

func nestedFiles() map[string][]byte {
	files := map[string][]byte{"README.md": []byte("readme")}
	for p := 0; p < 10; p++ {
		for s := 0; s < 5; s++ {
			for f := 0; f < 10; f++ {
				files[fmt.Sprintf("plugins/p%d/skills/s%d/f%d.md", p, s, f)] = []byte(fmt.Sprintf("%d/%d/%d", p, s, f))
			}
		}
	}
	return files
}

func (f *fakeHub) reader(include func(string) bool) *remoteReader {
	return &remoteReader{
		api:     &restClient{http: f.srv.Client(), repoURL: f.srv.URL + "/repos/" + hubOwner + "/" + hubRepo, token: hubToken, now: time.Now, sleep: sleepContext},
		include: include,
		logf:    func(string, ...any) {},
	}
}

func blobsOf(t *testing.T, l *remotestate.Listing) map[string]string {
	t.Helper()

	out := map[string]string{}
	if err := l.Blobs(func(e remotestate.Entry) error {
		out[e.Path] = e.SHA
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestRemoteReaderTruncatedTreeMatchesUntruncated(t *testing.T) {
	hub := newFakeHub(t, nestedFiles())
	head, tree := hub.Head()

	full, complete, err := hub.reader(nil).ReadRemote(context.Background(), head, tree, nil)
	if err != nil || !complete {
		t.Fatalf("untruncated read: complete %v, %v", complete, err)
	}
	if hub.treeGets != 1 {
		t.Fatalf("untruncated read took %d tree requests", hub.treeGets)
	}

	hub.truncateAbove = 40
	hub.treeGets = 0
	truncated, complete, err := hub.reader(nil).ReadRemote(context.Background(), head, tree, nil)
	if err != nil || !complete {
		t.Fatalf("truncated read: complete %v, %v", complete, err)
	}
	if hub.treeGets < 3 {
		t.Errorf("truncated read took only %d tree requests", hub.treeGets)
	}

	if truncated.TreeSHA() != tree || full.TreeSHA() != tree {
		t.Errorf("tree SHAs %s / %s, want %s", truncated.TreeSHA(), full.TreeSHA(), tree)
	}
	if err := truncated.Verify(); err != nil {
		t.Errorf("truncated listing isn't complete: %v", err)
	}
	want, got := blobsOf(t, full), blobsOf(t, truncated)
	if len(got) != len(want) || len(got) != 501 {
		t.Fatalf("got %d blobs, want %d", len(got), len(want))
	}
	for p, sha := range want {
		if got[p] != sha {
			t.Errorf("%s: %s, want %s", p, got[p], sha)
		}
	}
}

func TestRemoteReaderSkipsSubtreesTheManifestDoesNotTouch(t *testing.T) {
	files := nestedFiles()
	for i := 0; i < 30; i++ {
		files[fmt.Sprintf("docs/d%d/page.md", i)] = []byte(fmt.Sprint(i))
	}
	hub := newFakeHub(t, files)
	hub.truncateAbove = 40
	head, tree := hub.Head()

	x := &hubFixture{t: t, storage: &countingStorage{Storage: manifesttest.NewStorage()}}
	m := x.manifest(map[string][]byte{"plugins/p1/skills/s1/f1.md": []byte("1/1/1")})

	listing, complete, err := hub.reader(manifestDirs(context.Background(), m)).ReadRemote(context.Background(), head, tree, nil)
	if err != nil {
		t.Fatal(err)
	}
	if complete {
		t.Error("a listing that skipped docs/ was reported complete")
	}
	if listing.TreeSHA() != tree {
		t.Errorf("tree SHA %s, want %s", listing.TreeSHA(), tree)
	}
	if _, ok := listing.Lookup("plugins/p9/skills/s4/f9.md"); !ok {
		t.Error("in-scope file missing")
	}
	if _, ok := listing.Lookup("docs/d0/page.md"); ok {
		t.Error("docs/ was listed")
	}
	if entry, ok := listing.Lookup("docs"); !ok || !entry.Mode.IsTree() {
		t.Error("docs/ tree entry missing")
	}
}

func TestRemoteReaderCapsSubtreeRequests(t *testing.T) {
	files := map[string][]byte{}
	for i := 0; i < maxSubtreeRequests/2+50; i++ {
		files[fmt.Sprintf("d%04d/a", i)] = []byte("a")
		files[fmt.Sprintf("d%04d/b", i)] = []byte(fmt.Sprint(i))
	}
	hub := newFakeHub(t, files)
	hub.truncateAbove = 1
	head, tree := hub.Head()

	_, _, err := hub.reader(nil).ReadRemote(context.Background(), head, tree, nil)
	exportErr, ok := export.As(err)
	if !ok || exportErr.Code != export.CodeTreeTooLarge {
		t.Fatalf("err = %v, want tree_too_large", err)
	}
	if hub.treeGets > maxSubtreeRequests+1 {
		t.Errorf("made %d tree requests", hub.treeGets)
	}
}

func TestUploadToRepoIterSeesFilesInTruncatedTrees(t *testing.T) {
	files := nestedFiles()
	unchanged := binary(7, 4096)
	files["plugins/p3/skills/s2/icon.bin"] = unchanged
	hub := newFakeHub(t, files)
	hub.truncateAbove = 40

	added := binary(8, 4096)
	err := UploadToRepo(context.Background(), UploadOptions{
		Owner:       hubOwner,
		Repo:        hubRepo,
		Branch:      hubBranch,
		Token:       hubToken,
		BaseURL:     hub.srv.URL,
		LFSEndpoint: hub.srv.URL + "/" + hubOwner + "/" + hubRepo + ".git/info/lfs",
	}, []FileToUpload{
		{Path: "plugins/p3/skills/s2/icon.bin", Size: int64(len(unchanged)), Open: gitlfs.OpenerForBytes(unchanged)},
		{Path: "plugins/p3/skills/s2/new.bin", Size: int64(len(added)), Open: gitlfs.OpenerForBytes(added)},
	})
	if err != nil {
		t.Fatal(err)
	}

	if hub.blobPosts != 1 {
		t.Errorf("posted %d blobs, want only the new file's", hub.blobPosts)
	}
	got := hub.Files()
	if len(got) != len(files)+1 || string(got["plugins/p3/skills/s2/new.bin"]) != string(added) {
		t.Errorf("remote has %d files after the upload", len(got))
	}
}
