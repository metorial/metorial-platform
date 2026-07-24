use bytes::Bytes;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Already exists: {0}")]
    AlreadyExists(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Server error: {0}")]
    ServerError(String),
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bucket {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectMetadata {
    pub key: String,
    pub size: u64,
    pub content_type: Option<String>,
    pub etag: String,
    pub last_modified: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ObjectData {
    pub metadata: ObjectMetadata,
    pub data: Bytes,
}

#[derive(Debug, Clone, Serialize)]
struct CreateBucketRequest {
    name: String,
}

#[derive(Debug, Deserialize)]
struct ListBucketsResponse {
    buckets: Vec<Bucket>,
}

#[derive(Debug, Deserialize)]
struct ListObjectsResponse {
    objects: Vec<ObjectMetadata>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PublicUrlPurpose {
    #[default]
    Retrieve,
    Upload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicUrlResponse {
    pub url: String,
    pub expires_in: u64,
}

pub struct ObjectStoreClient {
    client: Client,
    base_url: String,
}

impl ObjectStoreClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.into(),
        }
    }

    pub fn with_client(base_url: impl Into<String>, client: Client) -> Self {
        Self {
            client,
            base_url: base_url.into(),
        }
    }

    pub async fn ping(&self) -> Result<()> {
        let url = format!("{}/ping", self.base_url);
        let response = self.client.get(&url).send().await?;

        match response.status() {
            StatusCode::OK => Ok(()),
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn create_bucket(&self, name: &str) -> Result<Bucket> {
        let url = format!("{}/buckets", self.base_url);
        let req = CreateBucketRequest {
            name: name.to_string(),
        };

        let response = self.client.post(&url).json(&req).send().await?;

        match response.status() {
            StatusCode::OK => Ok(response.json().await?),
            StatusCode::CONFLICT => Err(Error::AlreadyExists(name.to_string())),
            StatusCode::BAD_REQUEST => {
                Err(Error::BadRequest(response.text().await.unwrap_or_default()))
            }
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn upsert_bucket(&self, name: &str) -> Result<Bucket> {
        let url = format!("{}/buckets", self.base_url);
        let req = CreateBucketRequest {
            name: name.to_string(),
        };

        let response = self.client.put(&url).json(&req).send().await?;

        match response.status() {
            StatusCode::OK => Ok(response.json().await?),
            StatusCode::BAD_REQUEST => {
                Err(Error::BadRequest(response.text().await.unwrap_or_default()))
            }
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn get_bucket(&self, id: &str) -> Result<Bucket> {
        let url = format!("{}/buckets/{}", self.base_url, id);
        let response = self.client.get(&url).send().await?;

        match response.status() {
            StatusCode::OK => Ok(response.json().await?),
            StatusCode::NOT_FOUND => Err(Error::NotFound(id.to_string())),
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn list_buckets(&self) -> Result<Vec<Bucket>> {
        let url = format!("{}/buckets", self.base_url);
        let response = self.client.get(&url).send().await?;

        match response.status() {
            StatusCode::OK => {
                let resp: ListBucketsResponse = response.json().await?;
                Ok(resp.buckets)
            }
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn delete_bucket(&self, name: &str) -> Result<()> {
        let url = format!("{}/buckets/{}", self.base_url, name);
        let response = self.client.delete(&url).send().await?;

        match response.status() {
            StatusCode::NO_CONTENT => Ok(()),
            StatusCode::NOT_FOUND => Err(Error::NotFound(name.to_string())),
            StatusCode::BAD_REQUEST => {
                Err(Error::BadRequest(response.text().await.unwrap_or_default()))
            }
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        data: impl Into<Bytes>,
        content_type: Option<&str>,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<ObjectMetadata> {
        let url = format!("{}/buckets/{}/objects/{}", self.base_url, bucket, key);
        let mut request = self.client.put(&url);

        if let Some(ct) = content_type {
            request = request.header("content-type", ct);
        }

        if let Some(meta) = metadata {
            for (k, v) in meta {
                request = request.header(format!("x-object-meta-{}", k), v);
            }
        }

        let response = request.body(data.into()).send().await?;

        match response.status() {
            StatusCode::OK => Ok(response.json().await?),
            StatusCode::NOT_FOUND => Err(Error::NotFound(bucket.to_string())),
            StatusCode::BAD_REQUEST => {
                Err(Error::BadRequest(response.text().await.unwrap_or_default()))
            }
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn get_object(&self, bucket: &str, key: &str) -> Result<ObjectData> {
        let url = format!("{}/buckets/{}/objects/{}", self.base_url, bucket, key);
        let response = self.client.get(&url).send().await?;

        match response.status() {
            StatusCode::OK => {
                let etag = response
                    .headers()
                    .get("etag")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();

                let last_modified = response
                    .headers()
                    .get("last-modified")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();

                let content_type = response
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());

                let size = response
                    .headers()
                    .get("content-length")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);

                // Extract custom metadata from x-object-meta-* headers
                let mut metadata = HashMap::new();
                for (header_name, header_value) in response.headers().iter() {
                    if let Some(meta_key) = header_name.as_str().strip_prefix("x-object-meta-") {
                        if let Ok(meta_value) = header_value.to_str() {
                            metadata.insert(meta_key.to_string(), meta_value.to_string());
                        }
                    }
                }

                let data = response.bytes().await?;

                Ok(ObjectData {
                    metadata: ObjectMetadata {
                        key: key.to_string(),
                        size,
                        content_type,
                        etag,
                        last_modified,
                        metadata,
                    },
                    data,
                })
            }
            StatusCode::NOT_FOUND => Err(Error::NotFound(format!("{}/{}", bucket, key))),
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn head_object(&self, bucket: &str, key: &str) -> Result<ObjectMetadata> {
        let url = format!("{}/buckets/{}/objects/{}", self.base_url, bucket, key);
        let response = self.client.head(&url).send().await?;

        match response.status() {
            StatusCode::OK => {
                let etag = response
                    .headers()
                    .get("etag")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();

                let last_modified = response
                    .headers()
                    .get("last-modified")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .to_string();

                let content_type = response
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());

                let size = response
                    .headers()
                    .get("content-length")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);

                // Extract custom metadata from x-object-meta-* headers
                let mut metadata = HashMap::new();
                for (header_name, header_value) in response.headers().iter() {
                    if let Some(meta_key) = header_name.as_str().strip_prefix("x-object-meta-") {
                        if let Ok(meta_value) = header_value.to_str() {
                            metadata.insert(meta_key.to_string(), meta_value.to_string());
                        }
                    }
                }

                Ok(ObjectMetadata {
                    key: key.to_string(),
                    size,
                    content_type,
                    etag,
                    last_modified,
                    metadata,
                })
            }
            StatusCode::NOT_FOUND => Err(Error::NotFound(format!("{}/{}", bucket, key))),
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn get_object_info(&self, bucket: &str, key: &str) -> Result<ObjectMetadata> {
        let url = format!("{}/buckets/{}/object-info/{}", self.base_url, bucket, key);
        let response = self.client.get(&url).send().await?;

        match response.status() {
            StatusCode::OK => Ok(response.json().await?),
            StatusCode::NOT_FOUND => Err(Error::NotFound(format!("{}/{}", bucket, key))),
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn delete_object(&self, bucket: &str, key: &str) -> Result<()> {
        let url = format!("{}/buckets/{}/objects/{}", self.base_url, bucket, key);
        let response = self.client.delete(&url).send().await?;

        match response.status() {
            StatusCode::NO_CONTENT => Ok(()),
            StatusCode::NOT_FOUND => Err(Error::NotFound(format!("{}/{}", bucket, key))),
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn list_objects(
        &self,
        bucket: &str,
        prefix: Option<&str>,
        max_keys: Option<usize>,
    ) -> Result<Vec<ObjectMetadata>> {
        let mut url = format!("{}/buckets/{}/objects", self.base_url, bucket);
        let mut params = vec![];

        if let Some(p) = prefix {
            params.push(format!("prefix={}", p));
        }
        if let Some(m) = max_keys {
            params.push(format!("max_keys={}", m));
        }

        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        let response = self.client.get(&url).send().await?;

        match response.status() {
            StatusCode::OK => {
                let resp: ListObjectsResponse = response.json().await?;
                Ok(resp.objects)
            }
            StatusCode::NOT_FOUND => Err(Error::NotFound(bucket.to_string())),
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }

    pub async fn get_public_url(
        &self,
        bucket: &str,
        key: &str,
        expiration_secs: Option<u64>,
        purpose: Option<PublicUrlPurpose>,
    ) -> Result<PublicUrlResponse> {
        let mut url = format!("{}/buckets/{}/public-url/{}", self.base_url, bucket, key);
        let mut params = vec![];

        if let Some(exp) = expiration_secs {
            params.push(format!("expiration_secs={}", exp));
        }

        if let Some(p) = purpose {
            let purpose_str = match p {
                PublicUrlPurpose::Retrieve => "retrieve",
                PublicUrlPurpose::Upload => "upload",
            };
            params.push(format!("purpose={}", purpose_str));
        }

        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        let response = self.client.get(&url).send().await?;

        match response.status() {
            StatusCode::OK => Ok(response.json().await?),
            StatusCode::NOT_FOUND => Err(Error::NotFound(format!("{}/{}", bucket, key))),
            StatusCode::BAD_REQUEST => {
                Err(Error::BadRequest(response.text().await.unwrap_or_default()))
            }
            _ => Err(Error::ServerError(
                response.text().await.unwrap_or_default(),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;

    #[tokio::test]
    async fn test_client_creation() {
        let client = ObjectStoreClient::new("http://localhost:8080");
        assert_eq!(client.base_url, "http://localhost:8080");
    }

    #[tokio::test]
    async fn test_create_bucket() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("POST", "/buckets")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"id":"bucket-123","name":"test-bucket","created_at":"2024-01-01T00:00:00Z"}"#,
            )
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let bucket = client.create_bucket("test-bucket").await.unwrap();

        assert_eq!(bucket.id, "bucket-123");
        assert_eq!(bucket.name, "test-bucket");
        assert_eq!(bucket.created_at, "2024-01-01T00:00:00Z");
    }

    #[tokio::test]
    async fn test_create_bucket_conflict() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("POST", "/buckets")
            .with_status(409)
            .with_body("Bucket already exists")
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let result = client.create_bucket("test-bucket").await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::AlreadyExists(_)));
    }

    #[tokio::test]
    async fn test_list_buckets() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"buckets":[{"id":"bucket-1","name":"bucket1","created_at":"2024-01-01T00:00:00Z"},{"id":"bucket-2","name":"bucket2","created_at":"2024-01-02T00:00:00Z"}]}"#)
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let buckets = client.list_buckets().await.unwrap();

        assert_eq!(buckets.len(), 2);
        assert_eq!(buckets[0].id, "bucket-1");
        assert_eq!(buckets[0].name, "bucket1");
        assert_eq!(buckets[1].id, "bucket-2");
        assert_eq!(buckets[1].name, "bucket2");
    }

    #[tokio::test]
    async fn test_delete_bucket() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("DELETE", "/buckets/test-bucket")
            .with_status(204)
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let result = client.delete_bucket("test-bucket").await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_bucket_not_found() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("DELETE", "/buckets/test-bucket")
            .with_status(404)
            .with_body("Bucket not found")
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let result = client.delete_bucket("test-bucket").await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::NotFound(_)));
    }

    #[tokio::test]
    async fn test_put_object() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("PUT", "/buckets/test-bucket/objects/test-key")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"key":"test-key","size":13,"content_type":"text/plain","etag":"abc123","last_modified":"2024-01-01T00:00:00Z","metadata":{"key1":"value1"}}"#)
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let data = Bytes::from("Hello, World!");
        let mut metadata = HashMap::new();
        metadata.insert("key1".to_string(), "value1".to_string());

        let obj = client
            .put_object(
                "test-bucket",
                "test-key",
                data,
                Some("text/plain"),
                Some(metadata),
            )
            .await
            .unwrap();

        assert_eq!(obj.key, "test-key");
        assert_eq!(obj.size, 13);
        assert_eq!(obj.etag, "abc123");
    }

    #[tokio::test]
    async fn test_get_object() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets/test-bucket/objects/test-key")
            .with_status(200)
            .with_header("content-type", "text/plain")
            .with_header("content-length", "13")
            .with_header("etag", "abc123")
            .with_header("last-modified", "2024-01-01T00:00:00Z")
            .with_body("Hello, World!")
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let obj = client.get_object("test-bucket", "test-key").await.unwrap();

        assert_eq!(obj.metadata.key, "test-key");
        assert_eq!(obj.metadata.size, 13);
        assert_eq!(obj.metadata.etag, "abc123");
        assert_eq!(obj.data, Bytes::from("Hello, World!"));
    }

    #[tokio::test]
    async fn test_get_object_not_found() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets/test-bucket/objects/test-key")
            .with_status(404)
            .with_body("Object not found")
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let result = client.get_object("test-bucket", "test-key").await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::NotFound(_)));
    }

    #[tokio::test]
    async fn test_head_object() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("HEAD", "/buckets/test-bucket/objects/test-key")
            .with_status(200)
            .with_header("content-type", "text/plain")
            .with_header("content-length", "13")
            .with_header("etag", "abc123")
            .with_header("last-modified", "2024-01-01T00:00:00Z")
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let obj = client.head_object("test-bucket", "test-key").await.unwrap();

        assert_eq!(obj.key, "test-key");
        assert_eq!(obj.size, 13);
        assert_eq!(obj.etag, "abc123");
    }

    #[tokio::test]
    async fn test_delete_object() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("DELETE", "/buckets/test-bucket/objects/test-key")
            .with_status(204)
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let result = client.delete_object("test-bucket", "test-key").await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_list_objects() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets/test-bucket/objects")
            .match_query(mockito::Matcher::AllOf(vec![
                mockito::Matcher::UrlEncoded("prefix".into(), "prefix/".into()),
                mockito::Matcher::UrlEncoded("max_keys".into(), "10".into()),
            ]))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"objects":[{"key":"prefix/obj1","size":100,"etag":"etag1","last_modified":"2024-01-01T00:00:00Z","metadata":{}},{"key":"prefix/obj2","size":200,"etag":"etag2","last_modified":"2024-01-02T00:00:00Z","metadata":{}}]}"#)
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let objects = client
            .list_objects("test-bucket", Some("prefix/"), Some(10))
            .await
            .unwrap();

        assert_eq!(objects.len(), 2);
        assert_eq!(objects[0].key, "prefix/obj1");
        assert_eq!(objects[1].key, "prefix/obj2");
    }

    #[tokio::test]
    async fn test_list_objects_no_params() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets/test-bucket/objects")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"objects":[]}"#)
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let objects = client
            .list_objects("test-bucket", None, None)
            .await
            .unwrap();

        assert_eq!(objects.len(), 0);
    }

    #[tokio::test]
    async fn test_get_public_url() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets/test-bucket/public-url/test-key")
            .match_query(mockito::Matcher::UrlEncoded(
                "expiration_secs".into(),
                "7200".into(),
            ))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"url":"https://example.com/signed-url?signature=abc123","expires_in":7200}"#,
            )
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let response = client
            .get_public_url("test-bucket", "test-key", Some(7200), None)
            .await
            .unwrap();

        assert_eq!(
            response.url,
            "https://example.com/signed-url?signature=abc123"
        );
        assert_eq!(response.expires_in, 7200);
    }

    #[tokio::test]
    async fn test_get_public_url_default_expiration() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets/test-bucket/public-url/test-key")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"url":"https://example.com/signed-url?signature=xyz789","expires_in":3600}"#,
            )
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let response = client
            .get_public_url("test-bucket", "test-key", None, None)
            .await
            .unwrap();

        assert_eq!(
            response.url,
            "https://example.com/signed-url?signature=xyz789"
        );
        assert_eq!(response.expires_in, 3600);
    }

    #[tokio::test]
    async fn test_get_public_url_not_found() {
        let mut server = Server::new_async().await;
        let _m = server
            .mock("GET", "/buckets/test-bucket/public-url/test-key")
            .with_status(404)
            .with_body("Object not found")
            .create_async()
            .await;

        let client = ObjectStoreClient::new(server.url());
        let result = client
            .get_public_url("test-bucket", "test-key", None, None)
            .await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::NotFound(_)));
    }
}
