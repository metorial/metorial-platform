package gitpush

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strconv"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/packfile"
	"github.com/go-git/go-git/v5/plumbing/storer"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

// lazyBlob is a blob whose content is opened only when the encoder writes it, and
// verified against its git SHA while it streams.
type lazyBlob struct {
	ctx  context.Context
	hash plumbing.Hash
	path string
	size int64
	open func(ctx context.Context) (io.ReadCloser, error)
}

func (b *lazyBlob) Hash() plumbing.Hash         { return b.hash }
func (b *lazyBlob) Type() plumbing.ObjectType   { return plumbing.BlobObject }
func (b *lazyBlob) SetType(plumbing.ObjectType) {}
func (b *lazyBlob) Size() int64                 { return b.size }
func (b *lazyBlob) SetSize(int64)               {}
func (b *lazyBlob) Writer() (io.WriteCloser, error) {
	return nil, errors.New("gitpush: read-only object")
}

func (b *lazyBlob) Reader() (io.ReadCloser, error) {
	body, err := b.open(b.ctx)
	if err != nil {
		return nil, err
	}

	h := sha1.New()
	h.Write([]byte("blob " + strconv.FormatInt(b.size, 10) + "\x00"))
	return &verifyingBlob{body: body, blob: b, hash: h}, nil
}

type verifyingBlob struct {
	body io.ReadCloser
	blob *lazyBlob
	hash interface {
		io.Writer
		Sum([]byte) []byte
	}
	read int64
}

func (v *verifyingBlob) Read(p []byte) (int, error) {
	n, err := v.body.Read(p)
	v.read += int64(n)
	if v.read > v.blob.size {
		return 0, v.mismatch(fmt.Sprintf("source has more than %d bytes", v.blob.size))
	}
	v.hash.Write(p[:n])

	if errors.Is(err, io.EOF) {
		if v.read != v.blob.size {
			return n, v.mismatch(fmt.Sprintf("source has %d bytes, expected %d", v.read, v.blob.size))
		}
		if got := hex.EncodeToString(v.hash.Sum(nil)); got != v.blob.hash.String() {
			return n, v.mismatch("git blob SHA differs")
		}
	}
	return n, err
}

func (v *verifyingBlob) mismatch(reason string) error {
	return &manifest.ContentMismatchError{Path: v.blob.path, Reason: reason}
}

func (v *verifyingBlob) Close() error { return v.body.Close() }

// objectSet is the storer the go-git packfile encoder reads from; only lookups by
// hash are supported.
type objectSet struct {
	storer.EncodedObjectStorer
	objects map[plumbing.Hash]plumbing.EncodedObject
	order   []plumbing.Hash
}

func newObjectSet() *objectSet {
	return &objectSet{objects: map[plumbing.Hash]plumbing.EncodedObject{}}
}

func (s *objectSet) add(o plumbing.EncodedObject) {
	if _, exists := s.objects[o.Hash()]; exists {
		return
	}
	s.objects[o.Hash()] = o
	s.order = append(s.order, o.Hash())
}

func (s *objectSet) addMemory(t plumbing.ObjectType, data []byte) plumbing.Hash {
	o := &plumbing.MemoryObject{}
	o.SetType(t)
	_, _ = o.Write(data)
	s.add(o)
	return o.Hash()
}

func (s *objectSet) EncodedObject(t plumbing.ObjectType, h plumbing.Hash) (plumbing.EncodedObject, error) {
	if o, ok := s.objects[h]; ok {
		return o, nil
	}
	return nil, plumbing.ErrObjectNotFound
}

// writePack streams every object, blobs first, as a packfile without deltas.
func (s *objectSet) writePack(w io.Writer) error {
	_, err := packfile.NewEncoder(w, s, false).Encode(s.order, 0)
	return err
}
