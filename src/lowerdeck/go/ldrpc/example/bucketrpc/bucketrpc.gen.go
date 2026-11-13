// Hand-written to the shape @lowerdeck/rpc-spec's Go generator will emit (see PLAN.md), so
// the runtime API is exercised by real generated-style code. Not produced by a generator yet.

package bucketrpc

import (
	"context"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
)

type BucketStatus string

const (
	BucketStatusActive   BucketStatus = "active"
	BucketStatusArchived BucketStatus = "archived"
)

type Bucket struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Status     BucketStatus      `json:"status"`
	SizeBytes  int64             `json:"sizeBytes"`
	Labels     map[string]string `json:"labels"`
	CreatedAt  time.Time         `json:"createdAt"`
	ArchivedAt *time.Time        `json:"archivedAt"`
}

type BucketGetInput struct {
	BucketID string `json:"bucketId"`
}

func (x *BucketGetInput) Validate() error {
	var issues ldrpc.ValidationErrors
	if x.BucketID == "" {
		issues = append(issues, ldrpc.ValidationIssue{Code: "required", Message: "bucketId is required", Path: []string{"bucketId"}})
	}
	if len(issues) > 0 {
		return issues
	}
	return nil
}

type BucketListInput struct {
	Status *BucketStatus `json:"status,omitempty"`
	Cursor *string       `json:"cursor,omitempty"`
}

type BucketListOutput struct {
	Items      []Bucket `json:"items"`
	NextCursor *string  `json:"nextCursor,omitempty"`
}

type PingInput struct{}

type PingOutput struct {
	Ok bool `json:"ok"`
}

func ErrBucketArchived(bucketID string) *ldrpc.Error {
	return ldrpc.NewError(409, "bucket_archived", "The bucket is archived.").With("bucketId", bucketID)
}

type Service interface {
	BucketGet(ctx context.Context, in *BucketGetInput) (*Bucket, error)
	BucketList(ctx context.Context, in *BucketListInput) (*BucketListOutput, error)
	Ping(ctx context.Context, in *PingInput) (*PingOutput, error)
}

func Register(srv *ldrpc.Server, impl Service) {
	srv.Handle("bucket:get", ldrpc.Unary(impl.BucketGet))
	srv.Handle("bucket:list", ldrpc.Unary(impl.BucketList))
	srv.Handle("ping", ldrpc.Unary(impl.Ping))
}

type Client struct {
	rpc *ldrpc.Client
}

func NewClient(endpoint string, opts ldrpc.ClientOptions) (*Client, error) {
	rpc, err := ldrpc.NewClient(endpoint, opts)
	if err != nil {
		return nil, err
	}
	return &Client{rpc: rpc}, nil
}

func (c *Client) BucketGet(ctx context.Context, in *BucketGetInput, opts ...ldrpc.CallOption) (*Bucket, error) {
	return ldrpc.Call[Bucket](ctx, c.rpc, "bucket:get", in, opts...)
}

func (c *Client) BucketList(ctx context.Context, in *BucketListInput, opts ...ldrpc.CallOption) (*BucketListOutput, error) {
	return ldrpc.Call[BucketListOutput](ctx, c.rpc, "bucket:list", in, opts...)
}

func (c *Client) Ping(ctx context.Context, in *PingInput, opts ...ldrpc.CallOption) (*PingOutput, error) {
	return ldrpc.Call[PingOutput](ctx, c.rpc, "ping", in, opts...)
}
