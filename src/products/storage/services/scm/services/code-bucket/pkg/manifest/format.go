package manifest

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	FormatVersion = 1
	Kind          = "metorial.skill-destination-manifest"
	KeyPrefix     = "skill-sync/manifests/"

	MaxEntries              = 250_000
	MaxLineBytes            = 64 << 10
	MaxObjectBytes          = 96 << 20
	MaxFileBytes      int64 = 2 << 30
	maxSourceKeyBytes       = 1024
)

type Header struct {
	DestinationID string
	SourceBucket  string
	EntryCount    int
	TotalBytes    int64
	Scope         Scope
}

type Entry struct {
	Path       string
	GitBlobSHA string
	SHA256     string
	Size       int64
	CRC32      uint32
	Key        string
}

type wireScope struct {
	Dirs  *[]string `json:"dirs"`
	Files *[]string `json:"files"`
	Globs *[]string `json:"globs"`
}

type wireHeader struct {
	T             *string    `json:"t"`
	V             *int       `json:"v"`
	Kind          *string    `json:"kind"`
	DestinationID *string    `json:"destinationId"`
	SourceBucket  *string    `json:"sourceBucket"`
	EntryCount    *int64     `json:"entryCount"`
	TotalBytes    *int64     `json:"totalBytes"`
	Scope         *wireScope `json:"scope"`
}

type wireEntry struct {
	T *string `json:"t"`
	P *string `json:"p"`
	G *string `json:"g"`
	S *string `json:"s"`
	N *int64  `json:"n"`
	C *uint32 `json:"c"`
	K *string `json:"k"`
}

func decodeStrict(line []byte, into any) error {
	if len(line) == 0 {
		return errors.New("empty line")
	}
	if line[0] != '{' || line[len(line)-1] != '}' {
		return errors.New("line must be a single JSON object without surrounding whitespace")
	}

	decoder := json.NewDecoder(bytes.NewReader(line))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(into); err != nil {
		return err
	}
	if _, err := decoder.Token(); err != io.EOF {
		return errors.New("unexpected data after JSON object")
	}

	return nil
}

func parseHeader(line []byte) (Header, error) {
	var w wireHeader
	if err := decodeStrict(line, &w); err != nil {
		return Header{}, fmt.Errorf("header: %w", err)
	}

	switch {
	case w.T == nil || *w.T != "header":
		return Header{}, errors.New(`first line must be the header (t = "header")`)
	case w.V == nil || *w.V != FormatVersion:
		return Header{}, fmt.Errorf("unsupported format version, want v = %d", FormatVersion)
	case w.Kind == nil || *w.Kind != Kind:
		return Header{}, fmt.Errorf("kind must be %q", Kind)
	case w.DestinationID == nil || *w.DestinationID == "":
		return Header{}, errors.New("header: destinationId is required")
	case w.SourceBucket == nil || *w.SourceBucket == "":
		return Header{}, errors.New("header: sourceBucket is required")
	case w.EntryCount == nil || *w.EntryCount < 0 || *w.EntryCount > MaxEntries:
		return Header{}, fmt.Errorf("header: entryCount must be between 0 and %d", MaxEntries)
	case w.TotalBytes == nil || *w.TotalBytes < 0:
		return Header{}, errors.New("header: totalBytes must be a non-negative integer")
	case w.Scope == nil || w.Scope.Dirs == nil || w.Scope.Files == nil || w.Scope.Globs == nil:
		return Header{}, errors.New("header: scope with dirs, files and globs is required")
	}

	scope := Scope{Dirs: *w.Scope.Dirs, Files: *w.Scope.Files, Globs: *w.Scope.Globs}
	if err := scope.Validate(); err != nil {
		return Header{}, fmt.Errorf("header: %w", err)
	}

	return Header{
		DestinationID: *w.DestinationID,
		SourceBucket:  *w.SourceBucket,
		EntryCount:    int(*w.EntryCount),
		TotalBytes:    *w.TotalBytes,
		Scope:         scope,
	}, nil
}

func parseEntry(line []byte) (Entry, error) {
	var w wireEntry
	if err := decodeStrict(line, &w); err != nil {
		return Entry{}, err
	}

	switch {
	case w.T == nil || *w.T != "entry":
		return Entry{}, errors.New(`t must be "entry"`)
	case w.P == nil:
		return Entry{}, errors.New("p is required")
	case w.G == nil || !isLowerHex(*w.G, 40):
		return Entry{}, errors.New("g must be 40 lowercase hex characters")
	case w.S == nil || !isLowerHex(*w.S, 64):
		return Entry{}, errors.New("s must be 64 lowercase hex characters")
	case w.N == nil || *w.N < 0 || *w.N > MaxFileBytes:
		return Entry{}, fmt.Errorf("n must be between 0 and %d", MaxFileBytes)
	case w.C == nil:
		return Entry{}, errors.New("c is required")
	case w.K == nil || !isValidSourceKey(*w.K):
		return Entry{}, errors.New("k must be a non-empty object key")
	}

	if err := ValidatePath(*w.P); err != nil {
		return Entry{}, err
	}

	return Entry{
		Path:       *w.P,
		GitBlobSHA: *w.G,
		SHA256:     *w.S,
		Size:       *w.N,
		CRC32:      *w.C,
		Key:        *w.K,
	}, nil
}

func isLowerHex(s string, length int) bool {
	if len(s) != length {
		return false
	}

	for i := 0; i < len(s); i++ {
		c := s[i]
		if !('0' <= c && c <= '9' || 'a' <= c && c <= 'f') {
			return false
		}
	}

	return true
}

func isValidSourceKey(key string) bool {
	return key != "" &&
		len(key) <= maxSourceKeyBytes &&
		utf8.ValidString(key) &&
		strings.IndexFunc(key, unicode.IsControl) < 0
}
