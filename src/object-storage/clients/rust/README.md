# Object Storage Client for Rust

Async Rust client library for interacting with the [Metorial Object Storage Service](https://github.com/metorial/object-storage).

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
object-store-client = "0.1"
tokio = { version = "1", features = ["full"] }
```

## Usage

```rust
use object_store_client::{ObjectStoreClient, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = ObjectStoreClient::new("http://localhost:8080");

    // Create a bucket
    client.create_bucket("my-bucket").await?;

    // Upload an object
    let data = b"Hello, World!";
    client.put_object("my-bucket", "hello.txt", data, Some("text/plain"), None).await?;

    // Download an object
    let obj = client.get_object("my-bucket", "hello.txt").await?;
    println!("Downloaded {} bytes", obj.data.len());

    // List objects
    let objects = client.list_objects("my-bucket", None, None).await?;
    for obj in objects {
        println!("{}: {} bytes", obj.key, obj.size);
    }

    // Delete object
    client.delete_object("my-bucket", "hello.txt").await?;

    // Delete bucket
    client.delete_bucket("my-bucket").await?;

    Ok(())
}
```

## API Reference

### Client Creation

```rust
let client = ObjectStoreClient::new("http://localhost:8080");
```

### Bucket Operations

**Create Bucket**
```rust
client.create_bucket("bucket-name").await?;
```

**List Buckets**
```rust
let buckets = client.list_buckets().await?;
```

**Delete Bucket**
```rust
client.delete_bucket("bucket-name").await?;
```

### Object Operations

**Put Object**
```rust
let metadata = client.put_object(
    "bucket-name",
    "object-key",
    data,
    Some("application/json"),
    Some(custom_metadata)
).await?;
```

**Get Object**
```rust
let obj = client.get_object("bucket-name", "object-key").await?;
```

**Head Object**
```rust
let metadata = client.head_object("bucket-name", "object-key").await?;
```

**Delete Object**
```rust
client.delete_object("bucket-name", "object-key").await?;
```

**List Objects**
```rust
let objects = client.list_objects("bucket-name", Some("prefix/"), Some(100)).await?;
```

## Error Handling

The client returns `Result<T, Error>` where `Error` can be:

- `Error::NotFound` - Resource not found
- `Error::AlreadyExists` - Resource already exists
- `Error::BadRequest` - Invalid request
- `Error::ServerError` - Server error
- `Error::Http` - Network/HTTP error
