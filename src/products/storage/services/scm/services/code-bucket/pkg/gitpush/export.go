package gitpush

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
)

// HTTPClient has no overall timeout, because a push streams up to MaxPackBytes in one
// request; it bounds connection setup and the wait for response headers instead.
var HTTPClient = func() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = 10 * time.Minute
	transport.TLSHandshakeTimeout = 30 * time.Second
	return &http.Client{Transport: transport}
}()

type ExportOptions struct {
	// Fetch addresses the repository (URL, Branch, AuthHeader, HTTPClient) for both
	// the remote-state fetch and the push.
	Fetch   gitremote.FetchOptions
	Options export.ManifestOptions

	CommitMessage string
	LFS           commitbatch.LFSUploader
	// LFSThresholdBytes is the project's threshold; files over MaxFileBytes go through
	// LFS regardless.
	LFSThresholdBytes int64
	MaxLFSFileBytes   int64

	Signature    Signature
	MaxPackBytes int64
	Now          func() time.Time
	Sleep        func(ctx context.Context, d time.Duration) error
	Logf         func(format string, args ...any)
}

func EffectiveLFSThreshold(threshold, maxFileBytes int64) int64 {
	return export.EffectiveLFSThreshold(threshold, maxFileBytes)
}

// Export runs a manifest export over git smart HTTP: blobless fetch for the remote
// state, packfile push for the writes.
func Export(ctx context.Context, opts ExportOptions) (*export.Result, error) {
	client, requests := CountRequests(opts.Fetch.HTTPClient)
	opts.Fetch.HTTPClient = client

	tracker := NewTracker(opts.Fetch)
	if opts.Logf != nil {
		tracker.Logf = opts.Logf
	}
	options := tracker.SeedFromCache(ctx, opts.Options)

	writer := NewWriter(tracker)
	if opts.Signature != (Signature{}) {
		writer.Signature = opts.Signature
	}
	if opts.MaxPackBytes > 0 {
		writer.MaxPackBytes = opts.MaxPackBytes
	}
	if opts.Now != nil {
		writer.Now = opts.Now
	}

	return export.Sync(ctx, export.SyncInput{
		Options:           options,
		Writer:            writer,
		Remote:            tracker,
		LFS:               opts.LFS,
		CommitMessage:     opts.CommitMessage,
		LFSThresholdBytes: EffectiveLFSThreshold(opts.LFSThresholdBytes, MaxFileBytes),
		MaxFileBytes:      MaxFileBytes,
		MaxLFSFileBytes:   opts.MaxLFSFileBytes,
		ReadBlob:          tracker.ReadBlob,
		Requests:          requests,
		Now:               opts.Now,
		Sleep:             opts.Sleep,
		Logf:              opts.Logf,
	})
}

// CountRequests wraps client (nil: http.DefaultClient's transport) so every request
// it sends is counted.
func CountRequests(client *http.Client) (*http.Client, func() uint32) {
	counted := &http.Client{}
	if client != nil {
		*counted = *client
	}
	transport := counted.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}

	counter := &countingTransport{next: transport}
	counted.Transport = counter
	return counted, counter.count.Load
}

type countingTransport struct {
	next  http.RoundTripper
	count atomic.Uint32
}

func (t *countingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.count.Add(1)
	return t.next.RoundTrip(req)
}
