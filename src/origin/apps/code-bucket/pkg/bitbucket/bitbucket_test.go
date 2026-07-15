package bitbucket

import (
	"bytes"
	"mime/multipart"
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
