package gitpush

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	// DefaultMaxPackBytes keeps each push under the 2 GB pack limits of GitHub and
	// Bitbucket; bigger change sets are split into several commits.
	DefaultMaxPackBytes int64 = 1536 << 20
	// MaxFileBytes is the largest non-LFS blob any of the hosted providers accept.
	MaxFileBytes int64 = 100 << 20

	maxReceiveAdvertisementBytes = 10 << 20
	maxChangesPerPush            = 100_000
)

type Signature struct {
	Name  string
	Email string
}

var DefaultSignature = Signature{Name: "Metorial", Email: "code-bucket@metorial.com"}

// Writer is a commitbatch.CommitWriter that pushes each batch as one commit (parent:
// the batch's base) in a delta-free pack streamed straight from the file source. A
// pushed commit is an atomic snapshot, so a change set that fits the pack cap goes out
// as a single push.
// Pushes are atomic and never forced: if the branch moved, the server rejects the
// update and the batch is re-planned.
type Writer struct {
	*Tracker

	Signature    Signature
	MaxPackBytes int64
	Now          func() time.Time
}

func NewWriter(tracker *Tracker) *Writer {
	return &Writer{Tracker: tracker, Signature: DefaultSignature, MaxPackBytes: DefaultMaxPackBytes, Now: time.Now}
}

func (w *Writer) Limits() commitbatch.BatchLimits {
	maxBytes := w.MaxPackBytes * 4 / 3
	return commitbatch.BatchLimits{
		InitialBytes:       maxBytes,
		MaxBytes:           maxBytes,
		MinBytes:           min(commitbatch.DefaultMinBytes, maxBytes),
		MaxChanges:         maxChangesPerPush,
		MaxInlineFileBytes: w.MaxPackBytes,
		SupportsReferences: true,
		SpanSegments:       true,
	}
}

func (w *Writer) Cost(commitbatch.Batch) int { return 1 }

func (w *Writer) Commit(ctx context.Context, base string, batch commitbatch.Batch) (string, error) {
	head, _, err := w.CommitWithTree(ctx, base, batch)
	return head, err
}

func (w *Writer) CommitWithTree(ctx context.Context, base string, batch commitbatch.Batch) (string, string, error) {
	state, err := w.StateAt(ctx, base)
	if err != nil {
		return "", "", err
	}

	objects := newObjectSet()
	changes := make([]remotestate.Change, len(batch.Changes))
	var packBytes int64
	for i, change := range batch.Changes {
		changes[i] = change.RemoteChange()
		if change.Kind != commitbatch.ChangeAdd {
			continue
		}

		hash, ok := parseHash(change.BlobSHA)
		if !ok || change.Open == nil {
			return "", "", fmt.Errorf("gitpush: add of %s has no content", change.Path)
		}
		if _, seen := objects.objects[hash]; !seen {
			packBytes += change.Size
		}
		objects.add(&lazyBlob{ctx: ctx, hash: hash, path: change.Path, size: change.Size, open: change.Open})
	}
	if packBytes > w.MaxPackBytes {
		return "", "", fmt.Errorf("%w: %d bytes of content in one push", commitbatch.ErrBodyTooLarge, packBytes)
	}

	next, trees, err := state.Apply(changes)
	if err != nil {
		return "", "", err
	}
	for _, tree := range trees {
		objects.addMemory(plumbing.TreeObject, tree.Data)
	}

	commit, err := w.encodeCommit(next.Root, base, batch.Message)
	if err != nil {
		return "", "", err
	}
	next.Commit = objects.addMemory(plumbing.CommitObject, commit).String()

	w.Expect(next, true)
	if err := w.push(ctx, base, next.Commit, objects); err != nil {
		var ambiguous *commitbatch.AmbiguousError
		if !errors.As(err, &ambiguous) {
			w.Expect(nil, false)
		}
		return "", "", err
	}

	w.Confirm(next)
	return next.Commit, next.TreeSHA(), nil
}

func (w *Writer) encodeCommit(tree plumbing.Hash, parent, message string) ([]byte, error) {
	when := w.Now().UTC().Truncate(time.Second)
	signature := object.Signature{Name: w.Signature.Name, Email: w.Signature.Email, When: when}
	commit := &object.Commit{
		Author:       signature,
		Committer:    signature,
		Message:      message,
		TreeHash:     tree,
		ParentHashes: []plumbing.Hash{plumbing.NewHash(parent)},
	}

	encoded := &plumbing.MemoryObject{}
	if err := commit.Encode(encoded); err != nil {
		return nil, err
	}
	reader, err := encoded.Reader()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

func (w *Writer) push(ctx context.Context, base, next string, objects *objectSet) error {
	remote := w.Fetch.Remote()
	ref := "refs/heads/" + w.Fetch.Branch

	adv, err := remote.Discover(ctx, gitremote.ServiceReceivePack, false, maxReceiveAdvertisementBytes)
	if err != nil {
		return err
	}
	current, ok := adv.Refs[ref]
	switch {
	case !ok:
		return commitbatch.ErrBranchMissing
	case current != base:
		return commitbatch.ErrHeadMismatch
	case !adv.Has("report-status"):
		return errors.New("gitpush: git server does not support report-status")
	}

	capabilities := "report-status"
	for _, capability := range []string{"atomic", "quiet"} {
		if adv.Has(capability) {
			capabilities += " " + capability
		}
	}
	capabilities += " agent=metorial-origin"

	var command bytes.Buffer
	if err := encodeCommand(&command, fmt.Sprintf("%s %s %s\x00%s\n", base, next, ref, capabilities)); err != nil {
		return err
	}

	body, bodyWriter := io.Pipe()
	packDone := make(chan error, 1)
	go func() {
		_, err := bodyWriter.Write(command.Bytes())
		if err == nil {
			err = objects.writePack(bodyWriter)
		}
		bodyWriter.CloseWithError(err)
		packDone <- err
	}()

	header := http.Header{}
	header.Set("Content-Type", "application/x-git-receive-pack-request")
	header.Set("Accept", "application/x-git-receive-pack-result")
	resp, err := remote.Do(ctx, http.MethodPost, "/"+gitremote.ServiceReceivePack, body, header)
	body.CloseWithError(errRequestFinished)
	packErr := <-packDone

	var mismatch *manifest.ContentMismatchError
	if errors.As(packErr, &mismatch) {
		if resp != nil {
			resp.Body.Close()
		}
		return mismatch
	}

	if err != nil {
		var httpErr *gitremote.HTTPError
		var rateLimited *commitbatch.RateLimitedError
		switch {
		case errors.As(err, &httpErr) && httpErr.StatusCode == http.StatusRequestEntityTooLarge:
			return fmt.Errorf("%w: %w", commitbatch.ErrBodyTooLarge, err)
		case errors.As(err, &httpErr), errors.As(err, &rateLimited):
			return err
		case errors.Is(err, gitremote.ErrUnauthorized), errors.Is(err, gitremote.ErrRepositoryNotFound), errors.Is(err, gitremote.ErrRedirect):
			return err
		case ctx.Err() != nil:
			return &commitbatch.AmbiguousError{Err: ctx.Err()}
		case packErr != nil && !isPipeClosed(packErr):
			return packErr
		}
		return &commitbatch.AmbiguousError{Err: err}
	}
	defer resp.Body.Close()

	if packErr != nil {
		return packErr
	}

	if err := parseReportStatus(resp.Body, ref); err != nil {
		var rejected *RejectedError
		switch {
		case errors.As(err, &rejected) && rejected.NonFastForward() && w.headMoved(ctx, remote, ref, base):
			return fmt.Errorf("%w: %w", commitbatch.ErrHeadMismatch, err)
		case errors.Is(err, gitremote.ErrProtocol):
			return &commitbatch.AmbiguousError{Err: err}
		}
		return err
	}
	return nil
}

// headMoved double-checks a rejection that reads like a lost race, so a server that
// keeps refusing the update for another reason can't make the batcher replan forever.
func (w *Writer) headMoved(ctx context.Context, remote gitremote.Remote, ref, base string) bool {
	adv, err := remote.Discover(ctx, gitremote.ServiceReceivePack, false, maxReceiveAdvertisementBytes)
	return err == nil && adv.Refs[ref] != base
}

func encodeCommand(w *bytes.Buffer, line string) error {
	if len(line)+4 > 65520 {
		return errors.New("gitpush: ref update command too long")
	}
	fmt.Fprintf(w, "%04x%s0000", len(line)+4, line)
	return nil
}

var errRequestFinished = errors.New("gitpush: request finished")

func isPipeClosed(err error) bool {
	return errors.Is(err, io.ErrClosedPipe) || errors.Is(err, errRequestFinished)
}

func parseHash(s string) (plumbing.Hash, bool) {
	if len(s) != 40 {
		return plumbing.ZeroHash, false
	}
	hash := plumbing.NewHash(s)
	return hash, hash.String() == s
}
