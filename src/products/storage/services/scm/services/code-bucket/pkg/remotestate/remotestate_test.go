package remotestate

import (
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"testing"
)

type gitRepo struct {
	t   *testing.T
	dir string
}

func newGitRepo(t *testing.T) *gitRepo {
	t.Helper()

	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not on PATH")
	}

	repo := &gitRepo{t: t, dir: t.TempDir()}
	repo.run("", "init", "-q")
	return repo
}

func (r *gitRepo) run(stdin string, args ...string) string {
	r.t.Helper()

	cmd := exec.Command("git", args...)
	cmd.Dir = r.dir
	cmd.Env = append(cmd.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_CONFIG_GLOBAL=/dev/null")
	cmd.Stdin = strings.NewReader(stdin)

	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		r.t.Fatalf("git %v: %v\n%s", args, err, stderr.String())
	}
	return strings.TrimSpace(stdout.String())
}

func (r *gitRepo) blob(content string) string {
	return r.run(content, "hash-object", "-w", "--stdin")
}

func (r *gitRepo) stage(mode Mode, sha, p string) {
	r.run("", "update-index", "--add", "--cacheinfo", fmt.Sprintf("%s,%s,%s", mode, sha, p))
}

func (r *gitRepo) remove(p string) {
	r.run("", "update-index", "--force-remove", "--", p)
}

func (r *gitRepo) writeTree() string {
	return r.run("", "write-tree")
}

// lsTree returns every tree and blob below tree in git's order, as git prints it.
func (r *gitRepo) lsTree(tree string) []Entry {
	out := r.run("", "ls-tree", "-r", "-t", "-z", "--full-tree", tree)

	var entries []Entry
	for _, record := range strings.Split(strings.TrimSuffix(out, "\x00"), "\x00") {
		if record == "" {
			continue
		}
		meta, p, _ := strings.Cut(record, "\t")
		fields := strings.Fields(meta)
		mode, err := ParseMode(fields[0])
		if err != nil {
			r.t.Fatal(err)
		}
		entries = append(entries, Entry{Path: p, Mode: mode, SHA: fields[2]})
	}
	return entries
}

func walkAll(t *testing.T, l *Listing) []Entry {
	t.Helper()

	var entries []Entry
	if err := l.Walk(func(e Entry) error {
		entries = append(entries, e)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return entries
}

func assertSameEntries(t *testing.T, got, want []Entry) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("got %d entries, want %d\ngot:  %v\nwant: %v", len(got), len(want), got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("entry %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

// Names chosen to exercise git's tree ordering, where a tree sorts as "name/".
var orderingPaths = []string{
	"a", "a.b", "a-b", "a0", "b/x", "b.txt", "b-c/d", "b0",
	"foo/bar", "foo.txt", "foo-bar", "foo/baz/qux", "foo/baz.md",
	"plugins/acme/SKILL.md", "plugins/acme/assets/logo.png", "plugins/acme-2/SKILL.md",
	"plugins/Acme/SKILL.md", "dir with space/file name.md", "ünïcode/文件.md", "z",
}

func stageFixture(repo *gitRepo) {
	for _, p := range orderingPaths {
		repo.stage(ModeFile, repo.blob("content of "+p+"\n"), p)
	}
	repo.stage(ModeExecutable, repo.blob("#!/bin/sh\necho hi\n"), "bin/run.sh")
	repo.stage(ModeSymlink, repo.blob("../a"), "links/a")
	repo.stage(ModeSubmodule, "1111111111111111111111111111111111111111", "vendor/sub")
	repo.stage(ModeFile, repo.blob(""), "empty")
}

func blobsOf(entries []Entry) []Entry {
	var blobs []Entry
	for _, e := range entries {
		if !e.Mode.IsTree() {
			blobs = append(blobs, e)
		}
	}
	return blobs
}

func TestTreeSHAMatchesGitFromBlobsOnly(t *testing.T) {
	repo := newGitRepo(t)
	stageFixture(repo)
	tree := repo.writeTree()
	gitEntries := repo.lsTree(tree)

	listing, err := FromEntries("", blobsOf(gitEntries))
	if err != nil {
		t.Fatal(err)
	}

	if got := listing.TreeSHA(); got != tree {
		t.Fatalf("TreeSHA() = %s, git write-tree = %s", got, tree)
	}
	assertSameEntries(t, walkAll(t, listing), gitEntries)
}

func TestBlobsAreInManifestOrder(t *testing.T) {
	repo := newGitRepo(t)
	stageFixture(repo)

	listing, err := FromEntries("", blobsOf(repo.lsTree(repo.writeTree())))
	if err != nil {
		t.Fatal(err)
	}

	var last string
	if err := listing.Blobs(func(e Entry) error {
		if last != "" && e.Path <= last {
			t.Fatalf("%q after %q is not in byte order", e.Path, last)
		}
		last = e.Path
		return nil
	}); err != nil {
		t.Fatal(err)
	}
}

func TestApplyMatchesGit(t *testing.T) {
	repo := newGitRepo(t)
	stageFixture(repo)
	baseTree := repo.writeTree()

	listing, err := FromEntries("base", repo.lsTree(baseTree))
	if err != nil {
		t.Fatal(err)
	}
	if listing.TreeSHA() != baseTree {
		t.Fatal("base listing doesn't reproduce the base tree")
	}

	steps := []struct {
		name    string
		changes func() []Change
	}{
		{"modify a file", func() []Change {
			sha := repo.blob("changed\n")
			repo.stage(ModeFile, sha, "plugins/acme/SKILL.md")
			return []Change{{Path: "plugins/acme/SKILL.md", SHA: sha}}
		}},
		{"add files in new directories", func() []Change {
			a, b := repo.blob("new a\n"), repo.blob("new b\n")
			repo.stage(ModeFile, a, "plugins/new/skills/qa/SKILL.md")
			repo.stage(ModeFile, b, "plugins/new.json")
			return []Change{{Path: "plugins/new/skills/qa/SKILL.md", SHA: a}, {Path: "plugins/new.json", SHA: b}}
		}},
		{"delete a file and prune its empty directory", func() []Change {
			repo.remove("b-c/d")
			return []Change{{Path: "b-c/d", Delete: true}}
		}},
		{"delete a whole subtree", func() []Change {
			repo.remove("foo/bar")
			repo.remove("foo/baz/qux")
			repo.remove("foo/baz.md")
			return []Change{{Path: "foo", Delete: true}}
		}},
		{"make a file executable", func() []Change {
			sha := repo.blob("content of a\n")
			repo.stage(ModeExecutable, sha, "a")
			return []Change{{Path: "a", Mode: ModeExecutable, SHA: sha}}
		}},
		{"move a file", func() []Change {
			entry, _ := listing.Lookup("plugins/acme/assets/logo.png")
			repo.remove("plugins/acme/assets/logo.png")
			repo.stage(ModeFile, entry.SHA, "plugins/acme/logo.png")
			return []Change{{Path: "plugins/acme/assets/logo.png", Delete: true}, {Path: "plugins/acme/logo.png", SHA: entry.SHA}}
		}},
	}

	for _, step := range steps {
		t.Run(step.name, func(t *testing.T) {
			if err := listing.Apply(step.changes()); err != nil {
				t.Fatal(err)
			}

			tree := repo.writeTree()
			if got := listing.TreeSHA(); got != tree {
				t.Fatalf("TreeSHA() = %s, git = %s", got, tree)
			}
			assertSameEntries(t, walkAll(t, listing), repo.lsTree(tree))
		})
	}
}

func TestEncodeDecodeRoundTrip(t *testing.T) {
	repo := newGitRepo(t)
	stageFixture(repo)
	tree := repo.writeTree()

	listing, err := FromEntries("2222222222222222222222222222222222222222", repo.lsTree(tree))
	if err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := Encode(&buf, listing); err != nil {
		t.Fatal(err)
	}
	decoded, err := Decode(bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}

	if decoded.CommitSHA != listing.CommitSHA || decoded.TreeSHA() != tree || decoded.Len() != listing.Len() {
		t.Fatalf("decoded commit=%s tree=%s len=%d", decoded.CommitSHA, decoded.TreeSHA(), decoded.Len())
	}
	assertSameEntries(t, walkAll(t, decoded), walkAll(t, listing))
}

func TestDecodeRejectsInconsistentListings(t *testing.T) {
	listing, err := FromEntries("", []Entry{
		{Path: "a/b", Mode: ModeFile, SHA: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"},
		{Path: "c", Mode: ModeFile, SHA: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"},
	})
	if err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := Encode(&buf, listing); err != nil {
		t.Fatal(err)
	}

	var raw bytes.Buffer
	gz, _ := gzipReader(buf.Bytes())
	raw.ReadFrom(gz)
	corrupted := strings.Replace(raw.String(), "c\x00", "d\x00", 1)

	if _, err := Decode(bytes.NewReader(gzipBytes([]byte(corrupted)))); err == nil {
		t.Fatal("a listing whose entries don't hash to its tree must be rejected")
	}
	if _, err := Decode(bytes.NewReader([]byte("not gzip"))); err == nil {
		t.Fatal("garbage must be rejected")
	}
}

func TestEmptyListings(t *testing.T) {
	l := New()
	if l.TreeSHA() != EmptyTreeSHA {
		t.Fatalf("empty listing = %s", l.TreeSHA())
	}

	if err := l.Apply([]Change{{Path: "a/b/c", SHA: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"}}); err != nil {
		t.Fatal(err)
	}
	if err := l.Apply([]Change{{Path: "a/b/c", Delete: true}}); err != nil {
		t.Fatal(err)
	}
	if l.TreeSHA() != EmptyTreeSHA || l.Len() != 0 {
		t.Fatalf("after deleting everything: tree=%s len=%d", l.TreeSHA(), l.Len())
	}
}

func TestApplyRejectsConflicts(t *testing.T) {
	sha := "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
	newListing := func() *Listing {
		l, err := FromEntries("", []Entry{{Path: "dir/file", Mode: ModeFile, SHA: sha}, {Path: "file", Mode: ModeFile, SHA: sha}})
		if err != nil {
			t.Fatal(err)
		}
		return l
	}

	tests := []struct {
		name   string
		change Change
		want   error
	}{
		{"file under a file", Change{Path: "file/x", SHA: sha}, ErrConflict},
		{"file over a directory", Change{Path: "dir", SHA: sha}, ErrConflict},
		{"delete missing", Change{Path: "missing", Delete: true}, ErrNotFound},
		{"delete under missing directory", Change{Path: "nope/x", Delete: true}, ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := newListing().Apply([]Change{tt.change}); !errors.Is(err, tt.want) {
				t.Fatalf("got %v, want %v", err, tt.want)
			}
		})
	}

	if err := newListing().Apply([]Change{{Path: "x", SHA: "not-a-sha"}}); err == nil {
		t.Fatal("invalid SHA must be rejected")
	}
	if err := newListing().Apply([]Change{{Path: "a//b", SHA: sha}}); err == nil {
		t.Fatal("empty segment must be rejected")
	}
}

func TestModeString(t *testing.T) {
	tests := map[Mode]string{
		ModeFile: "100644", ModeExecutable: "100755", ModeSymlink: "120000", ModeTree: "40000", ModeSubmodule: "160000",
	}
	for mode, want := range tests {
		if mode.String() != want {
			t.Errorf("%d.String() = %s, want %s", mode, mode.String(), want)
		}
		parsed, err := ParseMode(want)
		if err != nil || parsed != mode {
			t.Errorf("ParseMode(%s) = %v, %v", want, parsed, err)
		}
	}
}

func TestObjectKey(t *testing.T) {
	if got := ObjectKey("remote-state/osr_1/", "abc"); got != "remote-state/osr_1/abc.bin" {
		t.Fatal(got)
	}
}
