// Package committest is an in-memory branch implementing commitbatch.CommitWriter, with
// knobs for the failures the batcher has to survive.
package committest

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"io"
	"path"
	"sort"
	"strconv"
	"sync"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

type Commit struct {
	SHA     string
	Tree    string
	Message string
	Changes []commitbatch.Change
	Foreign bool
}

type file struct {
	sha  string
	mode remotestate.Mode
}

type Repo struct {
	mu sync.Mutex

	head    string
	files   map[string]file
	blobs   map[string][]byte
	History []Commit

	limits commitbatch.BatchLimits
	// BodyCap rejects batches whose estimated encoded size exceeds it.
	BodyCap int64
	// Before runs before each commit attempt (numbered from 1); a non-nil error is
	// returned without committing.
	Before func(attempt int, batch commitbatch.Batch) error
	// LandThenFail makes the attempt commit and then report an ambiguous failure.
	LandThenFail func(attempt int) bool
	// NoTreeReport hides tree SHAs from Head so the batcher can't confirm landings.
	NoTreeReport bool

	Attempts     int
	ContentReads int
}

func GitBlobSHA(content []byte) string {
	h := sha1.New()
	h.Write([]byte("blob " + strconv.Itoa(len(content)) + "\x00"))
	h.Write(content)
	return hex.EncodeToString(h.Sum(nil))
}

func NewRepo(files map[string][]byte) *Repo {
	r := &Repo{
		files:  map[string]file{},
		blobs:  map[string][]byte{},
		limits: commitbatch.BatchLimits{SupportsReferences: true},
	}
	for p, content := range files {
		sha := GitBlobSHA(content)
		r.blobs[sha] = content
		r.files[p] = file{sha: sha, mode: remotestate.ModeFile}
	}
	r.head = r.commitSHA("initial", r.treeLocked())
	return r
}

func (r *Repo) SetLimits(limits commitbatch.BatchLimits) { r.limits = limits }

func (r *Repo) Limits() commitbatch.BatchLimits { return r.limits }

func (r *Repo) commitSHA(parent, tree string) string {
	h := sha1.New()
	fmt.Fprintf(h, "%s %s %d", parent, tree, len(r.History))
	return hex.EncodeToString(h.Sum(nil))
}

func (r *Repo) listingLocked() *remotestate.Listing {
	entries := make([]remotestate.Entry, 0, len(r.files))
	for p, f := range r.files {
		entries = append(entries, remotestate.Entry{Path: p, Mode: f.mode, SHA: f.sha})
	}
	listing, err := remotestate.FromEntries(r.head, entries)
	if err != nil {
		panic(err)
	}
	return listing
}

func (r *Repo) treeLocked() string { return r.listingLocked().TreeSHA() }

// Listing returns a fresh copy of the head's listing.
func (r *Repo) Listing() *remotestate.Listing {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.listingLocked()
}

func (r *Repo) Head(ctx context.Context) (string, string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.NoTreeReport {
		return r.head, "", nil
	}
	return r.head, r.treeLocked(), nil
}

func (r *Repo) Commit(ctx context.Context, base string, batch commitbatch.Batch) (string, error) {
	head, _, err := r.CommitWithTree(ctx, base, batch)
	return head, err
}

func (r *Repo) CommitWithTree(ctx context.Context, base string, batch commitbatch.Batch) (string, string, error) {
	r.mu.Lock()
	r.Attempts++
	attempt := r.Attempts
	before, landThenFail := r.Before, r.LandThenFail
	r.mu.Unlock()

	if before != nil {
		if err := before(attempt, batch); err != nil {
			return "", "", err
		}
	}

	var encoded int64
	for _, c := range batch.Changes {
		encoded += commitbatch.EncodedBytes(c)
	}
	if r.BodyCap > 0 && encoded > r.BodyCap {
		return "", "", commitbatch.ErrBodyTooLarge
	}

	contents := make([][]byte, len(batch.Changes))
	for i, c := range batch.Changes {
		if c.Kind != commitbatch.ChangeAdd {
			continue
		}
		body, err := c.Open(ctx)
		if err != nil {
			return "", "", err
		}
		content, err := io.ReadAll(body)
		body.Close()
		if err != nil {
			return "", "", err
		}
		contents[i] = content
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.ContentReads += len(batch.Changes)
	if base != r.head {
		return "", "", commitbatch.ErrHeadMismatch
	}

	next := make(map[string]file, len(r.files))
	for p, f := range r.files {
		next[p] = f
	}
	for i, c := range batch.Changes {
		mode := c.Mode
		if mode == 0 {
			mode = remotestate.ModeFile
		}
		switch c.Kind {
		case commitbatch.ChangeAdd:
			sha := GitBlobSHA(contents[i])
			if sha != c.BlobSHA {
				return "", "", fmt.Errorf("committest: %s content hashes to %s, change says %s", c.Path, sha, c.BlobSHA)
			}
			r.blobs[sha] = contents[i]
			next[c.Path] = file{sha: sha, mode: mode}
		case commitbatch.ChangeReference:
			if !r.limits.SupportsReferences {
				return "", "", fmt.Errorf("committest: references are not supported")
			}
			if _, ok := r.blobs[c.BlobSHA]; !ok {
				return "", "", fmt.Errorf("committest: %s references missing blob %s", c.Path, c.BlobSHA)
			}
			next[c.Path] = file{sha: c.BlobSHA, mode: mode}
		case commitbatch.ChangeDelete:
			delete(next, c.Path)
		}
	}

	if err := fileDirConflict(next); err != nil {
		return "", "", err
	}

	r.files = next
	tree := r.treeLocked()
	r.head = r.commitSHA(r.head, tree)
	r.History = append(r.History, Commit{SHA: r.head, Tree: tree, Message: batch.Message, Changes: batch.Changes})

	if landThenFail != nil && landThenFail(attempt) {
		return "", "", &commitbatch.AmbiguousError{Err: fmt.Errorf("gateway timeout")}
	}
	return r.head, tree, nil
}

func fileDirConflict(files map[string]file) error {
	for p := range files {
		for dir := path.Dir(p); dir != "."; dir = path.Dir(dir) {
			if _, ok := files[dir]; ok {
				return fmt.Errorf("committest: %s is a file, but %s needs it to be a directory", dir, p)
			}
		}
	}
	return nil
}

// Push is a commit made by someone else.
func (r *Repo) Push(files map[string][]byte, deletes ...string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for p, content := range files {
		sha := GitBlobSHA(content)
		r.blobs[sha] = content
		r.files[p] = file{sha: sha, mode: remotestate.ModeFile}
	}
	for _, p := range deletes {
		delete(r.files, p)
	}
	tree := r.treeLocked()
	r.head = r.commitSHA(r.head, tree)
	r.History = append(r.History, Commit{SHA: r.head, Tree: tree, Message: "foreign", Foreign: true})
}

func (r *Repo) Commits() []Commit {
	r.mu.Lock()
	defer r.mu.Unlock()

	var out []Commit
	for _, c := range r.History {
		if !c.Foreign {
			out = append(out, c)
		}
	}
	return out
}

func (r *Repo) Content(p string) ([]byte, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	f, ok := r.files[p]
	if !ok {
		return nil, false
	}
	return r.blobs[f.sha], true
}

func (r *Repo) Paths() []string {
	r.mu.Lock()
	defer r.mu.Unlock()

	paths := make([]string, 0, len(r.files))
	for p := range r.files {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	return paths
}
