// Package remotestate holds the path, mode and SHA of every blob and subtree of a
// remote commit's tree, and recomputes tree SHAs locally after changes so a listing can
// follow our own commits without re-reading the remote.
package remotestate

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type Mode uint32

const (
	ModeFile       Mode = 0o100644
	ModeExecutable Mode = 0o100755
	ModeSymlink    Mode = 0o120000
	ModeTree       Mode = 0o40000
	ModeSubmodule  Mode = 0o160000
)

// EmptyTreeSHA is git's well-known hash of a tree with no entries.
const EmptyTreeSHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

// String is the octal form git writes into tree objects ("40000", not "040000").
func (m Mode) String() string { return strconv.FormatUint(uint64(m), 8) }

func (m Mode) IsTree() bool { return m == ModeTree }

func ParseMode(s string) (Mode, error) {
	value, err := strconv.ParseUint(s, 8, 32)
	if err != nil || value == 0 {
		return 0, fmt.Errorf("invalid git mode %q", s)
	}
	return Mode(value), nil
}

type Entry struct {
	Path string
	Mode Mode
	SHA  string
}

// Change is applied to a listing after a commit lands. Mode zero means ModeFile.
type Change struct {
	Path   string
	Mode   Mode
	SHA    string
	Delete bool
}

var (
	ErrNotFound = errors.New("path not found in listing")
	ErrConflict = errors.New("path conflicts with an existing entry")
)

type sha [20]byte

type node struct {
	mode     Mode
	sha      sha
	hasSHA   bool
	children map[string]*node
}

func (n *node) isTree() bool { return n.mode.IsTree() }

type Listing struct {
	CommitSHA string

	root *node
}

func New() *Listing {
	return &Listing{root: newTree()}
}

func newTree() *node {
	return &node{mode: ModeTree, children: map[string]*node{}}
}

// FromEntries builds a listing from blob and tree entries in any order. Trees without
// an entry of their own get their SHA computed from their children.
func FromEntries(commitSHA string, entries []Entry) (*Listing, error) {
	l := New()
	l.CommitSHA = commitSHA

	for _, e := range entries {
		if err := l.Add(e); err != nil {
			return nil, err
		}
	}

	return l, nil
}

func parseSHA(s string) (sha, error) {
	var out sha
	if len(s) != 40 {
		return out, fmt.Errorf("invalid object SHA %q", s)
	}
	if _, err := hex.Decode(out[:], []byte(s)); err != nil || strings.ToLower(s) != s {
		return out, fmt.Errorf("invalid object SHA %q", s)
	}
	return out, nil
}

func splitPath(p string) ([]string, error) {
	if p == "" || strings.ContainsRune(p, 0) {
		return nil, fmt.Errorf("invalid path %q", p)
	}

	segments := strings.Split(p, "/")
	for _, segment := range segments {
		if segment == "" {
			return nil, fmt.Errorf("invalid path %q", p)
		}
	}
	return segments, nil
}

// Add records an entry as the remote reports it. A tree entry pins that tree's SHA
// until something below it changes.
func (l *Listing) Add(e Entry) error {
	segments, err := splitPath(e.Path)
	if err != nil {
		return err
	}
	objectSHA, err := parseSHA(e.SHA)
	if err != nil {
		return err
	}

	parent, err := l.ensureParents(segments, false)
	if err != nil {
		return err
	}

	name := segments[len(segments)-1]
	existing := parent.children[name]
	if e.Mode.IsTree() {
		if existing == nil {
			existing = newTree()
			parent.children[name] = existing
		} else if !existing.isTree() {
			return fmt.Errorf("%w: %s is a file", ErrConflict, e.Path)
		}
		existing.sha, existing.hasSHA = objectSHA, true
		return nil
	}

	if existing != nil && existing.isTree() {
		return fmt.Errorf("%w: %s is a directory", ErrConflict, e.Path)
	}
	parent.children[name] = &node{mode: e.Mode, sha: objectSHA, hasSHA: true}
	return nil
}

func (l *Listing) ensureParents(segments []string, invalidate bool) (*node, error) {
	current := l.root
	if invalidate {
		current.hasSHA = false
	}

	for i, segment := range segments[:len(segments)-1] {
		child := current.children[segment]
		if child == nil {
			child = newTree()
			current.children[segment] = child
		} else if !child.isTree() {
			return nil, fmt.Errorf("%w: %s is a file", ErrConflict, strings.Join(segments[:i+1], "/"))
		}
		if invalidate {
			child.hasSHA = false
		}
		current = child
	}

	return current, nil
}

// Apply updates the listing after a commit. On error the listing may be partially
// updated and must be discarded.
func (l *Listing) Apply(changes []Change) error {
	for _, change := range changes {
		var err error
		if change.Delete {
			err = l.delete(change.Path)
		} else {
			err = l.put(change)
		}
		if err != nil {
			return err
		}
	}

	return nil
}

func (l *Listing) put(change Change) error {
	segments, err := splitPath(change.Path)
	if err != nil {
		return err
	}
	objectSHA, err := parseSHA(change.SHA)
	if err != nil {
		return err
	}
	mode := change.Mode
	if mode == 0 {
		mode = ModeFile
	}
	if mode.IsTree() {
		return fmt.Errorf("cannot apply a tree change at %s", change.Path)
	}

	parent, err := l.ensureParents(segments, true)
	if err != nil {
		return err
	}

	name := segments[len(segments)-1]
	if existing := parent.children[name]; existing != nil && existing.isTree() {
		return fmt.Errorf("%w: %s is a directory", ErrConflict, change.Path)
	}
	parent.children[name] = &node{mode: mode, sha: objectSHA, hasSHA: true}
	return nil
}

func (l *Listing) delete(p string) error {
	segments, err := splitPath(p)
	if err != nil {
		return err
	}

	chain := []*node{l.root}
	current := l.root
	for _, segment := range segments[:len(segments)-1] {
		current = current.children[segment]
		if current == nil || !current.isTree() {
			return fmt.Errorf("%w: %s", ErrNotFound, p)
		}
		chain = append(chain, current)
	}

	name := segments[len(segments)-1]
	if current.children[name] == nil {
		return fmt.Errorf("%w: %s", ErrNotFound, p)
	}
	delete(current.children, name)

	for i := len(chain) - 1; i >= 0; i-- {
		chain[i].hasSHA = false
		if i > 0 && len(chain[i].children) == 0 {
			delete(chain[i-1].children, segments[i-1])
		}
	}

	return nil
}

func (l *Listing) lookupNode(p string) *node {
	if p == "" {
		return l.root
	}

	segments, err := splitPath(p)
	if err != nil {
		return nil
	}

	current := l.root
	for _, segment := range segments {
		if current.children == nil {
			return nil
		}
		current = current.children[segment]
		if current == nil {
			return nil
		}
	}
	return current
}

// Lookup returns the entry at p; for trees the SHA reflects every applied change.
func (l *Listing) Lookup(p string) (Entry, bool) {
	n := l.lookupNode(p)
	if n == nil || n == l.root {
		return Entry{}, false
	}

	objectSHA := l.hash(n)
	return Entry{Path: p, Mode: n.mode, SHA: hex.EncodeToString(objectSHA[:])}, true
}

// TreeSHA is the root tree's SHA after all applied changes.
func (l *Listing) TreeSHA() string {
	objectSHA := l.hash(l.root)
	return hex.EncodeToString(objectSHA[:])
}

func (l *Listing) hash(n *node) sha {
	if !n.isTree() || n.hasSHA {
		return n.sha
	}

	n.sha = computeTree(n, func(_ string, child *node) sha { return l.hash(child) })
	n.hasSHA = true
	return n.sha
}

func computeTree(n *node, childSHA func(name string, child *node) sha) sha {
	names := sortedNames(n)

	var content []byte
	for _, name := range names {
		child := n.children[name]
		objectSHA := childSHA(name, child)

		content = append(content, child.mode.String()...)
		content = append(content, ' ')
		content = append(content, name...)
		content = append(content, 0)
		content = append(content, objectSHA[:]...)
	}

	h := sha1.New()
	fmt.Fprintf(h, "tree %d\x00", len(content))
	h.Write(content)

	var out sha
	copy(out[:], h.Sum(nil))
	return out
}

// sortedNames orders children the way git does: by name bytes, with trees compared as
// if their name ended in "/".
func sortedNames(n *node) []string {
	names := make([]string, 0, len(n.children))
	for name := range n.children {
		names = append(names, name)
	}

	sortKey := func(name string) string {
		if n.children[name].isTree() {
			return name + "/"
		}
		return name
	}
	sort.Slice(names, func(i, j int) bool { return sortKey(names[i]) < sortKey(names[j]) })
	return names
}

// Verify recomputes every tree from its blobs and reports the first tree whose recorded
// SHA differs, which means the listing was incomplete or corrupted.
func (l *Listing) Verify() error {
	var mismatch error

	var recompute func(p string, n *node) sha
	recompute = func(p string, n *node) sha {
		if !n.isTree() {
			return n.sha
		}

		computed := computeTree(n, func(name string, child *node) sha {
			return recompute(joinPath(p, name), child)
		})
		if n.hasSHA && computed != n.sha && mismatch == nil {
			mismatch = fmt.Errorf("tree %q is recorded as %s but its entries hash to %s", p, hex.EncodeToString(n.sha[:]), hex.EncodeToString(computed[:]))
		}
		return computed
	}

	recompute("", l.root)
	return mismatch
}

func joinPath(dir, name string) string {
	if dir == "" {
		return name
	}
	return dir + "/" + name
}

// Walk yields every tree and blob in git order: depth first, a tree before its
// children. Leaving out trees, that is byte order of the full paths, which is the
// manifest's order, so blobs can be merge-joined against a manifest.
func (l *Listing) Walk(fn func(Entry) error) error {
	return l.walk("", l.root, fn)
}

func (l *Listing) walk(dir string, n *node, fn func(Entry) error) error {
	for _, name := range sortedNames(n) {
		child := n.children[name]
		p := joinPath(dir, name)
		objectSHA := l.hash(child)

		if err := fn(Entry{Path: p, Mode: child.mode, SHA: hex.EncodeToString(objectSHA[:])}); err != nil {
			return err
		}
		if child.isTree() {
			if err := l.walk(p, child, fn); err != nil {
				return err
			}
		}
	}

	return nil
}

func (l *Listing) Blobs(fn func(Entry) error) error {
	return l.Walk(func(e Entry) error {
		if e.Mode.IsTree() {
			return nil
		}
		return fn(e)
	})
}

// Len counts trees and blobs, excluding the root.
func (l *Listing) Len() int {
	var count func(n *node) int
	count = func(n *node) int {
		total := len(n.children)
		for _, child := range n.children {
			if child.isTree() {
				total += count(child)
			}
		}
		return total
	}

	return count(l.root)
}
