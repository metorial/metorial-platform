use std::io::{Read, Write};
use std::path::Path;
use std::time::{Duration, Instant};

use bytes::Bytes;
use futures::{Stream, StreamExt};
use serde_json::Value;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct Reply {
    pub status: u16,
    pub body: Value,
    pub retry_after: Option<String>,
    pub elapsed: Duration,
}

impl Reply {
    pub fn state(&self) -> &str {
        self.body["state"].as_str().unwrap_or_default()
    }

    pub fn code(&self) -> &str {
        self.body["code"].as_str().unwrap_or_default()
    }

    pub fn error_code(&self) -> &str {
        self.body["error"]["code"].as_str().unwrap_or_default()
    }
}

/// The service's HTTP API, nothing else.
#[derive(Clone)]
pub struct Api {
    pub url: String,
    http: reqwest::Client,
}

impl Api {
    pub fn new(url: &str) -> Api {
        Api {
            url: url.to_string(),
            http: reqwest::Client::builder()
                .pool_max_idle_per_host(64)
                .build()
                .unwrap(),
        }
    }

    pub fn client(&self) -> &reqwest::Client {
        &self.http
    }

    pub async fn health(&self) -> bool {
        match self
            .http
            .get(format!("{}/health", self.url))
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    pub async fn create_bucket(&self, name: &str) {
        let response = self
            .http
            .post(format!("{}/buckets", self.url))
            .json(&serde_json::json!({ "name": name }))
            .send()
            .await
            .unwrap();
        assert!(
            response.status().is_success(),
            "creating bucket {name}: {} {}",
            response.status(),
            response.text().await.unwrap_or_default()
        );
    }

    pub async fn put_object(
        &self,
        bucket: &str,
        key: &str,
        data: impl Into<Bytes>,
        content_type: Option<&str>,
    ) -> Value {
        let mut request = self
            .http
            .put(self.object_url(bucket, key))
            .body(reqwest::Body::from(data.into()));
        if let Some(content_type) = content_type {
            request = request.header("content-type", content_type);
        }
        let response = request.send().await.unwrap();
        let status = response.status();
        let body = response.text().await.unwrap();
        assert!(status.is_success(), "PUT {bucket}/{key}: {status} {body}");
        serde_json::from_str(&body).unwrap()
    }

    /// Streams `size` bytes into an object without holding them (Content-Length is set).
    pub async fn put_object_stream<S>(&self, bucket: &str, key: &str, size: u64, stream: S) -> Value
    where
        S: Stream<Item = std::io::Result<Bytes>> + Send + Sync + 'static,
    {
        let response = self
            .http
            .put(self.object_url(bucket, key))
            .header("content-length", size)
            .header("content-type", "application/octet-stream")
            .body(reqwest::Body::wrap_stream(stream))
            .send()
            .await
            .unwrap();
        let status = response.status();
        let body = response.text().await.unwrap();
        assert!(status.is_success(), "PUT {bucket}/{key}: {status} {body}");
        serde_json::from_str(&body).unwrap()
    }

    pub fn object_url(&self, bucket: &str, key: &str) -> String {
        let key: String = key.split('/').map(urlencode).collect::<Vec<_>>().join("/");
        format!("{}/buckets/{}/objects/{}", self.url, bucket, key)
    }

    pub async fn get_object(&self, bucket: &str, key: &str) -> (u16, Bytes) {
        let response = self
            .http
            .get(self.object_url(bucket, key))
            .send()
            .await
            .unwrap();
        let status = response.status().as_u16();
        (status, response.bytes().await.unwrap())
    }

    pub async fn object_status(&self, bucket: &str, key: &str) -> u16 {
        self.http
            .head(self.object_url(bucket, key))
            .send()
            .await
            .unwrap()
            .status()
            .as_u16()
    }

    /// `GET /object-info`: size, etag, last_modified.
    pub async fn object_info(&self, bucket: &str, key: &str) -> Option<Value> {
        let key: String = key.split('/').map(urlencode).collect::<Vec<_>>().join("/");
        let response = self
            .http
            .get(format!(
                "{}/buckets/{}/object-info/{}",
                self.url, bucket, key
            ))
            .send()
            .await
            .unwrap();
        if response.status() == 404 {
            return None;
        }
        assert!(response.status().is_success());
        Some(response.json().await.unwrap())
    }

    /// Streams the object into `path`; returns its size and hex SHA-256.
    pub async fn download(&self, bucket: &str, key: &str, path: &Path) -> (u64, String) {
        let mut response = self
            .http
            .get(self.object_url(bucket, key))
            .send()
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            200,
            "GET {bucket}/{key}: {}",
            response.status()
        );
        let mut file =
            std::io::BufWriter::with_capacity(4 << 20, std::fs::File::create(path).unwrap());
        let mut hasher = Sha256::new();
        let mut size = 0u64;
        while let Some(chunk) = response.chunk().await.unwrap() {
            hasher.update(&chunk);
            file.write_all(&chunk).unwrap();
            size += chunk.len() as u64;
        }
        file.flush().unwrap();
        (size, hex::encode(hasher.finalize()))
    }

    pub fn job_url(&self, id: &str, wait: Option<f64>) -> String {
        match wait {
            Some(wait) => format!("{}/zip-jobs/{}?wait={}", self.url, id, wait),
            None => format!("{}/zip-jobs/{}", self.url, id),
        }
    }

    pub async fn put_job(&self, id: &str, spec: &Value, wait: Option<f64>) -> Reply {
        self.request(
            reqwest::Method::PUT,
            &self.job_url(id, wait),
            Some(serde_json::to_vec(spec).unwrap()),
            None,
        )
        .await
    }

    pub async fn put_job_body(&self, id: &str, body: Vec<u8>, wait: Option<f64>) -> Reply {
        self.request(
            reqwest::Method::PUT,
            &self.job_url(id, wait),
            Some(body),
            None,
        )
        .await
    }

    pub async fn get_job(&self, id: &str, wait: Option<f64>) -> Reply {
        self.request(reqwest::Method::GET, &self.job_url(id, wait), None, None)
            .await
    }

    pub async fn delete_job(&self, id: &str) -> Reply {
        self.request(reqwest::Method::DELETE, &self.job_url(id, None), None, None)
            .await
    }

    pub async fn request(
        &self,
        method: reqwest::Method,
        url: &str,
        body: Option<Vec<u8>>,
        timeout: Option<Duration>,
    ) -> Reply {
        self.try_request(method, url, body, timeout)
            .await
            .unwrap_or_else(|error| panic!("{url}: {error}"))
    }

    pub async fn try_request(
        &self,
        method: reqwest::Method,
        url: &str,
        body: Option<Vec<u8>>,
        timeout: Option<Duration>,
    ) -> reqwest::Result<Reply> {
        let started = Instant::now();
        let mut builder = self.http.request(method, url);
        if let Some(body) = body {
            builder = builder
                .header("content-type", "application/json")
                .body(body);
        }
        if let Some(timeout) = timeout {
            builder = builder.timeout(timeout);
        }
        let response = builder.send().await?;
        let status = response.status().as_u16();
        let retry_after = response
            .headers()
            .get("retry-after")
            .map(|value| value.to_str().unwrap().to_string());
        let bytes = response.bytes().await?;
        let body = serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()));
        Ok(Reply {
            status,
            body,
            retry_after,
            elapsed: started.elapsed(),
        })
    }

    /// Long-polls `GET ?wait=` until the job ends.
    pub async fn wait_ended(&self, id: &str, limit: Duration) -> Value {
        let started = Instant::now();
        loop {
            let reply = self.get_job(id, Some(10.0)).await;
            if reply.status == 200 {
                return reply.body;
            }
            assert_eq!(reply.status, 202, "GET job {id}: {:?}", reply.body);
            assert!(
                started.elapsed() < limit,
                "job {id} still {} after {limit:?}: {}",
                reply.state(),
                reply.body
            );
        }
    }

    /// Polls until `check` accepts the job.
    pub async fn wait_for_job(
        &self,
        id: &str,
        limit: Duration,
        check: impl Fn(&Value) -> bool,
    ) -> Value {
        let started = Instant::now();
        loop {
            let reply = self.get_job(id, None).await;
            if reply.status < 300 && check(&reply.body) {
                return reply.body;
            }
            assert!(
                started.elapsed() < limit,
                "job {id} never got there in {limit:?}: {} {}",
                reply.status,
                reply.body
            );
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    /// Waits until the job runs and has read some source bytes.
    pub async fn wait_until_streaming(&self, id: &str) -> Value {
        self.wait_for_job(id, Duration::from_secs(60), |job| {
            if !matches!(job["state"].as_str(), Some("running") | Some("queued")) {
                panic!("job {id} ended before it was observed running: {job}");
            }
            job["state"] == "running" && job["progress"]["bytesRead"].as_u64().unwrap_or(0) > 0
        })
        .await
    }
}

/// Sends a request byte for byte, so paths like `/zip-jobs/..` arrive unnormalized. Returns
/// the status code and body.
pub fn raw_request(url: &str, method: &str, path: &[u8], body: &[u8]) -> (u16, String) {
    let address = url.trim_start_matches("http://");
    let mut stream = std::net::TcpStream::connect(address).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();

    let mut request = Vec::new();
    request.extend_from_slice(method.as_bytes());
    request.push(b' ');
    request.extend_from_slice(path);
    request.extend_from_slice(
        format!(
            " HTTP/1.1\r\nHost: {address}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        )
        .as_bytes(),
    );
    request.extend_from_slice(body);
    stream.write_all(&request).unwrap();

    let mut response = Vec::new();
    let _ = stream.read_to_end(&mut response);
    let response = String::from_utf8_lossy(&response).into_owned();
    let status = response
        .lines()
        .next()
        .and_then(|line| line.split(' ').nth(1))
        .and_then(|code| code.parse().ok())
        .unwrap_or_else(|| panic!("unexpected response: {response:?}"));
    let body = response
        .split_once("\r\n\r\n")
        .map(|(_, body)| body.to_string())
        .unwrap_or_default();
    (status, body)
}

pub fn urlencode(segment: &str) -> String {
    let mut out = String::with_capacity(segment.len());
    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

pub async fn collect<S>(stream: S) -> Vec<u8>
where
    S: Stream<Item = std::io::Result<Bytes>>,
{
    let mut out = Vec::new();
    futures::pin_mut!(stream);
    while let Some(chunk) = stream.next().await {
        out.extend_from_slice(&chunk.unwrap());
    }
    out
}
