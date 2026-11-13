package bucketrpc_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/example/bucketrpc"
)

type service struct{}

func (service) BucketGet(ctx context.Context, in *bucketrpc.BucketGetInput) (*bucketrpc.Bucket, error) {
	if in.BucketID == "archived" {
		return nil, bucketrpc.ErrBucketArchived(in.BucketID)
	}
	return &bucketrpc.Bucket{ID: in.BucketID, Status: bucketrpc.BucketStatusActive, CreatedAt: time.UnixMilli(1)}, nil
}

func (service) BucketList(ctx context.Context, in *bucketrpc.BucketListInput) (*bucketrpc.BucketListOutput, error) {
	return &bucketrpc.BucketListOutput{Items: []bucketrpc.Bucket{{ID: "a"}, {ID: "b"}}}, nil
}

func (service) Ping(ctx context.Context, in *bucketrpc.PingInput) (*bucketrpc.PingOutput, error) {
	return &bucketrpc.PingOutput{Ok: true}, nil
}

func TestGeneratedShape(t *testing.T) {
	srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc"})
	bucketrpc.Register(srv, service{})

	mux := http.NewServeMux()
	srv.Mount(mux)
	hs := httptest.NewServer(mux)
	defer hs.Close()

	client, err := bucketrpc.NewClient(hs.URL+"/rpc", ldrpc.ClientOptions{})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	b, err := client.BucketGet(ctx, &bucketrpc.BucketGetInput{BucketID: "bkt_1"})
	if err != nil || b.ID != "bkt_1" || !b.CreatedAt.Equal(time.UnixMilli(1)) {
		t.Fatalf("get: %v %+v", err, b)
	}

	_, err = client.BucketGet(ctx, &bucketrpc.BucketGetInput{BucketID: "archived"})
	if e, ok := ldrpc.AsError(err); !ok || e.Code != "bucket_archived" || e.Extra["bucketId"] != "archived" {
		t.Fatalf("archived: %#v", err)
	}

	list, err := client.BucketList(ctx, &bucketrpc.BucketListInput{})
	if err != nil || len(list.Items) != 2 {
		t.Fatalf("list: %v %+v", err, list)
	}

	pong, err := client.Ping(ctx, &bucketrpc.PingInput{})
	if err != nil || !pong.Ok {
		t.Fatalf("ping: %v %+v", err, pong)
	}
}
