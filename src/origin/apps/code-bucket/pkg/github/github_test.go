package github

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"testing/iotest"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
)

const (
	baseCommitSHA = "basecommit"
	baseTreeSHA   = "basetree"
)

type fakeGitHub struct {
	t      *testing.T
	server *httptest.Server

	mu          sync.Mutex
	blobs       map[string][]byte
	baseTree    map[string]string
	lfsStore    map[string][]byte
	lfsUploaded map[string]bool
	batchStatus int
	blobPosts   int
	createdTree *githubCreateTreeRequest
	commits     int
	zipball     []byte

	treeSizes       map[string]int64
	treeTruncated   bool
	zipballRequests int
}

func newFakeGitHub(t *testing.T) *fakeGitHub {
	t.Helper()

	f := &fakeGitHub{
		t:           t,
		blobs:       map[string][]byte{},
		baseTree:    map[string]string{},
		lfsStore:    map[string][]byte{},
		lfsUploaded: map[string]bool{},
		treeSizes:   map[string]int64{},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /repos/o/r/git/ref/heads/{branch...}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, `{"object":{"sha":%q}}`, baseCommitSHA)
	})
	mux.HandleFunc("GET /repos/o/r/git/commits/{sha}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, `{"sha":%q,"tree":{"sha":%q}}`, baseCommitSHA, baseTreeSHA)
	})
	mux.HandleFunc("GET /repos/o/r/git/trees/{sha}", f.handleGetTree)
	mux.HandleFunc("GET /repos/o/r/git/blobs/{sha}", f.handleGetBlob)
	mux.HandleFunc("POST /repos/o/r/git/blobs", f.handleCreateBlob)
	mux.HandleFunc("POST /repos/o/r/git/trees", f.handleCreateTree)
	mux.HandleFunc("POST /repos/o/r/git/commits", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.commits++
		f.mu.Unlock()
		_, _ = fmt.Fprint(w, `{"sha":"newcommit"}`)
	})
	mux.HandleFunc("PATCH /repos/o/r/git/refs/heads/{branch...}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprint(w, `{"object":{"sha":"newcommit"}}`)
	})
	mux.HandleFunc("GET /repos/o/r/zipball/{ref}", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.zipballRequests++
		f.mu.Unlock()

		_, _ = w.Write(f.zipball)
	})
	mux.HandleFunc("POST /info/lfs/objects/batch", f.handleLFSBatch)
	mux.HandleFunc("POST /info/lfs/verify", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/lfs-storage/{oid}", f.handleLFSStorage)

	f.server = httptest.NewServer(mux)
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeGitHub) withExistingFile(path string, content []byte) *fakeGitHub {
	sha := gitBlobSHA(content)
	f.blobs[sha] = content
	f.baseTree[path] = sha
	return f
}

func (f *fakeGitHub) withLFSObject(content []byte) *fakeGitHub {
	f.lfsStore[gitlfs.OIDFor(content)] = content
	return f
}

func (f *fakeGitHub) uploadOptions() UploadOptions {
	return UploadOptions{
		Owner:             "o",
		Repo:              "r",
		Branch:            "main",
		Token:             "token",
		BaseURL:           f.server.URL,
		LFSEndpoint:       f.server.URL + "/info/lfs",
		LFSThresholdBytes: 16,
		MaxFileBytes:      1 << 20,
	}
}

func (f *fakeGitHub) handleGetTree(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()

	type sizedEntry struct {
		githubTreeEntry
		Size int64 `json:"size"`
	}

	entries := make([]sizedEntry, 0, len(f.baseTree)+len(f.treeSizes))
	for path, sha := range f.baseTree {
		entries = append(entries, sizedEntry{
			githubTreeEntry: githubTreeEntry{Path: path, Mode: "100644", Type: "blob", SHA: sha},
			Size:            f.treeSizes[path],
		})
	}
	// Sizes can be declared for paths that have no blob body, so a test can
	// describe a large file without materialising it.
	for path, size := range f.treeSizes {
		if _, alreadyListed := f.baseTree[path]; alreadyListed {
			continue
		}
		entries = append(entries, sizedEntry{
			githubTreeEntry: githubTreeEntry{Path: path, Mode: "100644", Type: "blob", SHA: "sha-" + path},
			Size:            size,
		})
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"tree":      entries,
		"truncated": f.treeTruncated,
	})
}

func (f *fakeGitHub) handleGetBlob(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	content, ok := f.blobs[r.PathValue("sha")]
	f.mu.Unlock()

	if !ok {
		http.NotFound(w, r)
		return
	}
	_ = json.NewEncoder(w).Encode(githubBlobResponse{
		Content:  base64.StdEncoding.EncodeToString(content),
		Encoding: "base64",
	})
}

func (f *fakeGitHub) handleCreateBlob(w http.ResponseWriter, r *http.Request) {
	var req githubCreateBlobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		f.t.Fatalf("decode blob request: %v", err)
	}
	content, err := base64.StdEncoding.DecodeString(req.Content)
	if err != nil {
		f.t.Fatalf("decode blob content: %v", err)
	}

	f.mu.Lock()
	f.blobPosts++
	sha := gitBlobSHA(content)
	f.blobs[sha] = content
	f.mu.Unlock()

	_, _ = fmt.Fprintf(w, `{"sha":%q}`, sha)
}

func (f *fakeGitHub) handleCreateTree(w http.ResponseWriter, r *http.Request) {
	var req githubCreateTreeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		f.t.Fatalf("decode tree request: %v", err)
	}

	f.mu.Lock()
	f.createdTree = &req
	f.mu.Unlock()

	_, _ = fmt.Fprint(w, `{"sha":"newtree"}`)
}

func (f *fakeGitHub) handleLFSBatch(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	status := f.batchStatus
	f.mu.Unlock()

	if status != 0 {
		w.WriteHeader(status)
		_, _ = fmt.Fprint(w, `{"message":"LFS quota exceeded"}`)
		return
	}

	var req struct {
		Operation string `json:"operation"`
		Objects   []struct {
			OID  string `json:"oid"`
			Size int64  `json:"size"`
		} `json:"objects"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		f.t.Fatalf("decode batch request: %v", err)
	}
	obj := req.Objects[0]

	f.mu.Lock()
	_, stored := f.lfsStore[obj.OID]
	f.mu.Unlock()

	href := f.server.URL + "/lfs-storage/" + obj.OID
	switch {
	case req.Operation == "upload" && stored:
		_, _ = fmt.Fprintf(w, `{"transfer":"basic","objects":[{"oid":%q,"size":%d}]}`, obj.OID, obj.Size)
	case req.Operation == "upload":
		_, _ = fmt.Fprintf(w,
			`{"transfer":"basic","objects":[{"oid":%q,"size":%d,"actions":{"upload":{"href":%q},"verify":{"href":%q}}}]}`,
			obj.OID, obj.Size, href, f.server.URL+"/info/lfs/verify")
	case stored:
		_, _ = fmt.Fprintf(w,
			`{"transfer":"basic","objects":[{"oid":%q,"size":%d,"actions":{"download":{"href":%q}}}]}`,
			obj.OID, obj.Size, href)
	default:
		_, _ = fmt.Fprintf(w,
			`{"transfer":"basic","objects":[{"oid":%q,"size":%d,"error":{"code":404,"message":"not found"}}]}`,
			obj.OID, obj.Size)
	}
}

func (f *fakeGitHub) handleLFSStorage(w http.ResponseWriter, r *http.Request) {
	oid := r.PathValue("oid")

	if r.Method == http.MethodPut {
		content, _ := io.ReadAll(r.Body)
		f.mu.Lock()
		f.lfsStore[oid] = content
		f.lfsUploaded[oid] = true
		f.mu.Unlock()
		w.WriteHeader(http.StatusOK)
		return
	}

	f.mu.Lock()
	content, ok := f.lfsStore[oid]
	f.mu.Unlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	_, _ = w.Write(content)
}

func (f *fakeGitHub) treeEntry(path string) (githubTreeEntry, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.createdTree == nil {
		return githubTreeEntry{}, false
	}
	for _, entry := range f.createdTree.Tree {
		if entry.Path == path {
			return entry, true
		}
	}
	return githubTreeEntry{}, false
}

func (f *fakeGitHub) blobContent(sha string) []byte {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.blobs[sha]
}

func TestUploadCommitsPointerForLargeFile(t *testing.T) {
	fake := newFakeGitHub(t)
	content := bytes.Repeat([]byte("x"), 64)

	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{
		ContentFile("assets/big.bin", content),
	})
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	oid := gitlfs.OIDFor(content)
	if !fake.lfsUploaded[oid] {
		t.Fatal("expected the content to be uploaded to Git LFS")
	}
	if !bytes.Equal(fake.lfsStore[oid], content) {
		t.Fatal("Git LFS received the wrong bytes")
	}

	entry, ok := fake.treeEntry("assets/big.bin")
	if !ok {
		t.Fatal("expected a tree entry for the large file")
	}
	committed := fake.blobContent(entry.SHA)
	if !bytes.Equal(committed, gitlfs.FormatPointer(oid, int64(len(content)))) {
		t.Fatalf("expected a pointer to be committed, got %q", committed)
	}

	attributes, ok := fake.treeEntry(gitattributesPath)
	if !ok {
		t.Fatal("expected a .gitattributes tree entry")
	}
	want := "assets/big.bin " + lfsAttributes + "\n"
	if got := string(fake.blobContent(attributes.SHA)); got != want {
		t.Fatalf("unexpected .gitattributes:\n%q\nwant:\n%q", got, want)
	}
}

func TestUploadKeepsSmallFilesOnTheBlobsAPI(t *testing.T) {
	fake := newFakeGitHub(t)
	content := []byte("small")

	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{
		ContentFile("notes.txt", content),
	})
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	if len(fake.lfsUploaded) != 0 {
		t.Fatalf("expected no LFS uploads, got %v", fake.lfsUploaded)
	}
	entry, ok := fake.treeEntry("notes.txt")
	if !ok {
		t.Fatal("expected a tree entry for the small file")
	}
	if !bytes.Equal(fake.blobContent(entry.SHA), content) {
		t.Fatal("expected the raw content to be committed")
	}
	if _, ok := fake.treeEntry(gitattributesPath); ok {
		t.Fatal("expected no .gitattributes entry when nothing uses LFS")
	}
}

func TestUploadMergesExistingGitattributes(t *testing.T) {
	fake := newFakeGitHub(t)
	fake.withExistingFile(gitattributesPath, []byte("# managed by hand\n*.md text\n"))

	content := bytes.Repeat([]byte("y"), 64)
	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{
		ContentFile("big.bin", content),
	})
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	entry, ok := fake.treeEntry(gitattributesPath)
	if !ok {
		t.Fatal("expected a .gitattributes tree entry")
	}
	want := "# managed by hand\n*.md text\nbig.bin " + lfsAttributes + "\n"
	if got := string(fake.blobContent(entry.SHA)); got != want {
		t.Fatalf("unexpected .gitattributes:\n%q\nwant:\n%q", got, want)
	}
}

func TestUploadSkipsUnchangedLargeFileByPointerSHA(t *testing.T) {
	fake := newFakeGitHub(t)
	content := bytes.Repeat([]byte("z"), 64)
	pointer := gitlfs.FormatPointer(gitlfs.OIDFor(content), int64(len(content)))

	fake.withExistingFile("big.bin", pointer)
	fake.withExistingFile(gitattributesPath, []byte("big.bin "+lfsAttributes+"\n"))
	fake.withLFSObject(content)

	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{
		ContentFile("big.bin", content),
	})
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	if len(fake.lfsUploaded) != 0 {
		t.Fatalf("expected no LFS uploads for an unchanged file, got %v", fake.lfsUploaded)
	}
	if fake.blobPosts != 0 {
		t.Fatalf("expected no blobs to be created, got %d", fake.blobPosts)
	}
	if fake.commits != 0 {
		t.Fatalf("expected no commit, got %d", fake.commits)
	}
}

func TestUploadRejectsFilesOverTheCeiling(t *testing.T) {
	fake := newFakeGitHub(t)
	opts := fake.uploadOptions()
	opts.MaxFileBytes = 32

	err := UploadToRepo(context.Background(), opts, []FileToUpload{
		ContentFile("huge.bin", bytes.Repeat([]byte("w"), 64)),
	})
	if err == nil {
		t.Fatal("expected an error for an oversized file")
	}
	if !strings.Contains(err.Error(), "huge.bin") || !strings.Contains(err.Error(), "64 B") {
		t.Fatalf("expected the error to name the path and size, got %v", err)
	}
	if fake.commits != 0 {
		t.Fatalf("expected no commit, got %d", fake.commits)
	}
}

func streamedFile(path string, content []byte) (FileToUpload, *int) {
	opens := 0
	return FileToUpload{
		Path: path,
		Size: int64(len(content)),
		Open: func() (io.ReadCloser, error) {
			opens++
			return io.NopCloser(iotest.OneByteReader(bytes.NewReader(content))), nil
		},
	}, &opens
}

func TestUploadStreamsLargeFilesThroughTheOpener(t *testing.T) {
	fake := newFakeGitHub(t)
	content := bytes.Repeat([]byte("x"), 64)
	file, opens := streamedFile("assets/big.bin", content)

	if err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{file}); err != nil {
		t.Fatalf("upload: %v", err)
	}

	oid := gitlfs.OIDFor(content)
	if !bytes.Equal(fake.lfsStore[oid], content) {
		t.Fatal("Git LFS received the wrong bytes")
	}

	if *opens != 2 {
		t.Fatalf("opened content %d times, want 2", *opens)
	}
}

func TestUploadRejectsOversizedFilesWithoutReadingThem(t *testing.T) {
	fake := newFakeGitHub(t)
	opts := fake.uploadOptions()
	opts.MaxFileBytes = 32

	file, opens := streamedFile("huge.bin", bytes.Repeat([]byte("w"), 64))

	err := UploadToRepo(context.Background(), opts, []FileToUpload{file})
	if err == nil {
		t.Fatal("expected an error for an oversized file")
	}

	if *opens != 0 {
		t.Fatalf("opened content %d times, want 0", *opens)
	}
	if fake.commits != 0 {
		t.Fatalf("expected no commit, got %d", fake.commits)
	}
}

func TestUploadRejectionCarriesTheSizeSentinel(t *testing.T) {
	fake := newFakeGitHub(t)
	opts := fake.uploadOptions()
	opts.MaxFileBytes = 32

	err := UploadToRepo(context.Background(), opts, []FileToUpload{
		ContentFile("huge.bin", bytes.Repeat([]byte("w"), 64)),
	})
	if !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatalf("callers cannot classify this as a permanent failure: %v", err)
	}
}

// The old ceiling was 100 MiB, sized to how much content the exporter held in
// memory. Files above the LFS threshold are streamed now, so the ceiling tracks
// GitHub's LFS limit instead and files well past 100 MiB have to get through the
// size gate. Reaching the read stage is what proves the gate let it by, and it
// is far cheaper than materialising 200 MiB.
func TestUploadNoLongerRejectsFilesAboveTheOldMemoryCeiling(t *testing.T) {
	fake := newFakeGitHub(t)
	opts := fake.uploadOptions()
	opts.MaxFileBytes = DefaultMaxFileBytes

	file := FileToUpload{
		Path: "assets/large.bin",
		Size: 200 << 20,
		Open: func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader([]byte("short"))), nil
		},
	}

	err := UploadToRepo(context.Background(), opts, []FileToUpload{file})
	if errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatalf("a 200 MiB file was refused on size: %v", err)
	}
	if err == nil || !strings.Contains(err.Error(), "changed while exporting") {
		t.Fatalf("expected the file to reach the read stage, got %v", err)
	}
}

func TestUploadRejectsAnOversizedGitattributes(t *testing.T) {
	fake := newFakeGitHub(t)

	// .gitattributes declares the LFS tracking, so it can never be a pointer and
	// is always buffered. It gets its own ceiling rather than the LFS one.
	file := FileToUpload{
		Path: ".gitattributes",
		Size: maxGitattributesBytes + 1,
		Open: func() (io.ReadCloser, error) {
			t.Error("content was opened for a file that should have been refused")
			return nil, errors.New("unreachable")
		},
	}

	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{file})
	if !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatalf("expected an oversized .gitattributes to be refused, got %v", err)
	}
	if !strings.Contains(err.Error(), "1.0 MiB") {
		t.Fatalf("expected the .gitattributes ceiling in the error, got %v", err)
	}
	if fake.commits != 0 {
		t.Fatalf("expected no commit, got %d", fake.commits)
	}
}

func TestUploadRejectsFilesThatChangeSizeWhileExporting(t *testing.T) {
	fake := newFakeGitHub(t)

	file := FileToUpload{
		Path: "big.bin",
		Size: 64,
		Open: func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(bytes.Repeat([]byte("x"), 32))), nil
		},
	}

	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{file})
	if err == nil || !strings.Contains(err.Error(), "changed while exporting") {
		t.Fatalf("expected a size mismatch error, got %v", err)
	}
	if fake.commits != 0 {
		t.Fatalf("expected no commit, got %d", fake.commits)
	}
}

func TestUploadCommitsGitattributesAsContentEvenWhenLarge(t *testing.T) {
	fake := newFakeGitHub(t)

	existing := []byte("# padding\n" + strings.Repeat("*.tmp text\n", 8))
	if int64(len(existing)) <= fake.uploadOptions().LFSThresholdBytes {
		t.Fatalf("fixture is too small to exercise the threshold: %d bytes", len(existing))
	}

	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{
		ContentFile(gitattributesPath, existing),
		ContentFile("big.bin", bytes.Repeat([]byte("x"), 64)),
	})
	if err != nil {
		t.Fatalf("upload: %v", err)
	}

	entry, ok := fake.treeEntry(gitattributesPath)
	if !ok {
		t.Fatal("expected a .gitattributes tree entry")
	}

	committed := string(fake.blobContent(entry.SHA))
	if _, isPointer := gitlfs.ParsePointer([]byte(committed)); isPointer {
		t.Fatalf(".gitattributes was committed as an LFS pointer:\n%q", committed)
	}

	want := string(existing) + "big.bin " + lfsAttributes + "\n"
	if committed != want {
		t.Fatalf("unexpected .gitattributes:\n%q\nwant:\n%q", committed, want)
	}
}

func TestUploadSurfacesLFSQuotaFailure(t *testing.T) {
	fake := newFakeGitHub(t)
	fake.batchStatus = http.StatusTooManyRequests

	err := UploadToRepo(context.Background(), fake.uploadOptions(), []FileToUpload{
		ContentFile("big.bin", bytes.Repeat([]byte("q"), 64)),
	})
	if !errors.Is(err, gitlfs.ErrQuotaExceeded) {
		t.Fatalf("expected a quota error, got %v", err)
	}
	if !strings.Contains(err.Error(), "big.bin") {
		t.Fatalf("expected the error to name the path, got %v", err)
	}
}

func TestDownloadRepoResolvesPointers(t *testing.T) {
	fake := newFakeGitHub(t)
	content := bytes.Repeat([]byte("p"), 64)
	pointer := gitlfs.FormatPointer(gitlfs.OIDFor(content), int64(len(content)))

	fake.withLFSObject(content)
	fake.zipball = buildZipball(t, map[string][]byte{
		"repo-main/big.bin":   pointer,
		"repo-main/notes.txt": []byte("plain text"),
	})

	iter, err := DownloadRepo(context.Background(), DownloadOptions{
		Owner:       "o",
		Repo:        "r",
		Ref:         "main",
		Token:       "token",
		BaseURL:     fake.server.URL,
		LFSEndpoint: fake.server.URL + "/info/lfs",
	})
	if err != nil {
		t.Fatalf("download repo: %v", err)
	}
	defer iter.Close()

	files := map[string][]byte{}
	for {
		item, ok := iter.Next()
		if !ok {
			break
		}
		files[item.Path] = item.Content
	}
	if err := iter.Err(); err != nil {
		t.Fatalf("iterate: %v", err)
	}

	if !bytes.Equal(files["big.bin"], content) {
		t.Fatalf("expected the pointer to resolve to the real content, got %d bytes", len(files["big.bin"]))
	}
	if string(files["notes.txt"]) != "plain text" {
		t.Fatalf("unexpected plain file content: %q", files["notes.txt"])
	}
}

func TestDownloadRepoFailsWhenPointerCannotBeResolved(t *testing.T) {
	fake := newFakeGitHub(t)
	content := bytes.Repeat([]byte("m"), 64)
	pointer := gitlfs.FormatPointer(gitlfs.OIDFor(content), int64(len(content)))

	fake.zipball = buildZipball(t, map[string][]byte{"repo-main/big.bin": pointer})

	iter, err := DownloadRepo(context.Background(), DownloadOptions{
		Owner:       "o",
		Repo:        "r",
		Ref:         "main",
		Token:       "token",
		BaseURL:     fake.server.URL,
		LFSEndpoint: fake.server.URL + "/info/lfs",
	})
	if err != nil {
		t.Fatalf("download repo: %v", err)
	}
	defer iter.Close()

	for {
		if _, ok := iter.Next(); !ok {
			break
		}
	}

	err = iter.Err()
	if err == nil {
		t.Fatal("expected the import to fail rather than store the pointer")
	}
	if !strings.Contains(err.Error(), "big.bin") {
		t.Fatalf("expected the error to name the path, got %v", err)
	}
}

// The import path buffers each file, so a pointer declaring more than it can
// hold has to be refused on the strength of the pointer alone. Fetching it first
// is what exhausts memory.
func TestDownloadRepoRefusesPointersTooLargeToBuffer(t *testing.T) {
	fake := newFakeGitHub(t)
	oversized := filelimit.MaxBufferedFileBytes + 1
	pointer := gitlfs.FormatPointer(strings.Repeat("a", 64), oversized)

	fake.zipball = buildZipball(t, map[string][]byte{"repo-main/huge.bin": pointer})

	iter, err := DownloadRepo(context.Background(), DownloadOptions{
		Owner:       "o",
		Repo:        "r",
		Ref:         "main",
		Token:       "token",
		BaseURL:     fake.server.URL,
		LFSEndpoint: fake.server.URL + "/info/lfs",
	})
	if err != nil {
		t.Fatalf("download repo: %v", err)
	}
	defer iter.Close()

	for {
		if _, ok := iter.Next(); !ok {
			break
		}
	}

	// The object was never registered with the fake, so any attempt to fetch it
	// would have surfaced as a transfer error instead of the sentinel.
	if err := iter.Err(); !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatalf("expected the pointer to be refused on its declared size, got %v", err)
	}
}

func buildZipball(t *testing.T, files map[string][]byte) []byte {
	t.Helper()

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	for name, content := range files {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("create zip entry: %v", err)
		}
		if _, err := entry.Write(content); err != nil {
			t.Fatalf("write zip entry: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}
