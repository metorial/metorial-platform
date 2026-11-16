package objectsource

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
	objectstorage "github.com/metorial/object-storage/clients/go"
)

type fakeClient struct {
	objects map[string][]byte
	gets    int
	failure error
}

func (c *fakeClient) GetObjectStream(ctx context.Context, bucket, key string) (*objectstorage.ObjectStream, error) {
	c.gets++
	if c.failure != nil {
		return nil, c.failure
	}
	data, ok := c.objects[bucket+"/"+key]
	if !ok {
		return nil, &objectstorage.Error{StatusCode: http.StatusNotFound, Message: "not found"}
	}
	return &objectstorage.ObjectStream{Body: io.NopCloser(bytes.NewReader(data))}, nil
}

func (c *fakeClient) PutObjectFromReader(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType *string, metadata map[string]string) (*objectstorage.ObjectMetadata, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) != size {
		return nil, errors.New("size mismatch")
	}
	c.objects[bucket+"/"+key] = data
	return &objectstorage.ObjectMetadata{Key: key}, nil
}

func TestReader(t *testing.T) {
	client := &fakeClient{objects: map[string][]byte{"files/a": []byte("hello")}}
	reader := New(client, []string{"files", ""})
	ctx := context.Background()

	body, err := reader.OpenObject(ctx, "files", "a")
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(body)
	if string(data) != "hello" {
		t.Fatalf("read %q", data)
	}

	if _, err := reader.OpenObject(ctx, "files", "missing"); !errors.Is(err, manifest.ErrObjectNotFound) {
		t.Fatalf("404 must map to ErrObjectNotFound, got %v", err)
	}

	gets := client.gets
	if _, err := reader.OpenObject(ctx, "other", "a"); !errors.Is(err, ErrBucketNotAllowed) {
		t.Fatalf("got %v", err)
	}
	if reader.AllowBucket("") {
		t.Fatal("the empty bucket name must never be allowed")
	}
	if client.gets != gets {
		t.Fatal("a disallowed bucket must not be read")
	}

	client.failure = &objectstorage.Error{StatusCode: http.StatusInternalServerError}
	if _, err := reader.OpenObject(ctx, "files", "a"); err == nil || errors.Is(err, manifest.ErrObjectNotFound) {
		t.Fatalf("server errors are not not-found: %v", err)
	}
}

func TestListingStoreRoundTrip(t *testing.T) {
	client := &fakeClient{objects: map[string][]byte{}}
	store := NewListingStore(client, "origin")
	ctx := context.Background()

	listing, err := remotestate.FromEntries("3333333333333333333333333333333333333333", []remotestate.Entry{
		{Path: "plugins/acme/SKILL.md", Mode: remotestate.ModeFile, SHA: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"},
	})
	if err != nil {
		t.Fatal(err)
	}

	saved, err := store.Save(ctx, "remote-state/osr_1/", listing)
	if err != nil {
		t.Fatal(err)
	}
	if saved.ListingKey != "remote-state/osr_1/"+listing.TreeSHA()+".bin" || saved.ListingBucket != "origin" || saved.EntryCount != 3 {
		t.Fatalf("saved = %+v", saved)
	}

	loaded, err := store.Load(ctx, *saved)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.TreeSHA() != listing.TreeSHA() {
		t.Fatal("round trip changed the tree")
	}

	stale := *saved
	stale.TreeSHA = remotestate.EmptyTreeSHA
	if _, err := store.Load(ctx, stale); err == nil {
		t.Fatal("a listing that doesn't match the cached tree must be rejected")
	}

	foreign := *saved
	foreign.ListingBucket = "files"
	if _, err := store.Load(ctx, foreign); err == nil {
		t.Fatal("listings are only read from Origin's bucket")
	}

	var _ export.ListingStore = store
}
