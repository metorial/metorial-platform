use bytes::Bytes;
use chrono::{DateTime, Utc};
use reqwest::{Method, RequestBuilder, Response, StatusCode};
use std::collections::HashMap;
use std::sync::Arc;
use token_source::TokenSource;

use crate::backend::normalize_etag;
use crate::durable::{DurablePart, DurablePartRef, DurableUpload};
use crate::error::{is_transient_status, BackendError, BackendResult};

pub const DEFAULT_XML_ENDPOINT: &str = "https://storage.googleapis.com";

/// GCS's XML API multipart upload, which has S3 semantics: an upload id that is not a credential,
/// numbered parts that can be sent from any process and replaced by sending the number again. The
/// JSON API's resumable sessions can't replace bytes they already hold, so durable uploads use
/// this instead.
pub struct GcsXmlApi {
    http: reqwest::Client,
    endpoint: String,
    bucket: String,
    token: Option<Arc<dyn TokenSource>>,
}

impl GcsXmlApi {
    pub fn new(
        http: reqwest::Client,
        endpoint: Option<&str>,
        bucket: String,
        token: Option<Arc<dyn TokenSource>>,
    ) -> Self {
        Self {
            http,
            endpoint: endpoint
                .unwrap_or(DEFAULT_XML_ENDPOINT)
                .trim_end_matches('/')
                .to_string(),
            bucket,
            token,
        }
    }

    fn object_url(&self, key: &str) -> String {
        format!(
            "{}/{}/{}",
            self.endpoint,
            encode_segment(&self.bucket),
            encode_object_name(key)
        )
    }

    async fn request(&self, method: Method, url: &str) -> BackendResult<RequestBuilder> {
        let builder = self.http.request(method, url);

        match &self.token {
            Some(token) => {
                let value = token.token().await.map_err(|e| {
                    BackendError::Retryable(format!("Failed to get a GCS access token: {}", e))
                })?;
                Ok(builder.header(reqwest::header::AUTHORIZATION, value))
            }
            None => Ok(builder),
        }
    }

    async fn send(&self, action: &str, key: &str, builder: RequestBuilder) -> BackendResult<Response> {
        builder.send().await.map_err(|e| {
            let message = format!("Failed to {} '{}': {}", action, key, e);
            if e.is_timeout() || e.is_connect() || e.is_request() {
                BackendError::Retryable(message)
            } else {
                BackendError::Provider(message)
            }
        })
    }

    pub async fn start(
        &self,
        key: &str,
        content_type: Option<&str>,
        metadata: &HashMap<String, String>,
    ) -> BackendResult<String> {
        let url = format!("{}?uploads", self.object_url(key));
        let mut builder = self
            .request(Method::POST, &url)
            .await?
            .header(reqwest::header::CONTENT_LENGTH, 0);

        if let Some(content_type) = content_type {
            builder = builder.header(reqwest::header::CONTENT_TYPE, content_type);
        }
        for (name, value) in metadata {
            builder = builder.header(format!("x-goog-meta-{}", name), value);
        }

        let response = self.send("start upload of", key, builder).await?;
        let body = checked_body("start upload of", key, response).await?;

        tag_text(&body, "UploadId").ok_or_else(|| {
            BackendError::Provider(format!("GCS returned no upload id for '{}'", key))
        })
    }

    pub async fn upload_part(
        &self,
        key: &str,
        upload_id: &str,
        number: u32,
        data: Bytes,
    ) -> BackendResult<DurablePart> {
        let size = data.len() as u64;
        let builder = self
            .request(Method::PUT, &self.object_url(key))
            .await?
            .query(&[("partNumber", number.to_string()), ("uploadId", upload_id.to_string())])
            .header(reqwest::header::CONTENT_LENGTH, size)
            .body(data);

        let action = format!("upload part {} of", number);
        let response = self.send(&action, key, builder).await?;
        let etag = response
            .headers()
            .get(reqwest::header::ETAG)
            .and_then(|value| value.to_str().ok())
            .map(normalize_etag);
        checked_body(&action, key, response).await?;

        let etag = etag.ok_or_else(|| {
            BackendError::Provider(format!("GCS returned no etag for part {} of '{}'", number, key))
        })?;
        Ok(DurablePart { number, size, etag })
    }

    pub async fn complete(
        &self,
        key: &str,
        upload_id: &str,
        parts: &[DurablePartRef],
    ) -> BackendResult<()> {
        let builder = self
            .request(Method::POST, &self.object_url(key))
            .await?
            .query(&[("uploadId", upload_id)])
            .header(reqwest::header::CONTENT_TYPE, "application/xml")
            .body(complete_body(parts));

        let response = self.send("complete upload of", key, builder).await?;
        let body = checked_body("complete upload of", key, response).await?;

        // Like S3, a completion can fail after a 200 status line, with the error in the body.
        if let Some(code) = tag_text(&body, "Code") {
            return Err(error_for(StatusCode::INTERNAL_SERVER_ERROR, &code, "complete upload of", key, &body));
        }
        Ok(())
    }

    pub async fn abort(&self, key: &str, upload_id: &str) -> BackendResult<()> {
        let builder = self
            .request(Method::DELETE, &self.object_url(key))
            .await?
            .query(&[("uploadId", upload_id)]);

        let response = self.send("abort upload of", key, builder).await?;
        match checked_body("abort upload of", key, response).await {
            Ok(_) | Err(BackendError::NotFound(_)) => Ok(()),
            Err(e) => Err(e),
        }
    }

    pub async fn list(&self, prefix: &str) -> BackendResult<Vec<DurableUpload>> {
        let url = format!("{}/{}?uploads", self.endpoint, encode_segment(&self.bucket));
        let mut uploads = Vec::new();
        let mut markers: Option<(String, String)> = None;

        loop {
            let mut query = vec![("prefix", prefix.to_string())];
            if let Some((key_marker, upload_id_marker)) = &markers {
                query.push(("key-marker", key_marker.clone()));
                query.push(("upload-id-marker", upload_id_marker.clone()));
            }
            let builder = self.request(Method::GET, &url).await?.query(&query);
            let response = self.send("list uploads in", &self.bucket, builder).await?;
            let body = checked_body("list uploads in", &self.bucket, response).await?;

            let page = parse_upload_listing(&body);
            uploads.extend(page.uploads);

            match page.next {
                Some(next) if page.truncated => markers = Some(next),
                _ => return Ok(uploads),
            }
        }
    }
}

async fn checked_body(action: &str, key: &str, response: Response) -> BackendResult<String> {
    let status = response.status();
    let body = response.text().await.map_err(|e| {
        BackendError::Retryable(format!("Failed to read the response to {} '{}': {}", action, key, e))
    })?;

    if status.is_success() {
        return Ok(body);
    }
    let code = tag_text(&body, "Code").unwrap_or_default();
    Err(error_for(status, &code, action, key, &body))
}

fn error_for(status: StatusCode, code: &str, action: &str, key: &str, body: &str) -> BackendError {
    let message = format!("Failed to {} '{}': {} {}", action, key, status, body.trim());

    match code {
        "NoSuchUpload" => BackendError::NotFound(message),
        "InvalidPart" | "InvalidPartOrder" | "EntityTooSmall" | "InvalidArgument" => {
            BackendError::InvalidRequest(message)
        }
        _ if status == StatusCode::NOT_FOUND => BackendError::NotFound(message),
        _ if is_transient_status(status.as_u16()) => BackendError::Retryable(message),
        _ => BackendError::Provider(message),
    }
}

pub(crate) fn encode_segment(segment: &str) -> String {
    let mut encoded = String::with_capacity(segment.len());
    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

pub(crate) fn encode_object_name(key: &str) -> String {
    key.split('/').map(encode_segment).collect::<Vec<_>>().join("/")
}

pub(crate) fn complete_body(parts: &[DurablePartRef]) -> String {
    let mut body = String::from("<CompleteMultipartUpload>");
    for part in parts {
        body.push_str(&format!(
            "<Part><PartNumber>{}</PartNumber><ETag>\"{}\"</ETag></Part>",
            part.number,
            escape_xml(&part.etag)
        ));
    }
    body.push_str("</CompleteMultipartUpload>");
    body
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn unescape_xml(value: &str) -> String {
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

/// The text of the first `<tag>` element. The responses this module reads are flat and
/// machine-generated, so a full XML parser would buy nothing.
pub(crate) fn tag_text(xml: &str, tag: &str) -> Option<String> {
    elements(xml, tag).into_iter().next().map(|text| unescape_xml(text.trim()))
}

fn elements<'a>(xml: &'a str, tag: &str) -> Vec<&'a str> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let mut found = Vec::new();
    let mut rest = xml;

    while let Some(start) = rest.find(&open) {
        let after = &rest[start + open.len()..];
        let Some(end) = after.find(&close) else {
            break;
        };
        found.push(&after[..end]);
        rest = &after[end + close.len()..];
    }
    found
}

pub(crate) struct UploadListing {
    pub uploads: Vec<DurableUpload>,
    pub truncated: bool,
    pub next: Option<(String, String)>,
}

pub(crate) fn parse_upload_listing(xml: &str) -> UploadListing {
    let uploads = elements(xml, "Upload")
        .into_iter()
        .filter_map(|upload| {
            Some(DurableUpload {
                key: tag_text(upload, "Key")?,
                upload_id: tag_text(upload, "UploadId")?,
                initiated: tag_text(upload, "Initiated")
                    .and_then(|time| DateTime::parse_from_rfc3339(&time).ok())
                    .map(|time| time.with_timezone(&Utc)),
            })
        })
        .collect();

    let truncated = tag_text(xml, "IsTruncated").is_some_and(|value| value == "true");
    let next = match (tag_text(xml, "NextKeyMarker"), tag_text(xml, "NextUploadIdMarker")) {
        (Some(key), Some(upload_id)) if !key.is_empty() => Some((key, upload_id)),
        _ => None,
    };

    UploadListing {
        uploads,
        truncated,
        next,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_object_names_keeping_separators() {
        assert_eq!(encode_object_name("exports/a b/c+d.gz"), "exports/a%20b/c%2Bd.gz");
        assert_eq!(encode_object_name("ü"), "%C3%BC");
    }

    #[test]
    fn builds_the_completion_body() {
        let body = complete_body(&[
            DurablePartRef {
                number: 1,
                etag: "abc".to_string(),
            },
            DurablePartRef {
                number: 2,
                etag: "d<e".to_string(),
            },
        ]);
        assert_eq!(
            body,
            "<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>\"abc\"</ETag></Part>\
             <Part><PartNumber>2</PartNumber><ETag>\"d&lt;e\"</ETag></Part></CompleteMultipartUpload>"
        );
    }

    #[test]
    fn reads_the_upload_id() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
            <InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
              <Bucket>b</Bucket><Key>a&amp;b</Key><UploadId>ABPnzm5Y-x_1</UploadId>
            </InitiateMultipartUploadResult>"#;
        assert_eq!(tag_text(xml, "UploadId").as_deref(), Some("ABPnzm5Y-x_1"));
        assert_eq!(tag_text(xml, "Key").as_deref(), Some("a&b"));
        assert_eq!(tag_text(xml, "Missing"), None);
    }

    #[test]
    fn parses_upload_listings() {
        let xml = r#"<ListMultipartUploadsResult>
              <Bucket>b</Bucket>
              <NextKeyMarker>exports/b</NextKeyMarker>
              <NextUploadIdMarker>id-b</NextUploadIdMarker>
              <IsTruncated>true</IsTruncated>
              <Upload><Key>exports/a</Key><UploadId>id-a</UploadId><Initiated>2026-11-01T10:00:00.000Z</Initiated></Upload>
              <Upload><Key>exports/b</Key><UploadId>id-b</UploadId><Initiated>2026-11-02T10:00:00Z</Initiated></Upload>
            </ListMultipartUploadsResult>"#;

        let listing = parse_upload_listing(xml);
        assert!(listing.truncated);
        assert_eq!(
            listing.next,
            Some(("exports/b".to_string(), "id-b".to_string()))
        );
        assert_eq!(listing.uploads.len(), 2);
        assert_eq!(listing.uploads[0].key, "exports/a");
        assert_eq!(
            listing.uploads[0].initiated.unwrap().to_rfc3339(),
            "2026-11-01T10:00:00+00:00"
        );
        assert!(!parse_upload_listing("<ListMultipartUploadsResult/>").truncated);
    }

    #[test]
    fn maps_provider_errors() {
        let gone = error_for(StatusCode::NOT_FOUND, "NoSuchUpload", "complete", "a", "");
        assert!(matches!(gone, BackendError::NotFound(_)));
        let small = error_for(StatusCode::BAD_REQUEST, "EntityTooSmall", "complete", "a", "");
        assert!(matches!(small, BackendError::InvalidRequest(_)));
        let busy = error_for(StatusCode::SERVICE_UNAVAILABLE, "", "complete", "a", "");
        assert!(matches!(busy, BackendError::Retryable(_)));
        let denied = error_for(StatusCode::FORBIDDEN, "AccessDenied", "complete", "a", "");
        assert!(matches!(denied, BackendError::Provider(_)));
    }
}
