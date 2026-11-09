package remotestate

import (
	"bufio"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

const (
	formatHeader = "origin-remote-state 1"

	MaxEncodedBytes = 256 << 20
	MaxEntries      = 2_000_000
)

// ObjectKey is where a listing for treeSHA lives. Listings are immutable per tree SHA.
func ObjectKey(prefix, treeSHA string) string {
	return prefix + treeSHA + ".bin"
}

// Encode writes the listing gzip-compressed:
//
//	origin-remote-state 1\n
//	commit <sha>\n
//	tree <sha>\n
//	count <n>\n
//	<mode> <sha> <path>\x00   (n records, in Walk order)
func Encode(w io.Writer, l *Listing) error {
	gz := gzip.NewWriter(w)
	buffered := bufio.NewWriter(gz)

	fmt.Fprintf(buffered, "%s\ncommit %s\ntree %s\ncount %d\n", formatHeader, l.CommitSHA, l.TreeSHA(), l.Len())
	err := l.Walk(func(e Entry) error {
		_, err := fmt.Fprintf(buffered, "%s %s %s\x00", e.Mode, e.SHA, e.Path)
		return err
	})
	if err != nil {
		return err
	}

	if err := buffered.Flush(); err != nil {
		return err
	}
	return gz.Close()
}

type cappedReader struct {
	r         io.Reader
	remaining int64
}

func (c *cappedReader) Read(p []byte) (int, error) {
	if c.remaining <= 0 {
		return 0, errors.New("remote-state listing exceeds the size limit")
	}
	if int64(len(p)) > c.remaining {
		p = p[:c.remaining]
	}
	n, err := c.r.Read(p)
	c.remaining -= int64(n)
	return n, err
}

// Decode reads a listing written by Encode and checks the recorded root tree SHA
// against the entries.
func Decode(r io.Reader) (*Listing, error) {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return nil, fmt.Errorf("remote-state listing: %w", err)
	}
	defer gz.Close()

	reader := bufio.NewReader(&cappedReader{r: gz, remaining: MaxEncodedBytes})

	readLine := func(prefix string) (string, error) {
		line, err := reader.ReadString('\n')
		if err != nil {
			return "", fmt.Errorf("remote-state listing header: %w", err)
		}
		value, ok := strings.CutPrefix(strings.TrimSuffix(line, "\n"), prefix)
		if !ok {
			return "", fmt.Errorf("remote-state listing header: expected %q", prefix)
		}
		return value, nil
	}

	if _, err := readLine(formatHeader); err != nil {
		return nil, err
	}
	commitSHA, err := readLine("commit ")
	if err != nil {
		return nil, err
	}
	treeSHA, err := readLine("tree ")
	if err != nil {
		return nil, err
	}
	countText, err := readLine("count ")
	if err != nil {
		return nil, err
	}
	count, err := strconv.Atoi(countText)
	if err != nil || count < 0 || count > MaxEntries {
		return nil, fmt.Errorf("remote-state listing: invalid count %q", countText)
	}

	l := New()
	l.CommitSHA = commitSHA
	for i := 0; i < count; i++ {
		record, err := reader.ReadString(0)
		if err != nil {
			return nil, fmt.Errorf("remote-state listing record %d: %w", i, err)
		}
		entry, err := parseRecord(strings.TrimSuffix(record, "\x00"))
		if err != nil {
			return nil, fmt.Errorf("remote-state listing record %d: %w", i, err)
		}
		if err := l.Add(entry); err != nil {
			return nil, fmt.Errorf("remote-state listing record %d: %w", i, err)
		}
	}
	if _, err := reader.ReadByte(); err != io.EOF {
		return nil, errors.New("remote-state listing has trailing data")
	}

	rootSHA, err := parseSHA(treeSHA)
	if err != nil {
		return nil, err
	}
	l.root.sha, l.root.hasSHA = rootSHA, true
	if err := l.Verify(); err != nil {
		return nil, err
	}

	return l, nil
}

func parseRecord(record string) (Entry, error) {
	modeText, rest, ok := strings.Cut(record, " ")
	if !ok {
		return Entry{}, errors.New("malformed record")
	}
	shaText, p, ok := strings.Cut(rest, " ")
	if !ok {
		return Entry{}, errors.New("malformed record")
	}

	mode, err := ParseMode(modeText)
	if err != nil {
		return Entry{}, err
	}
	return Entry{Path: p, Mode: mode, SHA: shaText}, nil
}
