package export

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const maxGitattributesBytes = 1 << 20

var indexFileNames = map[string]bool{
	"marketplace.json": true,
	"plugin.json":      true,
	"mcp.json":         true,
	".mcp.json":        true,
}

// DefaultIsIndex reports the files Metorial generates to describe other content
// (marketplace and plugin JSON, MCP configs). They are committed last.
func DefaultIsIndex(p string) bool { return indexFileNames[path.Base(p)] }

type PlanInput struct {
	Manifest *manifest.Manifest
	// Previous is the manifest last propagated to this repository, nil if none.
	Previous *manifest.Manifest
	// Source opens the manifest's content. Every byte stream read through a plan is
	// verified against the entry's git blob SHA and sha256 regardless of the source.
	Source manifest.FileSource
	// Remote is the listing at the branch head.
	Remote *remotestate.Listing
	Guard  Guard

	// LFSThresholdBytes routes files at or above it through Git LFS; zero disables LFS.
	LFSThresholdBytes int64
	// MaxFileBytes caps files stored as regular blobs; zero means no cap.
	MaxFileBytes int64
	// MaxLFSFileBytes caps LFS objects; zero means manifest.MaxFileBytes.
	MaxLFSFileBytes int64
	// ForceLFS routes these paths through Git LFS below the threshold (files the
	// provider rejected as too large); it only applies when LFS is enabled.
	ForceLFS map[string]bool
	// SupportsReferences says the writer can point a path at an existing blob by SHA.
	// Without it, moves and duplicates are written as content.
	SupportsReferences bool

	// ReadBlob reads an existing blob; it is only used for .gitattributes and is
	// required when LFS is enabled.
	ReadBlob func(ctx context.Context, sha string) ([]byte, error)
	// IsIndex defaults to DefaultIsIndex.
	IsIndex func(path string) bool
}

type Plan struct {
	commitbatch.Plan

	FilesTotal int
	// Skipped entries already have the wanted blob at their path.
	Skipped int
	// Reused entries point at a blob the remote already has at another path.
	Reused int
	// Deduplicated entries share content with an earlier upload in this plan.
	Deduplicated int
	Uploads      int
	LFSObjects   int

	ScopeEntries      int
	Deletes           []string
	UnexpectedDeletes []string
}

type planner struct {
	in      PlanInput
	plan    *Plan
	isIndex func(string) bool

	existing      map[[20]byte]struct{}
	uploaded      map[string]bool
	lfsPaths      []string
	lfsChanged    bool
	pendingIndex  []commitbatch.Change
	gitattributes *commitbatch.Change

	// blocking maps remote files where the manifest needs a directory, and remote
	// directories (also in blockingDirs) where it needs a file, to the remote blobs to
	// delete in the same batch as, and just before, the first change at or below them.
	blocking     map[string][]string
	blockingDirs map[string]bool
}

// PlanChanges diffs the manifest against the remote listing by blob SHA, without
// reading any content: unchanged paths are skipped, content the remote already has is
// referenced, identical content is uploaded once, and in-scope remote paths missing
// from the manifest are deleted, subject to the deletion guard.
func PlanChanges(ctx context.Context, in PlanInput) (*Plan, error) {
	switch {
	case in.Manifest == nil || in.Source == nil || in.Remote == nil:
		return nil, errors.New("export: Manifest, Source and Remote are required to plan")
	case in.LFSThresholdBytes > 0 && in.ReadBlob == nil:
		return nil, errors.New("export: ReadBlob is required when Git LFS is enabled")
	}
	if in.MaxLFSFileBytes <= 0 {
		in.MaxLFSFileBytes = manifest.MaxFileBytes
	}

	p := &planner{
		in:           in,
		plan:         &Plan{},
		isIndex:      in.IsIndex,
		uploaded:     map[string]bool{},
		blocking:     map[string][]string{},
		blockingDirs: map[string]bool{},
	}
	if p.isIndex == nil {
		p.isIndex = DefaultIsIndex
	}

	if err := in.Source.Walk(ctx, p.addFile); err != nil {
		return nil, err
	}
	if err := p.planGitattributes(ctx); err != nil {
		return nil, err
	}
	if err := p.planBlocking(); err != nil {
		return nil, err
	}
	if err := p.planDeletes(ctx); err != nil {
		return nil, err
	}

	p.plan.Final = append(p.pendingIndex, p.plan.Final...)
	if p.gitattributes != nil {
		p.plan.Content = append([]commitbatch.Change{*p.gitattributes}, p.plan.Content...)
	}
	p.plan.Content = p.clearBlocking(p.plan.Content)
	p.plan.References = p.clearBlocking(p.plan.References)
	p.plan.Final = p.clearBlocking(p.plan.Final)
	return p.plan, nil
}

func (p *planner) addFile(file manifest.SourceFile) error {
	p.plan.FilesTotal++

	useLFS := p.in.LFSThresholdBytes > 0 && (file.Size >= p.in.LFSThresholdBytes || p.in.ForceLFS[file.Path])
	switch {
	case useLFS && file.Size > p.in.MaxLFSFileBytes:
		return FileTooLarge(file.Path, file.Size, p.in.MaxLFSFileBytes)
	case !useLFS && p.in.MaxFileBytes > 0 && file.Size > p.in.MaxFileBytes:
		return FileTooLarge(file.Path, file.Size, p.in.MaxFileBytes)
	case file.GitBlobSHA == "" || file.SHA256 == "":
		return fmt.Errorf("export: %s has no content hashes; only manifest sources can be planned", file.Path)
	}

	wanted := file.GitBlobSHA
	var pointer []byte
	if useLFS {
		pointer = gitlfs.FormatPointer(file.SHA256, file.Size)
		wanted = GitBlobSHA(pointer)
		p.lfsPaths = append(p.lfsPaths, file.Path)
	}

	mode := remotestate.ModeFile
	remote, found := p.in.Remote.Lookup(file.Path)
	switch {
	case !found:
		if err := p.findBlockingFile(file.Path); err != nil {
			return err
		}
	case remote.Mode.IsTree():
		p.blockingDirs[file.Path] = true
	case remote.SHA == wanted && isRegularFile(remote.Mode):
		p.plan.Skipped++
		return nil
	case remote.Mode == remotestate.ModeExecutable:
		mode = remote.Mode
	}
	if useLFS {
		p.lfsChanged = true
	}

	index := p.isIndex(file.Path)
	change := commitbatch.Change{Path: file.Path, Mode: mode, BlobSHA: wanted}

	if p.in.SupportsReferences {
		if p.existsRemotely(wanted) {
			p.plan.Reused++
			change.Kind = commitbatch.ChangeReference
			p.place(change, index, true)
			return nil
		}
		if p.uploaded[wanted] {
			p.plan.Deduplicated++
			change.Kind = commitbatch.ChangeReference
			p.place(change, index, true)
			return nil
		}
	}

	change.Kind = commitbatch.ChangeAdd
	open := verifiedOpener(file)
	if useLFS {
		change.Size = int64(len(pointer))
		change.Open = bytesOpener(pointer)
		if !p.uploaded[wanted] && !p.existsRemotely(wanted) {
			change.LFS = &commitbatch.LFSObject{OID: file.SHA256, Size: file.Size, Open: open}
			p.plan.LFSObjects++
		}
	} else {
		change.Size = file.Size
		change.Open = open
	}

	if !index {
		p.uploaded[wanted] = true
	}
	p.plan.Uploads++
	p.place(change, index, false)
	return nil
}

func (p *planner) place(change commitbatch.Change, index, reference bool) {
	switch {
	case index:
		p.pendingIndex = append(p.pendingIndex, change)
	case reference:
		p.plan.References = append(p.plan.References, change)
	default:
		p.plan.Content = append(p.plan.Content, change)
	}
}

// findBlockingFile looks for a remote file where filePath needs a directory. Ancestors
// are looked up from the root down, so only paths that exist remotely are visited.
func (p *planner) findBlockingFile(filePath string) error {
	for end := strings.IndexByte(filePath, '/'); end > 0; {
		ancestor := filePath[:end]
		entry, found := p.in.Remote.Lookup(ancestor)
		switch {
		case !found:
			return nil
		case !entry.Mode.IsTree():
			if !p.in.Manifest.Header.Scope.Contains(ancestor) {
				return PathConflict(filePath, ancestor, "is a file outside the managed scope")
			}
			p.blocking[ancestor] = []string{ancestor}
			return nil
		}

		next := strings.IndexByte(filePath[end+1:], '/')
		if next < 0 {
			return nil
		}
		end += 1 + next
	}
	return nil
}

// planBlocking resolves every blocking path to the remote blobs to delete. Those are
// in-scope paths the manifest doesn't have, so planDeletes counts them like any other
// delete; anything out of scope can't be deleted and fails the export instead.
func (p *planner) planBlocking() error {
	if len(p.blockingDirs) == 0 {
		return nil
	}

	scope := p.in.Manifest.Header.Scope
	err := p.in.Remote.Blobs(func(e remotestate.Entry) error {
		for end := strings.IndexByte(e.Path, '/'); end > 0; {
			if dir := e.Path[:end]; p.blockingDirs[dir] {
				if !scope.Contains(e.Path) {
					return PathConflict(dir, e.Path, "is outside the managed scope, below a directory the manifest needs as a file")
				}
				p.blocking[dir] = append(p.blocking[dir], e.Path)
				return nil
			}
			next := strings.IndexByte(e.Path[end+1:], '/')
			if next < 0 {
				return nil
			}
			end += 1 + next
		}
		return nil
	})
	if err != nil {
		return err
	}

	for dir := range p.blockingDirs {
		if len(p.blocking[dir]) == 0 {
			return PathConflict(dir, dir, "is a directory whose contents the remote listing doesn't include")
		}
	}
	return nil
}

// clearBlocking puts each blocking path's deletes right before the first change that
// needs it gone, tied to that change so no batch boundary can fall between them.
// Segments are cleared in commit order, so later changes find the path already gone.
func (p *planner) clearBlocking(changes []commitbatch.Change) []commitbatch.Change {
	if len(p.blocking) == 0 {
		return changes
	}

	out := make([]commitbatch.Change, 0, len(changes))
	for _, change := range changes {
		for _, blocking := range p.takeBlocking(change.Path) {
			out = append(out, commitbatch.Change{Kind: commitbatch.ChangeDelete, Path: blocking, WithNext: true})
		}
		out = append(out, change)
	}
	return out
}

func (p *planner) takeBlocking(changePath string) []string {
	var taken []string
	take := func(blockingPath string) {
		if deletes, ok := p.blocking[blockingPath]; ok {
			taken = append(taken, deletes...)
			delete(p.blocking, blockingPath)
		}
	}

	for end := strings.IndexByte(changePath, '/'); end > 0; {
		take(changePath[:end])
		next := strings.IndexByte(changePath[end+1:], '/')
		if next < 0 {
			break
		}
		end += 1 + next
	}
	take(changePath)
	return taken
}

func (p *planner) isBlocking(remotePath string) bool {
	if len(p.blocking) == 0 {
		return false
	}
	if _, ok := p.blocking[remotePath]; ok {
		return true
	}
	for dir := path.Dir(remotePath); dir != "."; dir = path.Dir(dir) {
		if p.blockingDirs[dir] {
			return true
		}
	}
	return false
}

func isRegularFile(mode remotestate.Mode) bool {
	return mode == remotestate.ModeFile || mode == remotestate.ModeExecutable
}

// existsRemotely is only consulted for entries that changed, so an unchanged sync never
// pays for indexing the whole remote tree.
func (p *planner) existsRemotely(sha string) bool {
	if p.existing == nil {
		p.existing = map[[20]byte]struct{}{}
		_ = p.in.Remote.Blobs(func(e remotestate.Entry) error {
			if isRegularFile(e.Mode) {
				if key, ok := shaKey(e.SHA); ok {
					p.existing[key] = struct{}{}
				}
			}
			return nil
		})
	}

	key, ok := shaKey(sha)
	if !ok {
		return false
	}
	_, found := p.existing[key]
	return found
}

func shaKey(s string) ([20]byte, bool) {
	var key [20]byte
	if len(s) != 40 {
		return key, false
	}
	_, err := hex.Decode(key[:], []byte(s))
	return key, err == nil
}

// planGitattributes adds LFS rules for every LFS path when an LFS file is written, the
// way the code-bucket exporter always has. Unchanged LFS files don't trigger a read.
func (p *planner) planGitattributes(ctx context.Context) error {
	if !p.lfsChanged {
		return nil
	}

	var existing []byte
	existingEntry, exists := p.in.Remote.Lookup(GitattributesPath)
	if exists {
		content, err := p.in.ReadBlob(ctx, existingEntry.SHA)
		if err != nil {
			return fmt.Errorf("read existing %s: %w", GitattributesPath, err)
		}
		existing = content
	}

	merged := MergeGitattributes(existing, p.lfsPaths)
	if exists && bytes.Equal(merged, existing) {
		return nil
	}
	if len(merged) > maxGitattributesBytes {
		return FileTooLarge(GitattributesPath, int64(len(merged)), maxGitattributesBytes)
	}

	mode := remotestate.ModeFile
	if exists && existingEntry.Mode == remotestate.ModeExecutable {
		mode = existingEntry.Mode
	}
	p.gitattributes = &commitbatch.Change{
		Kind:    commitbatch.ChangeAdd,
		Path:    GitattributesPath,
		Mode:    mode,
		BlobSHA: GitBlobSHA(merged),
		Size:    int64(len(merged)),
		Open:    bytesOpener(merged),
	}
	p.plan.Uploads++
	return nil
}

// planDeletes merge-joins the remote blobs with the manifest (both in byte order of
// paths) to find in-scope paths the manifest no longer has, then applies the guard to
// the ones the previous manifest doesn't explain.
func (p *planner) planDeletes(ctx context.Context) error {
	scope := p.in.Manifest.Header.Scope

	it, err := p.in.Manifest.Entries()
	if err != nil {
		return err
	}
	defer it.Close()

	hasEntry := it.Next()
	var deletes []string
	err = p.in.Remote.Blobs(func(e remotestate.Entry) error {
		if !scope.Contains(e.Path) {
			return nil
		}
		p.plan.ScopeEntries++

		for hasEntry && it.Entry().Path < e.Path {
			hasEntry = it.Next()
		}
		if hasEntry && it.Entry().Path == e.Path {
			return nil
		}
		deletes = append(deletes, e.Path)
		return nil
	})
	if err != nil {
		return err
	}
	if err := it.Err(); err != nil {
		return err
	}
	if len(deletes) == 0 {
		return nil
	}

	unexpected, err := p.unexpectedDeletes(ctx, deletes)
	if err != nil {
		return err
	}
	p.plan.Deletes = deletes
	p.plan.UnexpectedDeletes = unexpected

	if p.in.Guard.Tripped(len(unexpected), p.plan.ScopeEntries) {
		return DeletionGuardTripped(unexpected, len(unexpected), p.plan.ScopeEntries, p.in.Guard)
	}

	for _, deletePath := range deletes {
		if !p.isBlocking(deletePath) {
			p.plan.Final = append(p.plan.Final, commitbatch.Change{Kind: commitbatch.ChangeDelete, Path: deletePath})
		}
	}
	return nil
}

func (p *planner) unexpectedDeletes(ctx context.Context, deletes []string) ([]string, error) {
	if p.in.Previous == nil {
		return deletes, nil
	}

	var unexpected []string
	i := 0
	err := manifest.ExpectedDeletes(ctx, p.in.Previous, p.in.Manifest, func(expected string) error {
		for i < len(deletes) && deletes[i] < expected {
			unexpected = append(unexpected, deletes[i])
			i++
		}
		if i < len(deletes) && deletes[i] == expected {
			i++
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return append(unexpected, deletes[i:]...), nil
}

func GitBlobSHA(content []byte) string {
	h := sha1.New()
	h.Write([]byte("blob " + strconv.Itoa(len(content)) + "\x00"))
	h.Write(content)
	return hex.EncodeToString(h.Sum(nil))
}

func bytesOpener(content []byte) func(context.Context) (io.ReadCloser, error) {
	return func(context.Context) (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(content)), nil
	}
}

func verifiedOpener(file manifest.SourceFile) func(context.Context) (io.ReadCloser, error) {
	entry := manifest.Entry{Path: file.Path, GitBlobSHA: file.GitBlobSHA, SHA256: file.SHA256, Size: file.Size}

	return func(ctx context.Context) (io.ReadCloser, error) {
		body, err := file.Open(ctx)
		if err != nil {
			return nil, err
		}
		return manifest.NewVerifyingReader(body, entry), nil
	}
}
