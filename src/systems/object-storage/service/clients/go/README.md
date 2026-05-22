# Object Storage Client for Go

Go client library for interacting with the [Metorial Object Storage Service](https://github.com/metorial/object-storage).

## Installation

```bash
go get github.com/metorial/object-storage/clients/go
```

## Usage

```go
package main

import (
    "fmt"
    "log"

    objectstorage "github.com/metorial/object-storage/clients/go"
)

func main() {
    client := objectstorage.NewClient("http://localhost:8080")

    // Create a bucket
    bucket, err := client.CreateBucket("my-bucket")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Created bucket: %s\n", bucket.Name)

    // Upload an object
    data := []byte("Hello, World!")
    contentType := "text/plain"
    metadata := map[string]string{"key1": "value1"}

    obj, err := client.PutObject("my-bucket", "hello.txt", data, &contentType, metadata)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Uploaded object: %s (ETag: %s)\n", obj.Key, obj.ETag)

    // Download an object
    objData, err := client.GetObject("my-bucket", "hello.txt")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Downloaded %d bytes\n", len(objData.Data))

    // List objects
    objects, err := client.ListObjects("my-bucket", nil, nil)
    if err != nil {
        log.Fatal(err)
    }
    for _, obj := range objects {
        fmt.Printf("%s: %d bytes\n", obj.Key, obj.Size)
    }

    // Delete object
    if err := client.DeleteObject("my-bucket", "hello.txt"); err != nil {
        log.Fatal(err)
    }

    // Delete bucket
    if err := client.DeleteBucket("my-bucket"); err != nil {
        log.Fatal(err)
    }
}
```

## API Reference

### Client Creation

```go
client := objectstorage.NewClient("http://localhost:8080")
```

For custom HTTP client configuration:

```go
httpClient := &http.Client{Timeout: 60 * time.Second}
client := objectstorage.NewClientWithHTTP("http://localhost:8080", httpClient)
```

### Bucket Operations

**Create Bucket**
```go
bucket, err := client.CreateBucket("bucket-name")
```

**List Buckets**
```go
buckets, err := client.ListBuckets()
```

**Delete Bucket**
```go
err := client.DeleteBucket("bucket-name")
```

### Object Operations

**Put Object**
```go
data := []byte("content")
contentType := "application/json"
metadata := map[string]string{"key": "value"}

obj, err := client.PutObject("bucket-name", "object-key", data, &contentType, metadata)
```

**Get Object**
```go
objData, err := client.GetObject("bucket-name", "object-key")
// objData.Data contains the object bytes
// objData.Metadata contains metadata
```

**Head Object**
```go
metadata, err := client.HeadObject("bucket-name", "object-key")
```

**Delete Object**
```go
err := client.DeleteObject("bucket-name", "object-key")
```

**List Objects**
```go
// List all objects
objects, err := client.ListObjects("bucket-name", nil, nil)

// List with prefix
prefix := "prefix/"
objects, err := client.ListObjects("bucket-name", &prefix, nil)

// List with prefix and max keys
maxKeys := 100
objects, err := client.ListObjects("bucket-name", &prefix, &maxKeys)
```

## Error Handling

The client returns typed errors:

```go
obj, err := client.GetObject("bucket", "key")
if err != nil {
    if objErr, ok := err.(*objectstorage.Error); ok {
        fmt.Printf("Status: %d, Message: %s\n", objErr.StatusCode, objErr.Message)
    }
}
```
