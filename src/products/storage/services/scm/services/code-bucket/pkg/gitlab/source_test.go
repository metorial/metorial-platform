package gitlab

import (
	"context"
	"errors"
	"io"
	"reflect"
	"sort"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
)

func legacyOptions(f *fakeGitLab) UploadOptions {
	return UploadOptions{
		ProjectID:     fakeProjectID,
		Branch:        "main",
		CommitMessage: "Upload files",
		Token:         fakeToken,
		GitlabAPIURL:  f.apiURL(),
		DeletePaths:   []string{"plugins/old/notes.md", "plugins/never/existed.md"},
	}
}

func TestUploadSourceParity(t *testing.T) {
	t.Parallel()

	runs := map[string]func(t *testing.T, f *fakeGitLab) error{
		"legacy iterator": func(t *testing.T, f *fakeGitLab) error {
			var files []FileToUpload
			for _, path := range sortedPaths(updatedFiles) {
				files = append(files, FileToUpload{Path: path, Content: []byte(updatedFiles[path])})
			}
			return UploadToRepo(legacyOptions(f), files)
		},
		"bucket source": func(t *testing.T, f *fakeGitLab) error {
			return UploadSource(context.Background(), legacyOptions(f), gittest.BucketSource(updatedFiles))
		},
		"manifest source": func(t *testing.T, f *fakeGitLab) error {
			manifests := gittest.NewManifests(t, manifestScope)
			opened := manifests.Open(updatedFiles)
			if err := UploadSource(context.Background(), legacyOptions(f), opened.Source(manifests.Storage)); err != nil {
				return err
			}
			unchanged := manifesttest.EntryFor("plugins/a/SKILL.md", []byte(updatedFiles["plugins/a/SKILL.md"]))
			if opens := manifests.Storage.Opens(manifesttest.SourceBucket, unchanged.Key); opens != 1 {
				t.Errorf("content shared by unchanged plugins/a and new plugins/c/copy.md was read %d times, want once", opens)
			}
			return nil
		},
	}

	type outcome struct {
		commits []recordedCommit
		tree    string
	}
	outcomes := map[string]outcome{}
	for name, run := range runs {
		f := newFakeGitLab(t, initialFiles)
		if err := run(t, f); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		outcomes[name] = outcome{commits: f.recordedCommits(), tree: f.repo.TreeOf("main")}
	}

	want := outcomes["legacy iterator"]
	if len(want.commits) == 0 {
		t.Fatal("legacy run made no commits")
	}
	for name, got := range outcomes {
		if !reflect.DeepEqual(got.commits, want.commits) || got.tree != want.tree {
			t.Fatalf("%s produced different commits:\n%+v\nwant:\n%+v", name, got.commits, want.commits)
		}
	}
}

type oversizedSource struct{}

func (oversizedSource) Walk(ctx context.Context, fn func(manifest.SourceFile) error) error {
	return fn(manifest.SourceFile{
		Path: "plugins/big/model.bin",
		Size: filelimit.MaxBufferedFileBytes + 1,
		Open: func(context.Context) (io.ReadCloser, error) { panic("oversized content must not be read") },
	})
}

func TestUploadSourceFileTooLarge(t *testing.T) {
	t.Parallel()
	f := newFakeGitLab(t, initialFiles)

	err := UploadSource(context.Background(), legacyOptions(f), oversizedSource{})

	exportErr, ok := export.As(err)
	if !ok || exportErr.Code != export.CodeFileTooLarge || exportErr.Details.Path != "plugins/big/model.bin" || exportErr.Details.Size != filelimit.MaxBufferedFileBytes+1 {
		t.Fatalf("err = %v, want file_too_large naming the path and size", err)
	}
	if !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatal("legacy error classification no longer recognises the error")
	}
	if len(f.recordedCommits()) != 0 {
		t.Fatal("committed despite the oversized file")
	}
}

func sortedPaths(files map[string]string) []string {
	paths := make([]string, 0, len(files))
	for path := range files {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	return paths
}
