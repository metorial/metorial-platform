package bucketrpc_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/lib/rpc/go/example/bucketrpc"
)

type service struct {
	puts atomic.Int32
}

func (*service) Ping(ctx context.Context, in *ldrpc.Void) (*bucketrpc.PingOutput, error) {
	return &bucketrpc.PingOutput{Ok: true}, nil
}

func (*service) BucketGet(ctx context.Context, in *bucketrpc.BucketGetInput) (*bucketrpc.Bucket, error) {
	if in.BucketID == "archived" {
		return nil, bucketrpc.ErrBucketArchived(in.BucketID)
	}
	return &bucketrpc.Bucket{ID: in.BucketID, Status: bucketrpc.BucketStatusActive, CreatedAt: time.UnixMilli(1)}, nil
}

func (*service) BucketList(ctx context.Context, in *bucketrpc.BucketListInput) (*bucketrpc.BucketListOutput, error) {
	if in.Limit != nil && *in.Limit == 1 {
		return &bucketrpc.BucketListOutput{}, nil
	}
	return &bucketrpc.BucketListOutput{Items: []bucketrpc.Bucket{{ID: "a"}, {ID: "b"}}}, nil
}

func (*service) BucketArchive(ctx context.Context, in *bucketrpc.BucketArchiveInput) (*bucketrpc.Bucket, error) {
	return nil, ldrpc.InternalServerError()
}

func (*service) BucketDelete(ctx context.Context, in *bucketrpc.BucketDeleteInput) (*ldrpc.Void, error) {
	return nil, nil
}

func (*service) BucketFilesTree(ctx context.Context, in *bucketrpc.BucketFilesTreeInput) (*bucketrpc.BucketFilesTreeOutput, error) {
	return &bucketrpc.BucketFilesTreeOutput{Root: bucketrpc.FileEntry{Variant: &bucketrpc.FileEntryDirectory{
		Path: "/",
		Children: []bucketrpc.FileEntry{
			{Variant: &bucketrpc.FileEntryFile{Path: "/a.ts", Size: 3}},
			{Variant: &bucketrpc.FileEntryDirectory{Path: "/lib"}},
		},
	}}}, nil
}

func (s *service) BucketFilesPut(ctx context.Context, in *bucketrpc.BucketFilesPutInput) (*bucketrpc.BucketFilesPutOutput, error) {
	s.puts.Add(1)
	if !bytes.Equal(in.Content, []byte("hello")) || in.Mode != "overwrite" {
		return nil, ldrpc.BadRequestError()
	}
	return &bucketrpc.BucketFilesPutOutput{
		Entry:   bucketrpc.FileEntry{Variant: &bucketrpc.FileEntryFile{Path: in.Path, Size: int64(len(in.Content))}},
		Version: 1.5,
	}, nil
}

func start(t *testing.T, impl bucketrpc.Service) string {
	srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc"})
	bucketrpc.Register(srv, impl)

	mux := http.NewServeMux()
	srv.Mount(mux)
	hs := httptest.NewServer(mux)
	t.Cleanup(hs.Close)
	return hs.URL + "/rpc"
}

func TestGeneratedServerAndClient(t *testing.T) {
	client, err := bucketrpc.NewClient(start(t, &service{}), ldrpc.ClientOptions{MaxAttempts: 1})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	b, err := client.BucketGet(ctx, &bucketrpc.BucketGetInput{BucketID: "bkt_1"})
	if err != nil || b.ID != "bkt_1" || !b.CreatedAt.Equal(time.UnixMilli(1)) || b.Labels == nil {
		t.Fatalf("get: %v %+v", err, b)
	}

	_, err = client.BucketGet(ctx, &bucketrpc.BucketGetInput{BucketID: "archived"})
	if e, ok := ldrpc.AsError(err); !ok || !ldrpc.IsCode(err, bucketrpc.CodeBucketArchived) || e.Status != 409 || e.Extra["bucketId"] != "archived" {
		t.Fatalf("archived: %#v", err)
	}

	_, err = client.BucketGet(ctx, &bucketrpc.BucketGetInput{})
	if e, ok := ldrpc.AsError(err); !ok || e.Code != "invalid_data" || e.Extra["entity"] != "call_data" {
		t.Fatalf("schema: %#v", err)
	}

	list, err := client.BucketList(ctx, &bucketrpc.BucketListInput{})
	if err != nil || len(list.Items) != 2 {
		t.Fatalf("list: %v %+v", err, list)
	}

	pong, err := client.Ping(ctx, nil)
	if err != nil || !pong.Ok {
		t.Fatalf("ping: %v %+v", err, pong)
	}

	if _, err := client.BucketDelete(ctx, &bucketrpc.BucketDeleteInput{BucketID: "a"}); err != nil {
		t.Fatalf("delete: %v", err)
	}

	tree, err := client.BucketFilesTree(ctx, &bucketrpc.BucketFilesTreeInput{BucketID: "a"})
	if err != nil {
		t.Fatalf("tree: %v", err)
	}
	root, ok := tree.Root.Variant.(*bucketrpc.FileEntryDirectory)
	if !ok || len(root.Children) != 2 {
		t.Fatalf("tree root: %#v", tree.Root.Variant)
	}
	if file, ok := root.Children[0].Variant.(*bucketrpc.FileEntryFile); !ok || file.Size != 3 {
		t.Fatalf("tree file: %#v", root.Children[0].Variant)
	}
	if dir, ok := root.Children[1].Variant.(*bucketrpc.FileEntryDirectory); !ok || dir.Children == nil {
		t.Fatalf("nil children must arrive as []: %#v", root.Children[1].Variant)
	}

	put, err := client.BucketFilesPut(ctx, &bucketrpc.BucketFilesPutInput{BucketID: "a", Path: "x.ts", Content: []byte("hello"), Mode: "overwrite"})
	if err != nil || put.Version != 1.5 {
		t.Fatalf("put: %v %+v", err, put)
	}
}

func TestInputSchemaMatchesValidation(t *testing.T) {
	endpoint := start(t, &service{})

	cases := []struct {
		method string
		body   string
		want   string
	}{
		{"bucket.get", `{}`, `[{"code":"invalid_type","message":"Invalid input, expected string, received undefined","path":["bucketId"],"expected":"string","received":"undefined"}]`},
		{"bucket.get", `{"bucketId":""}`, `[{"code":"invalid_min_length","message":"Invalid min length, expected 1","path":["bucketId"],"expected":1,"received":0,"min":1}]`},
		{"bucket.list", `{"status":"gone"}`, `[{"code":"invalid_enum","message":"Invalid input, expected one of active, archived, received gone","path":["status"],"expected":["active","archived"],"received":"gone"}]`},
		{"bucket.list", `{"limit":501}`, `[{"code":"invalid_max","message":"Invalid max, expected 500","path":["limit"],"expected":500,"received":501,"max":500}]`},
		{"bucket.files.put", `{"bucketId":"a","path":"/x","content":"aGVsbG8=","mode":"overwrite"}`, `[{"code":"invalid_regex","message":"Invalid regex, expected /^[^/].*$/","path":["path"],"received":"/x"}]`},
	}

	for _, tc := range cases {
		res, err := http.Post(endpoint+"/"+tc.method, ldrpc.ContentType, strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		var body struct {
			Code   string          `json:"code"`
			Errors json.RawMessage `json:"errors"`
		}
		raw := new(bytes.Buffer)
		_, _ = raw.ReadFrom(res.Body)
		res.Body.Close()
		if err := ldrpc.Unmarshal(raw.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		var got, want any
		_ = json.Unmarshal(body.Errors, &got)
		_ = json.Unmarshal([]byte(tc.want), &want)
		if res.StatusCode != 400 || body.Code != "invalid_data" || !reflect.DeepEqual(got, want) {
			t.Errorf("%s %s: %d %s\n got %s\nwant %s", tc.method, tc.body, res.StatusCode, body.Code, body.Errors, tc.want)
		}
	}
}

func TestEmptyListIsArray(t *testing.T) {
	endpoint := start(t, &service{})
	res, err := http.Post(endpoint+"/bucket.list", ldrpc.ContentType, strings.NewReader(`{"limit":1}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw := new(bytes.Buffer)
	_, _ = raw.ReadFrom(res.Body)
	if !strings.Contains(raw.String(), `"items":[]`) {
		t.Fatalf("nil required slice must encode as []: %s", raw)
	}
}

func TestNonIdempotentMethodsAreNotRetried(t *testing.T) {
	var calls atomic.Int32
	hs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(502)
	}))
	defer hs.Close()

	client, err := bucketrpc.NewClient(hs.URL, ldrpc.ClientOptions{Timeout: 300 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	if _, err := client.BucketGet(ctx, &bucketrpc.BucketGetInput{BucketID: "a"}); err == nil {
		t.Fatal("expected an error")
	}
	if calls.Load() < 2 {
		t.Fatalf("idempotent methods are retried, got %d attempts", calls.Load())
	}

	calls.Store(0)
	if _, err := client.BucketFilesPut(ctx, &bucketrpc.BucketFilesPutInput{BucketID: "a"}); err == nil {
		t.Fatal("expected an error")
	}
	if calls.Load() != 1 {
		t.Fatalf("non-idempotent methods must not be retried, got %d attempts", calls.Load())
	}
}
