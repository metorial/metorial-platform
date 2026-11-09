use bytes::{Bytes, BytesMut};
use futures::{Stream, StreamExt};
use sha2::{Digest, Sha256};
use std::pin::Pin;
use std::task::{Context, Poll};

use crate::backend::ByteStream;
use crate::error::{BackendError, BackendResult};

pub const SINGLE_REQUEST_THRESHOLD: usize = 8 * 1024 * 1024;

pub const MULTIPART_PART_SIZE: usize = 16 * 1024 * 1024;

pub const MAX_MULTIPART_PARTS: usize = 10_000;

pub struct ChunkedUpload {
    stream: ByteStream,
    buffer: BytesMut,
    hasher: Sha256,
    total: u64,
    eof: bool,
}

impl ChunkedUpload {
    pub fn new(stream: ByteStream) -> Self {
        Self {
            stream,
            buffer: BytesMut::new(),
            hasher: Sha256::new(),
            total: 0,
            eof: false,
        }
    }

    async fn pull(&mut self) -> BackendResult<bool> {
        match self.stream.next().await {
            Some(Ok(chunk)) => {
                self.hasher.update(&chunk);
                self.total += chunk.len() as u64;
                self.buffer.extend_from_slice(&chunk);
                Ok(true)
            }
            Some(Err(e)) => Err(BackendError::Provider(format!(
                "Failed to read stream: {}",
                e
            ))),
            None => {
                self.eof = true;
                Ok(false)
            }
        }
    }

    pub async fn fits_within(&mut self, limit: usize) -> BackendResult<bool> {
        while self.buffer.len() <= limit {
            if !self.pull().await? {
                return Ok(true);
            }
        }

        Ok(false)
    }

    pub fn take_buffered(&mut self) -> Bytes {
        self.buffer.split().freeze()
    }

    pub async fn next_part(&mut self, size: usize) -> BackendResult<Bytes> {
        while self.buffer.len() < size && !self.eof {
            self.pull().await?;
        }

        let take = size.min(self.buffer.len());
        Ok(self.buffer.split_to(take).freeze())
    }

    pub fn total_size(&self) -> u64 {
        self.total
    }

    pub fn etag(&self) -> String {
        hex::encode(self.hasher.clone().finalize())
    }

    pub fn into_stream(mut self) -> ByteStream {
        let buffered = self.buffer.split().freeze();
        if buffered.is_empty() {
            return self.stream;
        }

        Box::pin(futures::stream::once(async move { Ok(buffered) }).chain(self.stream))
    }
}

pub struct ChannelByteStream {
    receiver: tokio::sync::mpsc::Receiver<Result<Bytes, std::io::Error>>,
}

impl Stream for ChannelByteStream {
    type Item = Result<Bytes, std::io::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.get_mut().receiver.poll_recv(cx)
    }
}

pub fn into_sync_stream(mut stream: ByteStream) -> ChannelByteStream {
    let (sender, receiver) = tokio::sync::mpsc::channel(4);

    tokio::spawn(async move {
        while let Some(item) = stream.next().await {
            if sender.send(item).await.is_err() {
                break;
            }
        }
    });

    ChannelByteStream { receiver }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stream_of(chunks: Vec<&'static [u8]>) -> ByteStream {
        Box::pin(futures::stream::iter(
            chunks
                .into_iter()
                .map(|chunk| Ok(Bytes::from_static(chunk)))
                .collect::<Vec<_>>(),
        ))
    }

    #[tokio::test]
    async fn reports_a_small_object_as_fitting() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"hello ", b"world"]));

        assert!(upload.fits_within(64).await.unwrap());
        assert_eq!(&upload.take_buffered()[..], b"hello world");
        assert_eq!(upload.total_size(), 11);
    }

    #[tokio::test]
    async fn reports_an_object_on_the_threshold_as_fitting() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"12345"]));

        assert!(upload.fits_within(5).await.unwrap());
        assert_eq!(&upload.take_buffered()[..], b"12345");
    }

    #[tokio::test]
    async fn reports_an_object_over_the_threshold_as_not_fitting() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"123", b"456"]));

        assert!(!upload.fits_within(5).await.unwrap());
    }

    #[tokio::test]
    async fn stops_reading_once_the_threshold_is_passed() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"aaaa", b"bbbb", b"cccc", b"dddd"]));

        assert!(!upload.fits_within(4).await.unwrap());
        assert!(upload.total_size() < 16);
    }

    #[tokio::test]
    async fn splits_the_remainder_into_parts() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"aaaa", b"bbbb", b"cc"]));

        assert!(!upload.fits_within(2).await.unwrap());

        let mut parts = Vec::new();
        loop {
            let part = upload.next_part(4).await.unwrap();
            if part.is_empty() {
                break;
            }
            parts.push(String::from_utf8(part.to_vec()).unwrap());
        }

        assert_eq!(parts, vec!["aaaa", "bbbb", "cc"]);
        assert_eq!(upload.total_size(), 10);
    }

    #[tokio::test]
    async fn hashes_the_whole_object_across_parts() {
        let mut chunked = ChunkedUpload::new(stream_of(vec![b"aaaa", b"bbbb"]));
        assert!(!chunked.fits_within(2).await.unwrap());
        while !chunked.next_part(3).await.unwrap().is_empty() {}

        let mut whole = ChunkedUpload::new(stream_of(vec![b"aaaabbbb"]));
        assert!(whole.fits_within(64).await.unwrap());

        assert_eq!(chunked.etag(), whole.etag());
    }

    #[tokio::test]
    async fn surfaces_stream_errors() {
        let stream: ByteStream = Box::pin(futures::stream::iter(vec![
            Ok(Bytes::from_static(b"ok")),
            Err(std::io::Error::other("boom")),
        ]));

        let result = ChunkedUpload::new(stream).fits_within(1024).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn into_stream_replays_buffered_bytes_first() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"aaaa", b"bbbb", b"cccc"]));
        assert!(!upload.fits_within(2).await.unwrap());

        let mut stream = upload.into_stream();
        let mut seen = Vec::new();
        while let Some(chunk) = stream.next().await {
            seen.extend_from_slice(&chunk.unwrap());
        }

        assert_eq!(seen, b"aaaabbbbcccc");
    }

    #[tokio::test]
    async fn sync_stream_forwards_every_chunk() {
        let mut stream = into_sync_stream(stream_of(vec![b"aaaa", b"bbbb"]));

        let mut seen = Vec::new();
        while let Some(chunk) = stream.next().await {
            seen.extend_from_slice(&chunk.unwrap());
        }

        assert_eq!(seen, b"aaaabbbb");
    }

    #[test]
    fn sync_stream_is_send_and_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<ChannelByteStream>();
    }
}
