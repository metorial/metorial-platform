package gitremote

import (
	"bytes"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	maxTreeDepth = 256
	maxPathBytes = 4096
)

type TreeEntry struct {
	Name string
	Mode remotestate.Mode
	SHA  plumbing.Hash
}

var emptyTree = plumbing.NewHash(remotestate.EmptyTreeSHA)

// State is a commit's tree as content-addressed tree objects: unchanged subtrees are
// shared between states, so tracking a branch across commits costs only the trees that
// changed.
type State struct {
	Commit string
	Root   plumbing.Hash
	trees  map[plumbing.Hash][]TreeEntry
}

func (s *State) TreeSHA() string { return s.Root.String() }

func (s *State) tree(sha plumbing.Hash) ([]TreeEntry, bool) {
	if sha == emptyTree {
		return nil, true
	}
	entries, ok := s.trees[sha]
	return entries, ok
}

// Lookup returns the entry at p.
func (s *State) Lookup(p string) (TreeEntry, bool) {
	current := s.Root
	segments := strings.Split(p, "/")
	for i, segment := range segments {
		entries, ok := s.tree(current)
		if !ok {
			return TreeEntry{}, false
		}
		entry, found := findEntry(entries, segment)
		if !found {
			return TreeEntry{}, false
		}
		if i == len(segments)-1 {
			return entry, true
		}
		if !entry.Mode.IsTree() {
			return TreeEntry{}, false
		}
		current = entry.SHA
	}
	return TreeEntry{}, false
}

func findEntry(entries []TreeEntry, name string) (TreeEntry, bool) {
	for _, e := range entries {
		if e.Name == name {
			return e, true
		}
	}
	return TreeEntry{}, false
}

// Listing expands the state into a remotestate listing, failing past maxEntries so a
// small set of repeated subtrees can't expand into an enormous listing.
func (s *State) Listing(maxEntries int) (*remotestate.Listing, error) {
	if maxEntries <= 0 {
		maxEntries = remotestate.MaxEntries
	}

	listing := remotestate.New()
	listing.CommitSHA = s.Commit
	entries := 0

	var walk func(dir string, sha plumbing.Hash, depth int) error
	walk = func(dir string, sha plumbing.Hash, depth int) error {
		if depth > maxTreeDepth {
			return fmt.Errorf("%w: tree nesting deeper than %d", ErrTooLarge, maxTreeDepth)
		}
		children, ok := s.tree(sha)
		if !ok {
			return fmt.Errorf("%w: tree %s is missing", ErrIncomplete, sha)
		}

		for _, child := range children {
			p := child.Name
			if dir != "" {
				p = dir + "/" + child.Name
			}
			if len(p) > maxPathBytes {
				return fmt.Errorf("%w: path longer than %d bytes", ErrTooLarge, maxPathBytes)
			}
			entries++
			if entries > maxEntries {
				return fmt.Errorf("%w: tree has more than %d entries", ErrTooLarge, maxEntries)
			}

			if err := listing.Add(remotestate.Entry{Path: p, Mode: child.Mode, SHA: child.SHA.String()}); err != nil {
				return fmt.Errorf("%w: %v", ErrProtocol, err)
			}
			if child.Mode.IsTree() {
				if err := walk(p, child.SHA, depth+1); err != nil {
					return err
				}
			}
		}
		return nil
	}

	if err := walk("", s.Root, 0); err != nil {
		return nil, err
	}
	return listing, nil
}

// StateFromListing rebuilds tree objects from a cached listing, e.g. to seed an
// incremental fetch. Tree SHAs are recomputed; they match the remote as long as the
// listing does.
func StateFromListing(l *remotestate.Listing) (*State, error) {
	type dir struct {
		path    string
		entries []TreeEntry
	}

	trees := map[plumbing.Hash][]TreeEntry{}
	stack := []*dir{{path: ""}}

	finish := func() (plumbing.Hash, *dir) {
		top := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		sortEntries(top.entries)
		sha := plumbing.ComputeHash(plumbing.TreeObject, EncodeTree(top.entries))
		trees[sha] = top.entries
		return sha, top
	}

	err := l.Walk(func(e remotestate.Entry) error {
		for len(stack) > 1 && !strings.HasPrefix(e.Path, stack[len(stack)-1].path+"/") {
			sha, done := finish()
			parent := stack[len(stack)-1]
			parent.entries = append(parent.entries, TreeEntry{Name: baseName(done.path), Mode: remotestate.ModeTree, SHA: sha})
		}

		if e.Mode.IsTree() {
			stack = append(stack, &dir{path: e.Path})
			return nil
		}
		if !isSHA(e.SHA) {
			return fmt.Errorf("invalid SHA in cached listing: %q", e.SHA)
		}
		parent := stack[len(stack)-1]
		parent.entries = append(parent.entries, TreeEntry{Name: baseName(e.Path), Mode: e.Mode, SHA: plumbing.NewHash(e.SHA)})
		return nil
	})
	if err != nil {
		return nil, err
	}

	for len(stack) > 1 {
		sha, done := finish()
		parent := stack[len(stack)-1]
		parent.entries = append(parent.entries, TreeEntry{Name: baseName(done.path), Mode: remotestate.ModeTree, SHA: sha})
	}
	root, _ := finish()
	return &State{Commit: l.CommitSHA, Root: root, trees: trees}, nil
}

func baseName(p string) string {
	if i := strings.LastIndexByte(p, '/'); i >= 0 {
		return p[i+1:]
	}
	return p
}

// sortEntries orders entries the way git does: by name bytes, with trees compared
// as if their name ended in "/".
func sortEntries(entries []TreeEntry) {
	key := func(e TreeEntry) string {
		if e.Mode.IsTree() {
			return e.Name + "/"
		}
		return e.Name
	}
	sort.Slice(entries, func(i, j int) bool { return key(entries[i]) < key(entries[j]) })
}

func EncodeTree(entries []TreeEntry) []byte {
	var b bytes.Buffer
	for _, e := range entries {
		b.WriteString(e.Mode.String())
		b.WriteByte(' ')
		b.WriteString(e.Name)
		b.WriteByte(0)
		b.Write(e.SHA[:])
	}
	return b.Bytes()
}

// Tree is a tree object created by Apply.
type Tree struct {
	SHA  plumbing.Hash
	Data []byte
}

var ErrConflict = errors.New("gitremote: change conflicts with the tree")

// Apply returns the state after changes, plus the tree objects it had to create
// (only directories on the path of a change; untouched subtrees keep their SHAs).
// Commit is left empty for the caller to set.
func (s *State) Apply(changes []remotestate.Change) (*State, []Tree, error) {
	type node struct {
		entries  map[string]TreeEntry
		children map[string]*node
	}

	load := func(sha plumbing.Hash) (*node, error) {
		entries, ok := s.tree(sha)
		if !ok {
			return nil, fmt.Errorf("%w: tree %s is missing", ErrIncomplete, sha)
		}
		n := &node{entries: make(map[string]TreeEntry, len(entries)), children: map[string]*node{}}
		for _, e := range entries {
			n.entries[e.Name] = e
		}
		return n, nil
	}

	root, err := load(s.Root)
	if err != nil {
		return nil, nil, err
	}

	var emptied func(n *node) bool
	emptied = func(n *node) bool {
		for name, e := range n.entries {
			child, loaded := n.children[name]
			if !e.Mode.IsTree() || !loaded || !emptied(child) {
				return false
			}
		}
		return true
	}

	for _, change := range changes {
		segments := strings.Split(change.Path, "/")
		for _, segment := range segments {
			if segment == "" || segment == "." || segment == ".." {
				return nil, nil, fmt.Errorf("%w: invalid path %q", ErrConflict, change.Path)
			}
		}

		current := root
		missing := false
		for i, segment := range segments[:len(segments)-1] {
			if child, ok := current.children[segment]; ok {
				current = child
				continue
			}
			entry, exists := current.entries[segment]
			switch {
			case exists && !entry.Mode.IsTree():
				return nil, nil, fmt.Errorf("%w: %s is a file", ErrConflict, strings.Join(segments[:i+1], "/"))
			case exists:
				child, err := load(entry.SHA)
				if err != nil {
					return nil, nil, err
				}
				current.children[segment] = child
				current = child
			case change.Delete:
				missing = true
			default:
				child := &node{entries: map[string]TreeEntry{}, children: map[string]*node{}}
				current.entries[segment] = TreeEntry{Name: segment, Mode: remotestate.ModeTree}
				current.children[segment] = child
				current = child
			}
			if missing {
				break
			}
		}
		if missing {
			continue
		}

		name := segments[len(segments)-1]
		if existing, ok := current.entries[name]; ok && existing.Mode.IsTree() {
			child, loaded := current.children[name]
			if change.Delete || !loaded || !emptied(child) {
				return nil, nil, fmt.Errorf("%w: %s is a directory", ErrConflict, change.Path)
			}
			delete(current.children, name)
		}
		if change.Delete {
			delete(current.entries, name)
			continue
		}

		mode := change.Mode
		if mode == 0 {
			mode = remotestate.ModeFile
		}
		if mode.IsTree() || !isSHA(change.SHA) {
			return nil, nil, fmt.Errorf("%w: invalid change at %s", ErrConflict, change.Path)
		}
		current.entries[name] = TreeEntry{Name: name, Mode: mode, SHA: plumbing.NewHash(change.SHA)}
	}

	var created []Tree
	var write func(n *node, isRoot bool) (plumbing.Hash, bool)
	write = func(n *node, isRoot bool) (plumbing.Hash, bool) {
		for name, child := range n.children {
			sha, keep := write(child, false)
			if keep {
				n.entries[name] = TreeEntry{Name: name, Mode: remotestate.ModeTree, SHA: sha}
			} else {
				delete(n.entries, name)
			}
		}
		if len(n.entries) == 0 && !isRoot {
			return plumbing.ZeroHash, false
		}

		entries := make([]TreeEntry, 0, len(n.entries))
		for _, e := range n.entries {
			entries = append(entries, e)
		}
		sortEntries(entries)
		data := EncodeTree(entries)
		sha := plumbing.ComputeHash(plumbing.TreeObject, data)
		if _, known := s.trees[sha]; !known {
			s.trees[sha] = entries
			created = append(created, Tree{SHA: sha, Data: data})
		}
		return sha, true
	}

	rootSHA, _ := write(root, true)
	return &State{Root: rootSHA, trees: s.trees}, created, nil
}

// parseTree decodes a raw tree object: "<octal mode> <name>\0<20-byte sha>" repeated.
func parseTree(data []byte) ([]TreeEntry, error) {
	var entries []TreeEntry
	for len(data) > 0 {
		space := bytes.IndexByte(data, ' ')
		if space <= 0 || space > 7 {
			return nil, fmt.Errorf("%w: malformed tree entry mode", ErrProtocol)
		}
		mode, err := remotestate.ParseMode(string(data[:space]))
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrProtocol, err)
		}
		data = data[space+1:]

		nul := bytes.IndexByte(data, 0)
		if nul <= 0 || len(data) < nul+1+20 {
			return nil, fmt.Errorf("%w: malformed tree entry", ErrProtocol)
		}
		name := string(data[:nul])
		if name == "." || name == ".." || bytes.IndexByte(data[:nul], '/') >= 0 {
			return nil, fmt.Errorf("%w: invalid tree entry name %q", ErrProtocol, printable(data[:nul]))
		}

		var sha plumbing.Hash
		copy(sha[:], data[nul+1:nul+21])
		entries = append(entries, TreeEntry{Name: name, Mode: normalizeMode(mode), SHA: sha})
		data = data[nul+21:]
	}
	return entries, nil
}

// normalizeMode maps legacy modes (e.g. 100664, zero-padded 040000) onto git's
// canonical set, as git fsck and every modern writer does.
func normalizeMode(mode remotestate.Mode) remotestate.Mode {
	switch {
	case mode == remotestate.ModeTree, mode == remotestate.ModeSymlink, mode == remotestate.ModeSubmodule,
		mode == remotestate.ModeFile, mode == remotestate.ModeExecutable:
		return mode
	case mode&0o170000 == 0o040000:
		return remotestate.ModeTree
	case mode&0o111 != 0:
		return remotestate.ModeExecutable
	default:
		return remotestate.ModeFile
	}
}

func commitTree(data []byte) (plumbing.Hash, error) {
	line, _, _ := bytes.Cut(data, []byte("\n"))
	value, ok := bytes.CutPrefix(line, []byte("tree "))
	if !ok || !isSHA(string(value)) {
		return plumbing.ZeroHash, fmt.Errorf("%w: commit without a tree", ErrProtocol)
	}
	return plumbing.NewHash(string(value)), nil
}

// buildState collects every tree reachable from head's root, from the pack or, for
// subtrees the server didn't resend, from base. Each tree is visited once, so
// repeated subtrees cost nothing here; Listing enforces the entry cap.
func buildState(store objectStore, head string, base *State) (*State, error) {
	commit, ok := store[plumbing.NewHash(head)]
	if !ok || commit.typ != plumbing.CommitObject {
		return nil, fmt.Errorf("%w: head commit %s is not in the pack", ErrIncomplete, head)
	}
	root, err := commitTree(commit.data)
	if err != nil {
		return nil, err
	}

	state := &State{Commit: head, Root: root, trees: map[plumbing.Hash][]TreeEntry{}}
	queue := []plumbing.Hash{root}
	for len(queue) > 0 {
		sha := queue[len(queue)-1]
		queue = queue[:len(queue)-1]
		if _, seen := state.trees[sha]; seen || sha == emptyTree {
			continue
		}

		var entries []TreeEntry
		if object, ok := store[sha]; ok {
			if object.typ != plumbing.TreeObject {
				return nil, fmt.Errorf("%w: %s is not a tree", ErrProtocol, sha)
			}
			if entries, err = parseTree(object.data); err != nil {
				return nil, err
			}
		} else if known, ok := base.lookupTree(sha); ok {
			entries = known
		} else {
			return nil, fmt.Errorf("%w: tree %s is missing", ErrIncomplete, sha)
		}

		state.trees[sha] = entries
		for _, e := range entries {
			if e.Mode.IsTree() {
				queue = append(queue, e.SHA)
			}
		}
	}
	return state, nil
}

func (s *State) lookupTree(sha plumbing.Hash) ([]TreeEntry, bool) {
	if s == nil {
		return nil, false
	}
	return s.tree(sha)
}
