// Interop fixture: the generated bucketrpc server, driven by interop/generated.test.ts through
// the generated TypeScript client.
package main

import (
	"bytes"
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/example/bucketrpc"
)

type service struct{}

func bucket(id string) *bucketrpc.Bucket {
	return &bucketrpc.Bucket{
		ID:        id,
		Name:      "Bucket " + id,
		Status:    bucketrpc.BucketStatusActive,
		SizeBytes: 42,
		Labels:    map[string]string{"env": "test"},
		CreatedAt: time.UnixMilli(1_700_000_000_123),
	}
}

func (service) Ping(ctx context.Context, in *ldrpc.Void) (*bucketrpc.PingOutput, error) {
	return &bucketrpc.PingOutput{Ok: true}, nil
}

func (service) BucketGet(ctx context.Context, in *bucketrpc.BucketGetInput) (*bucketrpc.Bucket, error) {
	switch in.BucketID {
	case "archived":
		return nil, bucketrpc.ErrBucketArchived(in.BucketID)
	case "missing":
		return nil, ldrpc.NotFoundError("bucket", in.BucketID)
	}
	return bucket(in.BucketID), nil
}

func (service) BucketList(ctx context.Context, in *bucketrpc.BucketListInput) (*bucketrpc.BucketListOutput, error) {
	archivedAt := time.UnixMilli(1_700_000_000_456)
	second := bucket("b")
	second.Status, second.ArchivedAt = bucketrpc.BucketStatusArchived, &archivedAt

	out := &bucketrpc.BucketListOutput{Items: []bucketrpc.Bucket{*bucket("a"), *second}}
	if in.Limit != nil {
		cursor := fmt.Sprintf("after-%d", *in.Limit)
		out.NextCursor = &cursor
	}
	return out, nil
}

func (service) BucketArchive(ctx context.Context, in *bucketrpc.BucketArchiveInput) (*bucketrpc.Bucket, error) {
	archivedAt := time.UnixMilli(1_700_000_000_789)
	b := bucket(in.BucketID)
	b.Status, b.ArchivedAt = bucketrpc.BucketStatusArchived, &archivedAt
	return b, nil
}

func (service) BucketDelete(ctx context.Context, in *bucketrpc.BucketDeleteInput) (*ldrpc.Void, error) {
	return nil, nil
}

func (service) BucketFilesTree(ctx context.Context, in *bucketrpc.BucketFilesTreeInput) (*bucketrpc.BucketFilesTreeOutput, error) {
	return &bucketrpc.BucketFilesTreeOutput{Root: bucketrpc.FileEntry{Variant: &bucketrpc.FileEntryDirectory{
		Path: "/",
		Children: []bucketrpc.FileEntry{
			{Variant: &bucketrpc.FileEntryFile{Path: "/index.ts", Size: 12}},
			{Variant: &bucketrpc.FileEntryDirectory{Path: "/lib"}},
		},
	}}}, nil
}

func (service) BucketFilesPut(ctx context.Context, in *bucketrpc.BucketFilesPutInput) (*bucketrpc.BucketFilesPutOutput, error) {
	if !bytes.Equal(in.Content, []byte("hello")) || string(in.Metadata) != `{"a":[1,true]}` {
		return nil, ldrpc.BadRequestError().WithMessage(fmt.Sprintf("unexpected content %q metadata %s", in.Content, in.Metadata))
	}
	return &bucketrpc.BucketFilesPutOutput{
		Entry:   bucketrpc.FileEntry{Variant: &bucketrpc.FileEntryFile{Path: in.Path, Size: int64(len(in.Content))}},
		Version: 2.5,
	}, nil
}

func main() {
	srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc"})
	bucketrpc.Register(srv, service{})

	mux := http.NewServeMux()
	srv.Mount(mux)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	fmt.Printf("listening http://%s\n", listener.Addr())

	if err := http.Serve(listener, mux); err != nil {
		panic(err)
	}
}
