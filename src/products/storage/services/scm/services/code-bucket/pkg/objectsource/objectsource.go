// Package objectsource reads manifests and their content objects from object storage,
// restricted to an allowlist of buckets, and stores remote-state listings.
package objectsource

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
	objectstorage "github.com/metorial/object-storage/clients/go"
)

var ErrBucketNotAllowed = errors.New("bucket is not an allowed manifest source")

type ObjectClient interface {
	GetObjectStream(ctx context.Context, bucket, key string) (*objectstorage.ObjectStream, error)
	PutObjectFromReader(
		ctx context.Context,
		bucket, key string,
		body io.Reader,
		size int64,
		contentType *string,
		metadata map[string]string,
	) (*objectstorage.ObjectMetadata, error)
}

func open(ctx context.Context, client ObjectClient, bucket, key string) (io.ReadCloser, error) {
	stream, err := client.GetObjectStream(ctx, bucket, key)
	if err != nil {
		var storageErr *objectstorage.Error
		if errors.As(err, &storageErr) && storageErr.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("%w: %s/%s", manifest.ErrObjectNotFound, bucket, key)
		}
		return nil, err
	}

	return stream.Body, nil
}

// Reader implements manifest.Storage for allowlisted buckets only.
type Reader struct {
	client  ObjectClient
	allowed map[string]bool
}

func New(client ObjectClient, allowedBuckets []string) *Reader {
	allowed := make(map[string]bool, len(allowedBuckets))
	for _, bucket := range allowedBuckets {
		if bucket != "" {
			allowed[bucket] = true
		}
	}

	return &Reader{client: client, allowed: allowed}
}

func (r *Reader) AllowBucket(bucket string) bool {
	return r.allowed[bucket]
}

func (r *Reader) OpenObject(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	if !r.AllowBucket(bucket) {
		return nil, fmt.Errorf("%w: %q", ErrBucketNotAllowed, bucket)
	}

	return open(ctx, r.client, bucket, key)
}

// ListingStore keeps remote-state listings in Origin's own bucket.
type ListingStore struct {
	client ObjectClient
	bucket string
}

func NewListingStore(client ObjectClient, bucket string) *ListingStore {
	return &ListingStore{client: client, bucket: bucket}
}

func (s *ListingStore) Load(ctx context.Context, ref export.RemoteState) (*remotestate.Listing, error) {
	if ref.ListingBucket != s.bucket {
		return nil, fmt.Errorf("remote-state listing bucket %q is not %q", ref.ListingBucket, s.bucket)
	}

	body, err := open(ctx, s.client, s.bucket, ref.ListingKey)
	if err != nil {
		return nil, err
	}
	defer body.Close()

	listing, err := remotestate.Decode(body)
	if err != nil {
		return nil, err
	}
	if listing.TreeSHA() != ref.TreeSHA || listing.CommitSHA != ref.CommitSHA {
		return nil, fmt.Errorf("remote-state listing %s doesn't match commit %s tree %s", ref.ListingKey, ref.CommitSHA, ref.TreeSHA)
	}

	return listing, nil
}

func (s *ListingStore) Save(ctx context.Context, keyPrefix string, listing *remotestate.Listing) (*export.RemoteState, error) {
	var buf bytes.Buffer
	if err := remotestate.Encode(&buf, listing); err != nil {
		return nil, err
	}

	treeSHA := listing.TreeSHA()
	key := remotestate.ObjectKey(keyPrefix, treeSHA)
	contentType := "application/gzip"
	if _, err := s.client.PutObjectFromReader(ctx, s.bucket, key, &buf, int64(buf.Len()), &contentType, nil); err != nil {
		return nil, err
	}

	return &export.RemoteState{
		CommitSHA:     listing.CommitSHA,
		TreeSHA:       treeSHA,
		ListingBucket: s.bucket,
		ListingKey:    key,
		EntryCount:    uint32(listing.Len()),
	}, nil
}
