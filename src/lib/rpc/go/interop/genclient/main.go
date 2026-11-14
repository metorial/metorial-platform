// Interop fixture: drives a TypeScript @lowerdeck/rpc-server built from the bucket spec's IR
// (started by interop/generated.test.ts) with the generated bucketrpc client.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/lib/rpc/go/example/bucketrpc"
)

func check(cond bool, format string, args ...any) {
	if !cond {
		fmt.Fprintf(os.Stderr, "FAIL: "+format+"\n", args...)
		os.Exit(1)
	}
}

func main() {
	ctx := context.Background()
	client, err := bucketrpc.NewClient(os.Args[1]+"/rpc", ldrpc.ClientOptions{MaxAttempts: 1})
	check(err == nil, "new client: %v", err)

	pong, err := client.Ping(ctx, nil)
	check(err == nil && pong.Ok, "ping: %v %+v", err, pong)

	b, err := client.BucketGet(ctx, &bucketrpc.BucketGetInput{BucketID: "bkt_1"})
	check(err == nil, "get: %v", err)
	check(b.ID == "bkt_1" && b.Status == bucketrpc.BucketStatusActive && b.CreatedAt.Equal(time.UnixMilli(1_700_000_000_123)), "get result: %+v", b)
	check(b.ArchivedAt == nil && b.Labels["env"] == "test", "get nullable/record: %+v", b)

	_, err = client.BucketGet(ctx, &bucketrpc.BucketGetInput{BucketID: "archived"})
	rpcErr, ok := ldrpc.AsError(err)
	check(ok && ldrpc.IsCode(err, bucketrpc.CodeBucketArchived) && rpcErr.Status == 409 && rpcErr.Extra["bucketId"] == "archived", "archived: %#v", err)

	_, err = client.BucketGet(ctx, &bucketrpc.BucketGetInput{})
	rpcErr, ok = ldrpc.AsError(err)
	check(ok && rpcErr.Code == "invalid_data" && rpcErr.Status == 400, "invalid: %#v", err)

	limit := int64(10)
	list, err := client.BucketList(ctx, &bucketrpc.BucketListInput{Limit: &limit})
	check(err == nil && len(list.Items) == 2 && list.NextCursor != nil && *list.NextCursor == "after-10", "list: %v %+v", err, list)
	check(list.Items[1].ArchivedAt != nil && list.Items[1].ArchivedAt.Equal(time.UnixMilli(1_700_000_000_456)), "list dates: %+v", list.Items[1])

	_, err = client.BucketDelete(ctx, &bucketrpc.BucketDeleteInput{BucketID: "a"})
	check(err == nil, "delete: %v", err)

	tree, err := client.BucketFilesTree(ctx, &bucketrpc.BucketFilesTreeInput{BucketID: "a"})
	check(err == nil, "tree: %v", err)
	root, ok := tree.Root.Variant.(*bucketrpc.FileEntryDirectory)
	check(ok && len(root.Children) == 2, "tree root: %#v", tree.Root.Variant)
	file, ok := root.Children[0].Variant.(*bucketrpc.FileEntryFile)
	check(ok && file.Path == "/index.ts" && file.Size == 12, "tree file: %#v", root.Children[0].Variant)

	put, err := client.BucketFilesPut(ctx, &bucketrpc.BucketFilesPutInput{
		BucketID: "a",
		Path:     "src/a.ts",
		Content:  []byte("hello"),
		Metadata: json.RawMessage(`{"a":[1,true]}`),
		Mode:     "overwrite",
	})
	check(err == nil, "put: %v", err)
	entry, ok := put.Entry.Variant.(*bucketrpc.FileEntryFile)
	check(ok && entry.Path == "src/a.ts" && entry.Size == 5 && put.Version == 2.5, "put result: %+v %#v", put, put.Entry.Variant)

	fmt.Println("ok")
}
