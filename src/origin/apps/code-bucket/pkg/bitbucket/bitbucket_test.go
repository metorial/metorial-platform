package bitbucket

import (
	"bytes"
	"mime/multipart"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestNormalizeRepoPath(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		allowRoot bool
		expected  string
		wantErr   bool
	}{
		{name: "root", input: "/", allowRoot: true, expected: ""},
		{name: "normal", input: "/services/api", expected: "services/api"},
		{name: "cleans separators", input: "services//api/./main.go", expected: "services/api/main.go"},
		{name: "rejects parent", input: "../../secret", wantErr: true},
		{name: "rejects empty file", input: "", wantErr: true},
		{name: "rejects null", input: "safe/\x00bad", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := normalizeRepoPath(test.input, test.allowRoot)
			if test.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if actual != test.expected {
				t.Fatalf("expected %q, got %q", test.expected, actual)
			}
		})
	}
}

func TestBitbucketURLsRejectUnsafeValues(t *testing.T) {
	unsafe := []string{
		"http://bitbucket.example.com",
		"https://token@bitbucket.example.com",
		"file:///tmp/repository",
		"not a url",
	}
	for _, value := range unsafe {
		if _, err := cleanHTTPSBaseURL(value, ""); err == nil {
			t.Errorf("expected base URL %q to be rejected", value)
		}
		if err := validateCloneURL(value); err == nil {
			t.Errorf("expected clone URL %q to be rejected", value)
		}
	}
}

func TestValidateBranch(t *testing.T) {
	valid := []string{"main", "feature/bitbucket", "release-2026.07"}
	for _, branch := range valid {
		if err := validateBranch(branch); err != nil {
			t.Errorf("expected branch %q to be valid: %v", branch, err)
		}
	}

	invalid := []string{"", "../main", "-main", "feature//test", "main.lock~"}
	for _, branch := range invalid {
		if err := validateBranch(branch); err == nil {
			t.Errorf("expected branch %q to be rejected", branch)
		}
	}
}

func TestUploadToCloudRepoSkipsUnchangedFilesAndDeletesRemovedFiles(t *testing.T) {
	var unchangedBody bytes.Buffer
	unchangedWriter := multipart.NewWriter(&unchangedBody)
	sameFile := func(yield func(FileToUpload) error) error {
		return yield(FileToUpload{Path: "file.txt", Content: []byte("same")})
	}
	changed, err := writeCloudChanges(
		unchangedWriter,
		"",
		map[string][]byte{"file.txt": []byte("same")},
		CloudUploadOptions{},
		sameFile,
	)
	if err != nil {
		t.Fatalf("compare unchanged repository: %v", err)
	}
	if changed {
		t.Fatal("expected unchanged files to be skipped")
	}

	var deletionBody bytes.Buffer
	deletionWriter := multipart.NewWriter(&deletionBody)
	boundary := deletionWriter.Boundary()
	noFiles := func(yield func(FileToUpload) error) error { return nil }
	changed, err = writeCloudChanges(
		deletionWriter,
		"",
		map[string][]byte{"removed.txt": []byte("old")},
		CloudUploadOptions{},
		noFiles,
	)
	if err != nil {
		t.Fatalf("render removed repository file: %v", err)
	}
	if !changed {
		t.Fatal("expected a deletion to create a source upload")
	}
	if err := deletionWriter.Close(); err != nil {
		t.Fatalf("close multipart deletion body: %v", err)
	}
	form, err := multipart.NewReader(&deletionBody, boundary).ReadForm(1 << 20)
	if err != nil {
		t.Fatalf("parse multipart deletion body: %v", err)
	}
	if !reflect.DeepEqual(form.Value["files"], []string{"/removed.txt"}) {
		t.Fatalf("expected removed file field, got %#v", form.Value["files"])
	}
}

// cloudDeleteFields renders the multipart body and returns the "files" fields,
// which are what tell Bitbucket Cloud to delete a path.
func cloudDeleteFields(
	t *testing.T,
	existing map[string][]byte,
	opts CloudUploadOptions,
	iter FileIterator,
) []string {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	boundary := writer.Boundary()

	if _, err := writeCloudChanges(writer, "", existing, opts, iter); err != nil {
		t.Fatalf("render cloud changes: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart body: %v", err)
	}

	form, err := multipart.NewReader(&body, boundary).ReadForm(1 << 20)
	if err != nil {
		t.Fatalf("parse multipart body: %v", err)
	}
	return form.Value["files"]
}

func TestWriteCloudChangesWithExplicitDeletesLeavesUnmanagedFilesAlone(t *testing.T) {
	noFiles := func(yield func(FileToUpload) error) error { return nil }

	// The target path for a skill destination is the repo root, so mirroring
	// would delete files like README.md that we never managed.
	fields := cloudDeleteFields(
		t,
		map[string][]byte{
			"README.md":        []byte("unmanaged"),
			"skills/gone/a.md": []byte("old"),
			".github/ci.yml":   []byte("unmanaged"),
		},
		CloudUploadOptions{
			ExplicitDeletesOnly: true,
			DeletePaths:         []string{"skills/gone/a.md"},
		},
		noFiles,
	)

	if !reflect.DeepEqual(fields, []string{"/skills/gone/a.md"}) {
		t.Fatalf("expected only the listed path to be deleted, got %#v", fields)
	}
}

func TestWriteCloudChangesWithExplicitDeletesSkipsMissingPath(t *testing.T) {
	noFiles := func(yield func(FileToUpload) error) error { return nil }

	fields := cloudDeleteFields(
		t,
		map[string][]byte{"README.md": []byte("unmanaged")},
		CloudUploadOptions{
			ExplicitDeletesOnly: true,
			DeletePaths:         []string{"never-existed.md"},
		},
		noFiles,
	)

	if len(fields) != 0 {
		t.Fatalf("expected no deletions, got %#v", fields)
	}
}

func TestWriteCloudChangesWithExplicitDeletesKeepsExportedPath(t *testing.T) {
	content := []byte("same")
	sameFile := func(yield func(FileToUpload) error) error {
		return yield(FileToUpload{Path: "a.md", Content: content})
	}

	// A stale deletion for a path the bucket still produces must not win.
	fields := cloudDeleteFields(
		t,
		map[string][]byte{"a.md": content},
		CloudUploadOptions{
			ExplicitDeletesOnly: true,
			DeletePaths:         []string{"a.md"},
		},
		sameFile,
	)

	if len(fields) != 0 {
		t.Fatalf("expected no deletions, got %#v", fields)
	}
}

func TestRemoveDataCenterPathsOnlyRemovesListedFiles(t *testing.T) {
	targetDir := t.TempDir()

	write := func(relativePath string) string {
		full := filepath.Join(targetDir, filepath.FromSlash(relativePath))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatalf("create directory: %v", err)
		}
		if err := os.WriteFile(full, []byte("content"), 0o644); err != nil {
			t.Fatalf("write file: %v", err)
		}
		return full
	}

	removed := write("skills/gone/a.md")
	unmanaged := write("README.md")

	if err := removeDataCenterPaths(targetDir, []string{"skills/gone/a.md"}); err != nil {
		t.Fatalf("remove paths: %v", err)
	}

	if _, err := os.Stat(removed); !os.IsNotExist(err) {
		t.Fatalf("expected the listed path to be removed, got %v", err)
	}
	if _, err := os.Stat(unmanaged); err != nil {
		t.Fatalf("expected the unmanaged file to survive: %v", err)
	}

	// The directory only held the removed file, so it should be gone too.
	if _, err := os.Stat(filepath.Join(targetDir, "skills")); !os.IsNotExist(err) {
		t.Fatalf("expected the emptied directory to be pruned, got %v", err)
	}
}

func TestRemoveDataCenterPathsIgnoresMissingFiles(t *testing.T) {
	targetDir := t.TempDir()

	if err := removeDataCenterPaths(targetDir, []string{"never-existed.md"}); err != nil {
		t.Fatalf("expected a missing path to be ignored, got %v", err)
	}
}

func TestRemoveDataCenterPathsRejectsEscapingPath(t *testing.T) {
	targetDir := t.TempDir()

	if err := removeDataCenterPaths(targetDir, []string{"../outside.md"}); err == nil {
		t.Fatal("expected a path outside the target directory to be rejected")
	}
}
