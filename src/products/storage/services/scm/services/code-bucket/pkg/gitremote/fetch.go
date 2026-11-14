package gitremote

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	DefaultTimeout     = 10 * time.Minute
	maxPreambleBytes   = 16 << 20
	maxLsRefsResponse  = 10 << 20
	defaultObjectBytes = 64 << 20
)

// Client implements Fetcher over smart HTTP.
type Client struct{}

var _ Fetcher = Client{}

func (o FetchOptions) withDefaults() FetchOptions {
	if o.MaxAdvertisementBytes <= 0 {
		o.MaxAdvertisementBytes = DefaultMaxAdvertisementBytes
	}
	if o.MaxPackBytes <= 0 {
		o.MaxPackBytes = DefaultMaxPackBytes
	}
	if o.MaxIncrementalPackBytes <= 0 {
		o.MaxIncrementalPackBytes = DefaultMaxIncrementalPackBytes
	}
	if o.MaxObjects <= 0 {
		o.MaxObjects = DefaultMaxObjects
	}
	if o.MaxObjectBytes <= 0 {
		o.MaxObjectBytes = defaultObjectBytes
	}
	if o.MaxInflatedBytes <= 0 {
		o.MaxInflatedBytes = 16 * o.MaxPackBytes
	}
	if o.MaxEntries <= 0 {
		o.MaxEntries = remotestate.MaxEntries
	}
	if o.Timeout <= 0 {
		o.Timeout = DefaultTimeout
	}
	return o
}

func (o FetchOptions) Remote() Remote {
	return Remote{URL: o.URL, AuthHeader: o.AuthHeader, HTTPClient: o.HTTPClient, AllowHTTP: o.AllowHTTP}
}

// FetchRemoteState resolves the branch head and returns the listing of its tree.
// When the head is Have[0] the Base listing is returned without a fetch; otherwise
// the fetch advertises Have so the server only sends trees that changed, and the
// listing is completed from Base. If that fails the fetch is repeated without Have.
func (c Client) FetchRemoteState(ctx context.Context, opts FetchOptions) (*remotestate.Listing, string, string, error) {
	opts = opts.withDefaults()

	var base *State
	if opts.Base != nil && len(opts.Have) > 0 {
		if opts.Have[0] == opts.Base.CommitSHA || opts.Base.CommitSHA == "" {
			if state, err := StateFromListing(opts.Base); err == nil {
				state.Commit = opts.Have[0]
				base = state
			}
		}
	}

	state, err := c.Fetch(ctx, opts, base)
	if err != nil {
		return nil, "", "", err
	}
	if base != nil && state == base {
		opts.Base.CommitSHA = state.Commit
		return opts.Base, state.Commit, opts.Base.TreeSHA(), nil
	}

	listing, err := state.Listing(opts.MaxEntries)
	if err != nil {
		return nil, "", "", err
	}
	return listing, state.Commit, state.TreeSHA(), nil
}

// Fetch returns the state at the branch head. base, when given, is returned as is if
// the head hasn't moved, and otherwise seeds an incremental fetch.
func (Client) Fetch(ctx context.Context, opts FetchOptions, base *State) (*State, error) {
	opts = opts.withDefaults()
	ctx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	session, err := openSession(ctx, opts)
	if err != nil {
		return nil, err
	}
	head, err := session.resolveBranch(ctx, opts.Branch)
	if err != nil {
		return nil, err
	}
	return session.fetchHead(ctx, head, base)
}

// FetchCommit returns the state at a known commit, which must be reachable on the
// server, without resolving any ref.
func (Client) FetchCommit(ctx context.Context, opts FetchOptions, commit string, base *State) (*State, error) {
	opts = opts.withDefaults()
	if !isSHA(commit) {
		return nil, errors.New("gitremote: invalid commit SHA")
	}
	ctx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	session, err := openSession(ctx, opts)
	if err != nil {
		return nil, err
	}
	return session.fetchHead(ctx, commit, base)
}

func (s *session) fetchHead(ctx context.Context, head string, base *State) (*State, error) {
	if base != nil && base.Commit == head {
		return base, nil
	}

	if base != nil && isSHA(base.Commit) {
		state, err := s.fetchState(ctx, head, base)
		if err == nil {
			return state, nil
		}
		if !errors.Is(err, ErrIncomplete) && !errors.Is(err, ErrTooLarge) && !errors.Is(err, ErrProtocol) {
			return nil, err
		}
	}
	return s.fetchState(ctx, head, nil)
}

// ResolveBranch returns the branch's head commit without fetching anything.
func (Client) ResolveBranch(ctx context.Context, opts FetchOptions) (string, error) {
	opts = opts.withDefaults()
	ctx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	session, err := openSession(ctx, opts)
	if err != nil {
		return "", err
	}
	return session.resolveBranch(ctx, opts.Branch)
}

var ErrIncomplete = errors.New("gitremote: fetched objects don't cover the tree")

type session struct {
	opts   FetchOptions
	remote Remote
	adv    *Advertisement
}

func openSession(ctx context.Context, opts FetchOptions) (*session, error) {
	if !validBranch(opts.Branch) {
		return nil, errors.New("gitremote: invalid branch name")
	}

	remote := opts.Remote()
	adv, err := remote.Discover(ctx, ServiceUploadPack, !opts.DisableProtocolV2, opts.MaxAdvertisementBytes)
	if err != nil {
		return nil, err
	}
	return &session{opts: opts, remote: remote, adv: adv}, nil
}

func validBranch(branch string) bool {
	return branch != "" && !strings.HasPrefix(branch, "-") && !strings.Contains(branch, "..") &&
		!strings.ContainsAny(branch, " ~^:?*[\\\x00\n\r\t\x7f") && !strings.HasSuffix(branch, "/") &&
		!strings.HasSuffix(branch, ".lock") && !strings.Contains(branch, "//") && !strings.HasPrefix(branch, "/")
}

func (s *session) resolveBranch(ctx context.Context, branch string) (string, error) {
	ref := "refs/heads/" + branch

	if s.adv.Version != 2 {
		sha, ok := s.adv.Refs[ref]
		if !ok {
			return "", ErrBranchMissing
		}
		return sha, nil
	}

	var body bytes.Buffer
	encodePacket(&body, "command=ls-refs\n")
	encodePacket(&body, "agent=%s\n", agentName)
	body.Write(delimPacket)
	encodePacket(&body, "ref-prefix %s\n", ref)
	body.Write(flushPacket)

	resp, err := s.post(ctx, &body, true)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	refs, err := parseLsRefs(newLimitedBody(resp.Body, maxLsRefsResponse, ErrTooLarge))
	if err != nil {
		return "", err
	}
	sha, ok := refs[ref]
	if !ok {
		return "", ErrBranchMissing
	}
	return sha, nil
}

const agentName = "metorial-origin"

func parseLsRefs(r io.Reader) (map[string]string, error) {
	packets := newPacketReader(r)
	refs := map[string]string{}

	for {
		kind, payload, err := packets.next()
		if err != nil {
			return nil, err
		}
		switch kind {
		case packetFlush, packetResponseEnd:
			return refs, nil
		case packetDelim:
			return nil, fmt.Errorf("%w: unexpected delim in ls-refs", ErrProtocol)
		}

		sha, name, err := parseRefLine(trimLF(payload))
		if err != nil {
			return nil, err
		}
		if len(refs) >= maxRefs {
			return nil, fmt.Errorf("%w: too many refs", ErrTooLarge)
		}
		refs[name] = sha
	}
}

func (s *session) post(ctx context.Context, body io.Reader, v2 bool) (*http.Response, error) {
	header := http.Header{}
	header.Set("Content-Type", "application/x-git-upload-pack-request")
	header.Set("Accept", "application/x-git-upload-pack-result")
	if v2 {
		header.Set("Git-Protocol", "version=2")
	}
	return s.remote.Do(ctx, http.MethodPost, "/"+ServiceUploadPack, body, header)
}

func (s *session) filterSupported() bool {
	if s.adv.Version == 2 {
		return s.adv.V2Feature("fetch", "filter")
	}
	return s.adv.Has("filter")
}

func (s *session) shallowSupported() bool {
	if s.adv.Version == 2 {
		return s.adv.V2Feature("fetch", "shallow")
	}
	return s.adv.Has("shallow")
}

func (s *session) fetchState(ctx context.Context, head string, base *State) (*State, error) {
	filter := s.filterSupported()
	if !filter && !s.opts.AllowUnfiltered {
		return nil, ErrFilterUnsupported
	}

	var have []string
	maxPack := s.opts.MaxPackBytes
	if base != nil {
		have = []string{base.Commit}
		maxPack = min(maxPack, s.opts.MaxIncrementalPackBytes)
	}

	store, err := s.fetchObjects(ctx, s.fetchRequest(head, have, filter), maxPack, s.opts.packLimits())
	if err != nil {
		return nil, err
	}
	return buildState(store, head, base)
}

func (s *session) fetchObjects(ctx context.Context, request []byte, maxPack int64, limits packLimits) (objectStore, error) {
	resp, err := s.post(ctx, bytes.NewReader(request), s.adv.Version == 2)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	packFile, err := os.CreateTemp("", "gitremote-*.pack")
	if err != nil {
		return nil, err
	}
	defer func() {
		packFile.Close()
		os.Remove(packFile.Name())
	}()

	if err := s.readPack(bufio.NewReaderSize(resp.Body, 64<<10), packFile, maxPack); err != nil {
		return nil, err
	}
	if _, err := packFile.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	return readPackObjects(ctx, packFile, limits)
}

func (o FetchOptions) packLimits() packLimits {
	return packLimits{
		MaxObjects:       o.MaxObjects,
		MaxObjectBytes:   o.MaxObjectBytes,
		MaxInflatedBytes: o.MaxInflatedBytes,
	}
}

// fetchRequest asks for head's commit and trees. A full fetch uses "deepen 1". An
// incremental fetch must not deepen, since upload-pack ignores haves when deepening;
// it declares the cached commit as both shallow and had, so the server sends the
// commits and trees since then.
func (s *session) fetchRequest(head string, have []string, filter bool) []byte {
	var body bytes.Buffer
	shallow := s.shallowSupported()
	deepen := shallow && len(have) == 0

	var haves []string
	for _, sha := range have {
		if isSHA(sha) {
			haves = append(haves, sha)
		}
	}

	if s.adv.Version == 2 {
		encodePacket(&body, "command=fetch\n")
		encodePacket(&body, "agent=%s\n", agentName)
		body.Write(delimPacket)
		encodePacket(&body, "no-progress\n")
		encodePacket(&body, "ofs-delta\n")
		if shallow {
			for _, sha := range haves {
				encodePacket(&body, "shallow %s\n", sha)
			}
		}
		if deepen {
			encodePacket(&body, "deepen 1\n")
		}
		if filter {
			encodePacket(&body, "filter blob:none\n")
		}
		encodePacket(&body, "want %s\n", head)
		for _, sha := range haves {
			encodePacket(&body, "have %s\n", sha)
		}
		encodePacket(&body, "done\n")
		body.Write(flushPacket)
		return body.Bytes()
	}

	caps := []string{"ofs-delta", "no-progress", "agent=" + agentName}
	if s.adv.Has("side-band-64k") {
		caps = append(caps, "side-band-64k")
	}
	if shallow {
		caps = append(caps, "shallow")
	}
	if filter {
		caps = append(caps, "filter")
	}

	encodePacket(&body, "want %s %s\n", head, strings.Join(caps, " "))
	if shallow {
		for _, sha := range haves {
			encodePacket(&body, "shallow %s\n", sha)
		}
	}
	if deepen {
		encodePacket(&body, "deepen 1\n")
	}
	if filter {
		encodePacket(&body, "filter blob:none\n")
	}
	body.Write(flushPacket)
	for _, sha := range haves {
		encodePacket(&body, "have %s\n", sha)
	}
	encodePacket(&body, "done\n")
	return body.Bytes()
}

// readPack copies the packfile from an upload-pack response into w, skipping the
// shallow-info and acknowledgment sections.
func (s *session) readPack(r *bufio.Reader, w io.Writer, maxPack int64) error {
	packets := newPacketReader(r)
	limited := &cappedWriter{w: w, remaining: maxPack}
	preamble := 0

	if s.adv.Version == 2 {
		for {
			kind, payload, err := packets.next()
			if err != nil {
				return err
			}
			if kind != packetData {
				continue
			}
			if string(trimLF(payload)) == "packfile" {
				break
			}
			preamble += len(payload)
			if preamble > maxPreambleBytes {
				return fmt.Errorf("%w: fetch response preamble", ErrTooLarge)
			}
		}
		return copyPack(limited, &sidebandReader{packets: packets})
	}

	for {
		if packets.peekPack() {
			return copyPack(limited, r)
		}

		kind, payload, err := packets.next()
		if err != nil {
			return err
		}
		if kind != packetData {
			continue
		}
		if len(payload) > 0 && payload[0] <= 3 {
			sideband := &sidebandReader{packets: packets}
			switch payload[0] {
			case 1:
				sideband.pending = append([]byte(nil), payload[1:]...)
			case 3:
				return &RemoteError{Message: strings.TrimSpace(printable(payload[1:]))}
			}
			return copyPack(limited, sideband)
		}

		preamble += len(payload)
		if preamble > maxPreambleBytes {
			return fmt.Errorf("%w: fetch response preamble", ErrTooLarge)
		}
	}
}

func copyPack(w *cappedWriter, r io.Reader) error {
	n, err := io.Copy(w, r)
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("%w: empty packfile", ErrProtocol)
	}
	return nil
}

type cappedWriter struct {
	w         io.Writer
	remaining int64
}

func (c *cappedWriter) Write(p []byte) (int, error) {
	if int64(len(p)) > c.remaining {
		return 0, fmt.Errorf("%w: packfile exceeds the size limit", ErrTooLarge)
	}
	c.remaining -= int64(len(p))
	return c.w.Write(p)
}

// ReadBlob fetches a single blob by SHA, e.g. an existing .gitattributes. The server
// must allow wanting reachable objects by SHA, which every server offering partial
// clone does.
func (Client) ReadBlob(ctx context.Context, opts FetchOptions, sha string, maxBytes int64) ([]byte, error) {
	opts = opts.withDefaults()
	if !isSHA(sha) {
		return nil, errors.New("gitremote: invalid blob SHA")
	}
	ctx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	session, err := openSession(ctx, opts)
	if err != nil {
		return nil, err
	}

	var body bytes.Buffer
	if session.adv.Version == 2 {
		encodePacket(&body, "command=fetch\n")
		encodePacket(&body, "agent=%s\n", agentName)
		body.Write(delimPacket)
		encodePacket(&body, "no-progress\n")
		encodePacket(&body, "want %s\n", sha)
		encodePacket(&body, "done\n")
		body.Write(flushPacket)
	} else {
		caps := []string{"no-progress", "agent=" + agentName}
		if session.adv.Has("side-band-64k") {
			caps = append(caps, "side-band-64k")
		}
		encodePacket(&body, "want %s %s\n", sha, strings.Join(caps, " "))
		body.Write(flushPacket)
		encodePacket(&body, "done\n")
	}

	limits := packLimits{KeepBlobs: true, MaxObjects: 16, MaxObjectBytes: maxBytes, MaxInflatedBytes: maxBytes * 2}
	store, err := session.fetchObjects(ctx, body.Bytes(), maxBytes+(64<<10), limits)
	if err != nil {
		return nil, err
	}
	object, ok := store[plumbing.NewHash(sha)]
	if !ok || object.typ != plumbing.BlobObject {
		return nil, fmt.Errorf("%w: blob %s is not in the pack", ErrIncomplete, sha)
	}
	return object.data, nil
}
