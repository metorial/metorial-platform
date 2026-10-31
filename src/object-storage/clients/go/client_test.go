package objectstorage

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/iotest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewClient(t *testing.T) {
	client := NewClient("http://localhost:8080")
	assert.NotNil(t, client)
	assert.Equal(t, "http://localhost:8080", client.baseURL)
}

func TestCreateBucket(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/buckets", r.URL.Path)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		var req createBucketRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(t, err)
		assert.Equal(t, "test-bucket", req.Name)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(Bucket{
			Name:      "test-bucket",
			CreatedAt: "2024-01-01T00:00:00Z",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	bucket, err := client.CreateBucket("test-bucket")
	require.NoError(t, err)
	assert.Equal(t, "test-bucket", bucket.Name)
	assert.Equal(t, "2024-01-01T00:00:00Z", bucket.CreatedAt)
}

func TestCreateBucketError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
		w.Write([]byte("Bucket already exists"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.CreateBucket("test-bucket")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "409")
}

func TestListBuckets(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/buckets", r.URL.Path)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(listBucketsResponse{
			Buckets: []Bucket{
				{Name: "bucket1", CreatedAt: "2024-01-01T00:00:00Z"},
				{Name: "bucket2", CreatedAt: "2024-01-02T00:00:00Z"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	buckets, err := client.ListBuckets()
	require.NoError(t, err)
	assert.Len(t, buckets, 2)
	assert.Equal(t, "bucket1", buckets[0].Name)
	assert.Equal(t, "bucket2", buckets[1].Name)
}

func TestDeleteBucket(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/buckets/test-bucket", r.URL.Path)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.DeleteBucket("test-bucket")
	require.NoError(t, err)
}

func TestDeleteBucketNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("Bucket not found"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.DeleteBucket("test-bucket")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}

func TestPutObject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PUT", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects/test-key", r.URL.Path)
		assert.Equal(t, "text/plain", r.Header.Get("Content-Type"))
		assert.Equal(t, "value1", r.Header.Get("x-object-meta-key1"))

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ObjectMetadata{
			Key:          "test-key",
			Size:         13,
			ContentType:  stringPtr("text/plain"),
			ETag:         "abc123",
			LastModified: "2024-01-01T00:00:00Z",
			Metadata:     map[string]string{"key1": "value1"},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	contentType := "text/plain"
	metadata := map[string]string{"key1": "value1"}
	data := []byte("Hello, World!")

	obj, err := client.PutObject("test-bucket", "test-key", data, &contentType, metadata)
	require.NoError(t, err)
	assert.Equal(t, "test-key", obj.Key)
	assert.Equal(t, uint64(13), obj.Size)
	assert.Equal(t, "abc123", obj.ETag)
}

func TestGetObject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects/test-key", r.URL.Path)

		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("Content-Length", "13")
		w.Header().Set("ETag", "abc123")
		w.Header().Set("Last-Modified", "2024-01-01T00:00:00Z")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Hello, World!"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	obj, err := client.GetObject("test-bucket", "test-key")
	require.NoError(t, err)
	assert.Equal(t, "test-key", obj.Metadata.Key)
	assert.Equal(t, uint64(13), obj.Metadata.Size)
	assert.Equal(t, "abc123", obj.Metadata.ETag)
	assert.Equal(t, []byte("Hello, World!"), obj.Data)
}

func TestEscapeObjectKey(t *testing.T) {
	assert.Equal(t, "dir/sub/file.txt", EscapeObjectKey("dir/sub/file.txt"))
	assert.Equal(t, "dir/notes%231.md", EscapeObjectKey("dir/notes#1.md"))
	assert.Equal(t, "100%25.md", EscapeObjectKey("100%.md"))
	assert.Equal(t, "a%3Fb%20c.md", EscapeObjectKey("a?b c.md"))
	assert.Equal(t, "r%C3%A9sum%C3%A9.md", EscapeObjectKey("résumé.md"))
}

func TestObjectKeysReachTheServerVerbatim(t *testing.T) {
	keys := []string{
		"bucket-1/notes#1.md",
		"bucket-1/100%.md",
		"bucket-1/a%41.md",
		"bucket-1/what?.md",
		"bucket-1/日本語/🚀 launch.md",
		"bucket-1/a&b+c;d=e.md",
	}

	var received []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = append(received, r.Method+" "+r.URL.Path)
		switch r.Method {
		case "PUT":
			json.NewEncoder(w).Encode(ObjectMetadata{Key: "k"})
		case "DELETE":
			w.WriteHeader(http.StatusNoContent)
		default:
			w.Header().Set("Content-Length", "0")
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer server.Close()

	client := NewClient(server.URL)
	var expected []string
	for _, key := range keys {
		_, err := client.PutObject("files", key, []byte("x"), nil, nil)
		require.NoError(t, err)
		_, err = client.GetObject("files", key)
		require.NoError(t, err)
		_, err = client.HeadObject("files", key)
		require.NoError(t, err)
		require.NoError(t, client.DeleteObject("files", key))

		path := "/buckets/files/objects/" + key
		expected = append(expected, "PUT "+path, "GET "+path, "HEAD "+path, "DELETE "+path)
	}

	assert.Equal(t, expected, received)
}

func TestGetObjectNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("Object not found"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.GetObject("test-bucket", "test-key")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}

func TestHeadObject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "HEAD", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects/test-key", r.URL.Path)

		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("Content-Length", "13")
		w.Header().Set("ETag", "abc123")
		w.Header().Set("Last-Modified", "2024-01-01T00:00:00Z")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	obj, err := client.HeadObject("test-bucket", "test-key")
	require.NoError(t, err)
	assert.Equal(t, "test-key", obj.Key)
	assert.Equal(t, uint64(13), obj.Size)
	assert.Equal(t, "abc123", obj.ETag)
}

func TestDeleteObject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects/test-key", r.URL.Path)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.DeleteObject("test-bucket", "test-key")
	require.NoError(t, err)
}

func TestListObjects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects", r.URL.Path)
		assert.Equal(t, "prefix/", r.URL.Query().Get("prefix"))
		assert.Equal(t, "10", r.URL.Query().Get("max_keys"))

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(listObjectsResponse{
			Objects: []ObjectMetadata{
				{Key: "prefix/obj1", Size: 100, ETag: "etag1", LastModified: "2024-01-01T00:00:00Z", Metadata: map[string]string{}},
				{Key: "prefix/obj2", Size: 200, ETag: "etag2", LastModified: "2024-01-02T00:00:00Z", Metadata: map[string]string{}},
			},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	prefix := "prefix/"
	maxKeys := 10
	objects, err := client.ListObjects("test-bucket", &prefix, &maxKeys)
	require.NoError(t, err)
	assert.Len(t, objects, 2)
	assert.Equal(t, "prefix/obj1", objects[0].Key)
	assert.Equal(t, "prefix/obj2", objects[1].Key)
}

func TestListObjectsNoParams(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects", r.URL.Path)
		assert.Empty(t, r.URL.Query())

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(listObjectsResponse{
			Objects: []ObjectMetadata{},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	objects, err := client.ListObjects("test-bucket", nil, nil)
	require.NoError(t, err)
	assert.Empty(t, objects)
}

func TestListObjectsFollowsContinuationTokens(t *testing.T) {
	var seenTokens []string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("continuation_token")
		seenTokens = append(seenTokens, token)

		w.WriteHeader(http.StatusOK)

		switch token {
		case "":
			next := "page-2"
			json.NewEncoder(w).Encode(listObjectsResponse{
				Objects:               []ObjectMetadata{{Key: "obj1"}, {Key: "obj2"}},
				NextContinuationToken: &next,
			})
		case "page-2":
			next := "page-3"
			json.NewEncoder(w).Encode(listObjectsResponse{
				Objects:               []ObjectMetadata{{Key: "obj3"}},
				NextContinuationToken: &next,
			})
		default:
			json.NewEncoder(w).Encode(listObjectsResponse{
				Objects: []ObjectMetadata{{Key: "obj4"}},
			})
		}
	}))
	defer server.Close()

	client := NewClient(server.URL)
	objects, err := client.ListObjects("test-bucket", nil, nil)
	require.NoError(t, err)

	assert.Equal(t, []string{"", "page-2", "page-3"}, seenTokens)
	require.Len(t, objects, 4)
	assert.Equal(t, "obj4", objects[3].Key)
}

func TestListObjectsStopsAtMaxKeys(t *testing.T) {
	calls := 0

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		next := "more"
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(listObjectsResponse{
			Objects:               []ObjectMetadata{{Key: "obj1"}, {Key: "obj2"}, {Key: "obj3"}},
			NextContinuationToken: &next,
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	maxKeys := 2
	objects, err := client.ListObjects("test-bucket", nil, &maxKeys)
	require.NoError(t, err)

	assert.Equal(t, 1, calls, "should not keep paging once the cap is reached")
	assert.Len(t, objects, 2)
}

func TestDeleteObjects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects/delete", r.URL.Path)

		var req deleteObjectsRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, []string{"a.txt", "b.txt"}, req.Keys)

		failure := "boom"
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(deleteObjectsResponse{
			Results: []DeleteObjectResult{
				{Key: "a.txt", Deleted: true},
				{Key: "b.txt", Deleted: false, Error: &failure},
			},
			Deleted: 1,
			Failed:  1,
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	results, err := client.DeleteObjects("test-bucket", []string{"a.txt", "b.txt"})
	require.NoError(t, err)

	require.Len(t, results, 2)
	assert.True(t, results[0].Deleted)
	assert.False(t, results[1].Deleted)
	assert.Equal(t, "boom", *results[1].Error)
}

func TestDeleteObjectsEmptyIsNoop(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("no request expected for an empty key list")
	}))
	defer server.Close()

	client := NewClient(server.URL)
	results, err := client.DeleteObjects("test-bucket", nil)
	require.NoError(t, err)
	assert.Empty(t, results)
}

func TestCopyObject(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/buckets/code-bucket/copy-object/skills/demo/asset.bin", r.URL.Path)

		var req copyObjectRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "files", req.SourceBucket)
		assert.Equal(t, "abc123", req.SourceKey)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ObjectMetadata{
			Key:  "skills/demo/asset.bin",
			Size: 42,
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	metadata, err := client.CopyObject("code-bucket", "skills/demo/asset.bin", "files", "abc123")
	require.NoError(t, err)

	assert.Equal(t, "skills/demo/asset.bin", metadata.Key)
	assert.Equal(t, uint64(42), metadata.Size)
}

func TestCopyObjectNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.CopyObject("code-bucket", "a.txt", "files", "missing")
	require.Error(t, err)
}

func TestGetPublicURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/buckets/test-bucket/public-url/test-key", r.URL.Path)
		assert.Equal(t, "7200", r.URL.Query().Get("expiration_secs"))

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(PublicURLResponse{
			URL:       "https://example.com/signed-url?signature=abc123",
			ExpiresIn: 7200,
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	expirationSecs := uint64(7200)
	response, err := client.GetPublicURL("test-bucket", "test-key", &expirationSecs, nil)
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/signed-url?signature=abc123", response.URL)
	assert.Equal(t, uint64(7200), response.ExpiresIn)
}

func TestGetPublicURLDefaultExpiration(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/buckets/test-bucket/public-url/test-key", r.URL.Path)
		assert.Empty(t, r.URL.Query())

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(PublicURLResponse{
			URL:       "https://example.com/signed-url?signature=xyz789",
			ExpiresIn: 3600,
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	response, err := client.GetPublicURL("test-bucket", "test-key", nil, nil)
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/signed-url?signature=xyz789", response.URL)
	assert.Equal(t, uint64(3600), response.ExpiresIn)
}

func TestGetPublicURLNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("Object not found"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.GetPublicURL("test-bucket", "test-key", nil, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Object not found")
}

func TestGetObjectStream(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects/test-key", r.URL.Path)

		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("ETag", "etag-123")
		w.Header().Set("x-object-meta-author", "tobias")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("streamed content"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	stream, err := client.GetObjectStream(context.Background(), "test-bucket", "test-key")
	require.NoError(t, err)
	defer stream.Body.Close()

	assert.Equal(t, "etag-123", stream.Metadata.ETag)
	assert.Equal(t, "application/octet-stream", *stream.Metadata.ContentType)
	assert.Equal(t, "tobias", stream.Metadata.Metadata["Author"])

	body, err := io.ReadAll(stream.Body)
	require.NoError(t, err)
	assert.Equal(t, "streamed content", string(body))
}

func TestGetObjectStreamNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("Object not found"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	stream, err := client.GetObjectStream(context.Background(), "test-bucket", "missing")
	require.Error(t, err)
	assert.Nil(t, stream)
	assert.Contains(t, err.Error(), "Object not found")
}

func TestGetObjectStreamDoesNotBufferTheBody(t *testing.T) {
	// The handler blocks after the first chunk. A client that buffered the body
	// before returning would deadlock here rather than hand back a reader.
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("first"))
		w.(http.Flusher).Flush()
		<-release
		w.Write([]byte("second"))
	}))
	defer server.Close()
	defer close(release)

	client := NewClient(server.URL)
	stream, err := client.GetObjectStream(context.Background(), "test-bucket", "test-key")
	require.NoError(t, err)
	defer stream.Body.Close()

	first := make([]byte, 5)
	_, err = io.ReadFull(stream.Body, first)
	require.NoError(t, err)
	assert.Equal(t, "first", string(first))
}

func TestGetObjectStreamHonoursContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	client := NewClient(server.URL)
	_, err := client.GetObjectStream(ctx, "test-bucket", "test-key")
	require.Error(t, err)
}

func TestPutObjectFromReader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PUT", r.Method)
		assert.Equal(t, "/buckets/test-bucket/objects/test-key", r.URL.Path)
		assert.Equal(t, "text/plain", r.Header.Get("Content-Type"))
		assert.Equal(t, "tobias", r.Header.Get("x-object-meta-author"))

		assert.Equal(t, int64(11), r.ContentLength)

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Equal(t, "hello world", string(body))

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ObjectMetadata{Key: "test-key", Size: 11, ETag: "etag-123"})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	metadata, err := client.PutObjectFromReader(
		context.Background(),
		"test-bucket",
		"test-key",
		strings.NewReader("hello world"),
		11,
		stringPtr("text/plain"),
		map[string]string{"author": "tobias"},
	)
	require.NoError(t, err)
	assert.Equal(t, uint64(11), metadata.Size)
	assert.Equal(t, "etag-123", metadata.ETag)
}

func TestPutObjectFromReaderWithUnknownSize(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, int64(-1), r.ContentLength)

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Equal(t, "hello world", string(body))

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ObjectMetadata{Key: "test-key", Size: 11})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.PutObjectFromReader(
		context.Background(),
		"test-bucket",
		"test-key",
		iotest.OneByteReader(strings.NewReader("hello world")),
		-1,
		nil,
		nil,
	)
	require.NoError(t, err)
}

func TestPutObjectFromReaderSurfacesErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		w.WriteHeader(http.StatusInsufficientStorage)
		w.Write([]byte("out of space"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.PutObjectFromReader(
		context.Background(),
		"test-bucket",
		"test-key",
		strings.NewReader("hello"),
		5,
		nil,
		nil,
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "out of space")
}

func stringPtr(s string) *string {
	return &s
}
