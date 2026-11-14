package gittest

import (
	"bytes"
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

// Manifests builds manifests over an in-memory object store.
type Manifests struct {
	t       testing.TB
	Storage *manifesttest.Storage
	Scope   manifest.Scope
}

func NewManifests(t testing.TB, scope manifest.Scope) *Manifests {
	return &Manifests{t: t, Storage: manifesttest.NewStorage(), Scope: scope}
}

func (m *Manifests) Open(files map[string]string) *manifest.Manifest {
	m.t.Helper()

	entries := make([]manifest.Entry, 0, len(files))
	for path, content := range files {
		entries = append(entries, m.Storage.PutContent(path, []byte(content)))
	}

	ref := m.Storage.PutManifest("manifests", manifesttest.Encode(manifest.Header{Scope: m.Scope}, entries))
	opened, err := manifest.Open(context.Background(), m.Storage, ref, manifest.Options{SpoolDir: m.t.TempDir()})
	if err != nil {
		m.t.Fatalf("open manifest: %v", err)
	}
	m.t.Cleanup(func() { opened.Close() })
	return opened
}

// Options exports files with the deletion guard off.
func (m *Manifests) Options(files map[string]string) export.ManifestOptions {
	m.t.Helper()

	opened := m.Open(files)
	return export.ManifestOptions{
		Manifest:             opened,
		Source:               opened.Source(m.Storage),
		Guard:                export.Guard{AllowMassDelete: true},
		RemoteStateKeyPrefix: "remote-state/test/",
	}
}

// Listings is an in-memory export.ListingStore.
type Listings struct {
	mu      sync.Mutex
	objects map[string][]byte
	Loads   int
	Saves   int
}

func NewListings() *Listings {
	return &Listings{objects: map[string][]byte{}}
}

func (s *Listings) Load(ctx context.Context, ref export.RemoteState) (*remotestate.Listing, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Loads++
	data, ok := s.objects[ref.ListingKey]
	if !ok {
		return nil, errors.New("listing not found")
	}
	return remotestate.Decode(bytes.NewReader(data))
}

func (s *Listings) Save(ctx context.Context, keyPrefix string, listing *remotestate.Listing) (*export.RemoteState, error) {
	var buf bytes.Buffer
	if err := remotestate.Encode(&buf, listing); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.Saves++
	key := remotestate.ObjectKey(keyPrefix, listing.TreeSHA())
	s.objects[key] = buf.Bytes()
	return &export.RemoteState{CommitSHA: listing.CommitSHA, TreeSHA: listing.TreeSHA(), ListingBucket: "origin", ListingKey: key, EntryCount: uint32(listing.Len())}, nil
}
