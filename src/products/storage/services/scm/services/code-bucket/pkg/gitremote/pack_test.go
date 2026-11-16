package gitremote

import (
	"bytes"
	"compress/zlib"
	"context"
	"crypto/sha1"
	"encoding/binary"
	"errors"
	"testing"

	"github.com/go-git/go-git/v5/plumbing"
)

// cancelAfterContext reports Canceled from the n+1th Err call on, so a test can cancel
// at a precise point of a loop that polls the context.
type cancelAfterContext struct {
	context.Context
	remaining int
}

func (c *cancelAfterContext) Err() error {
	if c.remaining <= 0 {
		return context.Canceled
	}
	c.remaining--
	return nil
}

// refDeltaPack is a tree stored as a REF delta on a base tree that comes later in the
// pack, so it can only be resolved after the main pass.
func refDeltaPack(t *testing.T) ([]byte, plumbing.Hash) {
	t.Helper()

	base := treeBytes(TreeEntry{Name: "a", Mode: 0o100644, SHA: plumbing.ComputeHash(plumbing.BlobObject, []byte("a"))})
	target := treeBytes(TreeEntry{Name: "b", Mode: 0o100644, SHA: plumbing.ComputeHash(plumbing.BlobObject, []byte("b"))})
	baseSHA := plumbing.ComputeHash(plumbing.TreeObject, base)

	delta := []byte{byte(len(base)), byte(len(target)), byte(len(target))}
	delta = append(delta, target...)

	var b bytes.Buffer
	b.WriteString("PACK")
	_ = binary.Write(&b, binary.BigEndian, uint32(2))
	_ = binary.Write(&b, binary.BigEndian, uint32(2))

	writeObject := func(typ plumbing.ObjectType, prefix, data []byte) {
		size := len(data)
		c := byte(typ)<<4 | byte(size&0x0f)
		size >>= 4
		for size > 0 {
			b.WriteByte(c | 0x80)
			c = byte(size & 0x7f)
			size >>= 7
		}
		b.WriteByte(c)
		b.Write(prefix)
		z := zlib.NewWriter(&b)
		_, _ = z.Write(data)
		_ = z.Close()
	}
	writeObject(plumbing.REFDeltaObject, baseSHA[:], delta)
	writeObject(plumbing.TreeObject, nil, base)

	sum := sha1.Sum(b.Bytes())
	b.Write(sum[:])
	return b.Bytes(), plumbing.ComputeHash(plumbing.TreeObject, target)
}

func TestReadPackObjectsRefDeltas(t *testing.T) {
	limits := packLimits{MaxObjects: 10, MaxObjectBytes: 1 << 20, MaxInflatedBytes: 1 << 20}
	data, targetSHA := refDeltaPack(t)

	tests := []struct {
		name string
		// checks is how many context polls succeed before it reports Canceled; -1
		// never cancels. The main pass polls once per object (2 here).
		checks  int
		wantErr error
	}{
		{name: "resolves a delta on a later base", checks: -1},
		{name: "cancelled before reading", checks: 0, wantErr: context.Canceled},
		{name: "cancelled while resolving deferred deltas", checks: 2, wantErr: context.Canceled},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var ctx context.Context = context.Background()
			if tt.checks >= 0 {
				ctx = &cancelAfterContext{Context: context.Background(), remaining: tt.checks}
			}

			store, err := readPackObjects(ctx, bytes.NewReader(data), limits)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("err = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if _, ok := store[targetSHA]; !ok {
				t.Fatalf("delta target %s was not resolved", targetSHA)
			}
		})
	}
}
