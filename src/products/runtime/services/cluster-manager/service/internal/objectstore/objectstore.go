package objectstore

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"

	objectstorage "github.com/metorial/object-storage/clients/go"
)

var ErrNotFound = errors.New("object not found")

type Object struct {
	Body io.ReadCloser
	Size int64
}

type Info struct {
	Size     int64
	Metadata map[string]string
}

func (i *Info) Meta(key string) string {
	for k, v := range i.Metadata {
		if strings.EqualFold(k, key) {
			return v
		}
	}
	return ""
}

type Store interface {
	Get(ctx context.Context, bucket, key string) (*Object, error)
	Put(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string, metadata map[string]string) error
	Head(ctx context.Context, bucket, key string) (*Info, error)
	EnsureBucket(ctx context.Context, bucket string) error
}

// Client streams to and from Metorial's object-storage service. Bodies are never buffered, and
// the HTTP client has no overall timeout so large transfers are bounded by their context only.
type Client struct {
	c *objectstorage.Client
}

func New(baseURL string) *Client {
	return &Client{c: objectstorage.NewClientWithHTTP(strings.TrimSuffix(baseURL, "/"), &http.Client{})}
}

func notFound(err error) error {
	var e *objectstorage.Error
	if errors.As(err, &e) && e.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	return err
}

func (c *Client) Get(ctx context.Context, bucket, key string) (*Object, error) {
	stream, err := c.c.GetObjectStream(ctx, bucket, key)
	if err != nil {
		return nil, notFound(err)
	}
	size := int64(-1)
	if stream.Metadata.Size > 0 {
		size = int64(stream.Metadata.Size)
	}
	return &Object{Body: stream.Body, Size: size}, nil
}

func (c *Client) Put(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string, metadata map[string]string) error {
	var ct *string
	if contentType != "" {
		ct = &contentType
	}
	_, err := c.c.PutObjectFromReader(ctx, bucket, key, body, size, ct, metadata)
	return err
}

func (c *Client) Head(ctx context.Context, bucket, key string) (*Info, error) {
	meta, err := c.c.HeadObject(bucket, key)
	if err != nil {
		return nil, notFound(err)
	}
	return &Info{Size: int64(meta.Size), Metadata: meta.Metadata}, nil
}

func (c *Client) EnsureBucket(ctx context.Context, bucket string) error {
	_, err := c.c.UpsertBucket(bucket)
	return err
}
