package objectstorage

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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
	response, err := client.GetPublicURL("test-bucket", "test-key", &expirationSecs)
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
	response, err := client.GetPublicURL("test-bucket", "test-key", nil)
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
	_, err := client.GetPublicURL("test-bucket", "test-key", nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Object not found")
}

func stringPtr(s string) *string {
	return &s
}
