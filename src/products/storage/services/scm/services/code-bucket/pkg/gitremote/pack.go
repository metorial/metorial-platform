package gitremote

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/format/packfile"
)

type packLimits struct {
	// KeepBlobs stores blobs as well, for fetching single blobs by SHA.
	KeepBlobs        bool
	MaxObjects       int
	MaxObjectBytes   int64
	MaxInflatedBytes int64
}

type storedObject struct {
	typ  plumbing.ObjectType
	data []byte
}

// objectStore holds the commits and trees of a fetched pack; blobs are skipped
// unless packLimits.KeepBlobs is set.
type objectStore map[plumbing.Hash]storedObject

type packReader struct {
	scanner  *packfile.Scanner
	limits   packLimits
	inflated int64

	typeAt  map[int64]plumbing.ObjectType
	hashAt  map[int64]plumbing.Hash
	objects objectStore
}

// readPackObjects decodes a packfile from a seekable reader, keeping commits and
// trees (resolving their deltas) and only inflating blobs to skip past them.
func readPackObjects(ctx context.Context, r io.ReadSeeker, limits packLimits) (objectStore, error) {
	p := &packReader{
		scanner: packfile.NewScanner(r),
		limits:  limits,
		typeAt:  map[int64]plumbing.ObjectType{},
		hashAt:  map[int64]plumbing.Hash{},
		objects: objectStore{},
	}

	if err := p.read(ctx); err != nil {
		if errors.Is(err, ErrTooLarge) || errors.Is(err, ErrProtocol) || ctx.Err() != nil {
			return nil, err
		}
		return nil, fmt.Errorf("%w: invalid packfile: %v", ErrProtocol, err)
	}
	return p.objects, nil
}

type deferredDelta struct {
	offset int64
	base   plumbing.Hash
}

func (p *packReader) read(ctx context.Context) error {
	_, count, err := p.scanner.Header()
	if err != nil {
		return err
	}
	if int64(count) > int64(p.limits.MaxObjects) {
		return fmt.Errorf("%w: pack has %d objects", ErrTooLarge, count)
	}

	var deferred []deferredDelta
	for i := uint32(0); i < count; i++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		header, err := p.scanner.NextObjectHeader()
		if err != nil {
			return err
		}
		if err := p.account(header.Length); err != nil {
			return err
		}

		switch header.Type {
		case plumbing.CommitObject, plumbing.TreeObject, p.keptBlobType():
			data, err := p.readBody(header)
			if err != nil {
				return err
			}
			p.store(header.Offset, header.Type, data)

		case plumbing.BlobObject, plumbing.TagObject:
			if err := p.skipBody(header); err != nil {
				return err
			}
			p.typeAt[header.Offset] = header.Type

		case plumbing.OFSDeltaObject:
			baseType, ok := p.typeAt[header.OffsetReference]
			if !ok {
				return fmt.Errorf("%w: delta base at offset %d is unknown", ErrProtocol, header.OffsetReference)
			}
			if !p.kept(baseType) {
				if err := p.skipBody(header); err != nil {
					return err
				}
				p.typeAt[header.Offset] = baseType
				continue
			}
			if err := p.resolveDelta(header, p.hashAt[header.OffsetReference]); err != nil {
				return err
			}

		case plumbing.REFDeltaObject:
			if _, ok := p.objects[header.Reference]; ok {
				if err := p.resolveDelta(header, header.Reference); err != nil {
					return err
				}
				continue
			}
			if err := p.skipBody(header); err != nil {
				return err
			}
			// Its base is a blob or comes later in the pack; the type is settled below.
			p.typeAt[header.Offset] = plumbing.BlobObject
			deferred = append(deferred, deferredDelta{offset: header.Offset, base: header.Reference})

		default:
			return fmt.Errorf("%w: unsupported object type %d", ErrProtocol, header.Type)
		}
	}

	if _, err := p.scanner.Checksum(); err != nil {
		return err
	}

	for progress := true; progress && len(deferred) > 0; {
		progress = false
		remaining := deferred[:0]
		for _, delta := range deferred {
			if err := ctx.Err(); err != nil {
				return err
			}
			if _, ok := p.objects[delta.base]; !ok {
				remaining = append(remaining, delta)
				continue
			}
			header, err := p.scanner.SeekObjectHeader(delta.offset)
			if err != nil {
				return err
			}
			if err := p.account(header.Length); err != nil {
				return err
			}
			if err := p.resolveDelta(header, delta.base); err != nil {
				return err
			}
			progress = true
		}
		deferred = remaining
	}

	return nil
}

func (p *packReader) kept(t plumbing.ObjectType) bool {
	return t == plumbing.CommitObject || t == plumbing.TreeObject || (p.limits.KeepBlobs && t == plumbing.BlobObject)
}

func (p *packReader) keptBlobType() plumbing.ObjectType {
	if p.limits.KeepBlobs {
		return plumbing.BlobObject
	}
	return plumbing.InvalidObject
}

func (p *packReader) account(n int64) error {
	if n < 0 || n > p.limits.MaxInflatedBytes-p.inflated {
		return fmt.Errorf("%w: pack inflates to more than %d bytes", ErrTooLarge, p.limits.MaxInflatedBytes)
	}
	p.inflated += n
	return nil
}

func (p *packReader) readBody(header *packfile.ObjectHeader) ([]byte, error) {
	if header.Length > p.limits.MaxObjectBytes {
		return nil, fmt.Errorf("%w: object of %d bytes", ErrTooLarge, header.Length)
	}

	var buf bytes.Buffer
	buf.Grow(int(header.Length))
	n, _, err := p.scanner.NextObject(&buf)
	if err != nil {
		return nil, err
	}
	if n != header.Length {
		return nil, fmt.Errorf("%w: object inflates to %d bytes, header says %d", ErrProtocol, n, header.Length)
	}
	return buf.Bytes(), nil
}

func (p *packReader) skipBody(header *packfile.ObjectHeader) error {
	n, _, err := p.scanner.NextObject(io.Discard)
	if err != nil {
		return err
	}
	if n != header.Length {
		return fmt.Errorf("%w: object inflates to %d bytes, header says %d", ErrProtocol, n, header.Length)
	}
	return nil
}

func (p *packReader) store(offset int64, typ plumbing.ObjectType, data []byte) {
	h := plumbing.ComputeHash(typ, data)
	p.typeAt[offset] = typ
	p.hashAt[offset] = h
	p.objects[h] = storedObject{typ: typ, data: data}
}

func (p *packReader) resolveDelta(header *packfile.ObjectHeader, base plumbing.Hash) error {
	baseObject, ok := p.objects[base]
	if !ok {
		return fmt.Errorf("%w: delta base %s is missing", ErrProtocol, base)
	}

	delta, err := p.readBody(header)
	if err != nil {
		return err
	}

	sourceSize, rest, err := readDeltaSize(delta)
	if err != nil {
		return err
	}
	targetSize, _, err := readDeltaSize(rest)
	if err != nil {
		return err
	}
	if sourceSize != uint64(len(baseObject.data)) {
		return fmt.Errorf("%w: delta source size mismatch", ErrProtocol)
	}
	if targetSize > uint64(p.limits.MaxObjectBytes) {
		return fmt.Errorf("%w: delta result of %d bytes", ErrTooLarge, targetSize)
	}
	if err := p.account(int64(targetSize)); err != nil {
		return err
	}

	data, err := packfile.PatchDelta(baseObject.data, delta)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrProtocol, err)
	}
	if uint64(len(data)) != targetSize {
		return fmt.Errorf("%w: delta result size mismatch", ErrProtocol)
	}

	p.store(header.Offset, baseObject.typ, data)
	return nil
}

func readDeltaSize(b []byte) (uint64, []byte, error) {
	var size uint64
	for i, shift := 0, uint(0); i < len(b); i, shift = i+1, shift+7 {
		if shift > 56 {
			break
		}
		size |= uint64(b[i]&0x7f) << shift
		if b[i]&0x80 == 0 {
			return size, b[i+1:], nil
		}
	}
	return 0, nil, fmt.Errorf("%w: malformed delta header", ErrProtocol)
}
