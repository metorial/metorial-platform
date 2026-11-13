// Interop fixture: drives a TypeScript @lowerdeck/rpc-server (started by
// interop/interop.test.ts) with the ldrpc Go client. Exits non-zero on the first mismatch.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
)

type bucket struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	Tags      []string  `json:"tags"`
}

type echoPayload struct {
	At    time.Time `json:"at"`
	Count int       `json:"count"`
}

func check(cond bool, format string, args ...any) {
	if !cond {
		fmt.Fprintf(os.Stderr, "FAIL: "+format+"\n", args...)
		os.Exit(1)
	}
}

func client(endpoint string, opts ldrpc.ClientOptions) *ldrpc.Client {
	c, err := ldrpc.NewClient(endpoint, opts)
	check(err == nil, "new client: %v", err)
	return c
}

func main() {
	base := os.Args[1]
	ctx := context.Background()
	wantCreatedAt := time.UnixMilli(1_700_000_000_123)

	for _, direct := range []bool{false, true} {
		c := client(base+"/rpc", ldrpc.ClientOptions{DirectRoute: direct})

		b, err := ldrpc.Call[bucket](ctx, c, "bucket:get", map[string]string{"bucketId": "bkt_1"})
		check(err == nil, "direct=%v get: %v", direct, err)
		check(b.ID == "bkt_1" && b.CreatedAt.Equal(wantCreatedAt) && len(b.Tags) == 2, "direct=%v get result: %+v", direct, b)

		at := time.UnixMilli(42)
		echo, err := ldrpc.Call[echoPayload](ctx, c, "bucket:echo", echoPayload{At: at, Count: 3})
		check(err == nil, "direct=%v echo: %v", direct, err)
		check(echo.At.Equal(at) && echo.Count == 3, "direct=%v echo result: %+v", direct, echo)

		_, err = ldrpc.Call[bucket](ctx, c, "bucket:get", map[string]string{"bucketId": "missing"})
		rpcErr, ok := ldrpc.AsError(err)
		check(ok && rpcErr.Status == 404 && rpcErr.Code == "not_found", "direct=%v missing: %#v", direct, err)

		_, err = ldrpc.Call[bucket](ctx, c, "bucket:get", map[string]int{"bucketId": 1})
		rpcErr, ok = ldrpc.AsError(err)
		check(ok && rpcErr.Status == 400 && rpcErr.Code == "invalid_data", "direct=%v invalid: %#v", direct, err)
	}

	var first, second bucket
	calls := []*ldrpc.BatchCall{
		{Method: "bucket:get", Input: map[string]string{"bucketId": "a"}, Output: &first},
		{Method: "bucket:get", Input: map[string]string{"bucketId": "missing"}, Output: &second},
	}
	err := client(base+"/rpc", ldrpc.ClientOptions{}).Batch(ctx, calls)
	check(err == nil, "batch: %v", err)
	check(calls[0].Err == nil && first.ID == "a", "batch first: %v %+v", calls[0].Err, first)
	rpcErr, ok := ldrpc.AsError(calls[1].Err)
	check(ok && rpcErr.Status == 404, "batch second: %#v", calls[1].Err)

	signed := client(base+"/signed", ldrpc.ClientOptions{HMACToken: "shared-secret"})
	_, err = ldrpc.Call[bucket](ctx, signed, "bucket:get", map[string]string{"bucketId": "a"}, ldrpc.WithQuery("region", "eu west"))
	check(err == nil, "signed: %v", err)

	unsigned := client(base+"/signed", ldrpc.ClientOptions{HMACToken: "wrong", MaxAttempts: 1})
	_, err = ldrpc.Call[bucket](ctx, unsigned, "bucket:get", map[string]string{"bucketId": "a"})
	rpcErr, ok = ldrpc.AsError(err)
	check(ok && rpcErr.Status == 401, "wrong signature: %#v", err)

	fmt.Println("ok")
}
