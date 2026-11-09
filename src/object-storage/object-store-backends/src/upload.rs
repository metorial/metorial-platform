use bytes::{Buf, Bytes};
use futures::{Stream, StreamExt};
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::sync::mpsc;

use crate::backend::ByteStream;
use crate::digest::{ContentDigester, ContentDigests};
use crate::error::{BackendError, BackendResult};
use crate::multipart::{KIB, MIB};
use crate::uploader::Reservation;

pub const SINGLE_REQUEST_THRESHOLD: u64 = 8 * MIB;

const INITIAL_CAPACITY: usize = 64 * KIB as usize;

/// Cuts a byte stream into parts while hashing every byte that passes through. Bytes read from
/// the stream but not yet handed out stay in `pending` as the stream's own `Bytes`, so a chunk
/// that covers a whole part is passed on without copying. Part buffers grow with the data that
/// arrives instead of being allocated at full size up front.
///
/// A failing stream surfaces as `BackendError::Io` with the stream's own error, so callers can
/// tell a broken input apart from a failing backend. With an exact size, a stream that turns out
/// longer or shorter fails with `BackendError::SizeMismatch` before its last part is handed out.
pub struct ChunkedUpload {
    stream: ByteStream,
    pending: Bytes,
    digester: ContentDigester,
    eof: bool,
}

impl ChunkedUpload {
    pub fn new(stream: ByteStream) -> Self {
        Self::with_exact_size(stream, None)
    }

    pub fn with_exact_size(stream: ByteStream, exact_size: Option<u64>) -> Self {
        Self {
            stream,
            pending: Bytes::new(),
            digester: ContentDigester::new(exact_size),
            eof: false,
        }
    }

    async fn pull(&mut self) -> BackendResult<bool> {
        debug_assert!(self.pending.is_empty());

        while !self.eof {
            match self.stream.next().await {
                Some(Ok(chunk)) if chunk.is_empty() => {}
                Some(Ok(chunk)) => {
                    self.digester.update(&chunk)?;
                    self.pending = chunk;
                    return Ok(true);
                }
                Some(Err(e)) => return Err(BackendError::Io(e)),
                None => {
                    self.digester.check_complete()?;
                    self.eof = true;
                }
            }
        }

        Ok(false)
    }

    pub async fn is_exhausted(&mut self) -> BackendResult<bool> {
        if !self.pending.is_empty() {
            return Ok(false);
        }
        Ok(!self.pull().await?)
    }

    /// Returns the next `size` bytes, or fewer at the end of the stream.
    pub async fn next_part(&mut self, size: usize) -> BackendResult<Bytes> {
        self.read(size, None).await
    }

    /// Like `next_part`, but `reservation` is grown to cover the part buffer before every growth
    /// of the buffer.
    pub(crate) async fn next_part_within(
        &mut self,
        size: usize,
        reservation: &mut Reservation,
    ) -> BackendResult<Bytes> {
        self.read(size, Some(reservation)).await
    }

    async fn read(
        &mut self,
        size: usize,
        mut reservation: Option<&mut Reservation>,
    ) -> BackendResult<Bytes> {
        if size == 0 || (self.pending.is_empty() && !self.pull().await?) {
            return Ok(Bytes::new());
        }

        if self.pending.len() >= size {
            if let Some(reservation) = reservation {
                reservation.grow(size as u64, 0).await?;
            }
            return Ok(self.pending.split_to(size));
        }

        let mut buffer = Vec::new();

        loop {
            let take = (size - buffer.len()).min(self.pending.len());
            let needed = buffer.len() + take;

            if needed > buffer.capacity() {
                let capacity = match reservation.as_deref_mut() {
                    Some(reservation) => {
                        let granted = reservation
                            .grow(needed as u64, buffer.capacity() as u64)
                            .await?;
                        usize::try_from(granted).unwrap_or(usize::MAX)
                    }
                    None => buffer.capacity().saturating_mul(2).max(INITIAL_CAPACITY),
                };
                let capacity = capacity.clamp(needed, size);
                buffer.reserve_exact(capacity - buffer.len());
            }

            buffer.extend_from_slice(&self.pending[..take]);
            self.pending.advance(take);

            if buffer.len() == size || !self.pull().await? {
                break;
            }
        }

        Ok(Bytes::from(buffer))
    }

    pub fn total_size(&self) -> u64 {
        self.digester.size()
    }

    /// Digests of every byte read so far; of the whole stream once it is exhausted.
    pub fn digests(&self) -> BackendResult<ContentDigests> {
        self.digester.clone().finish()
    }
}

/// A `ByteStream` fed through a bounded channel, so a producer can write into an upload with
/// backpressure.
pub struct ChannelByteStream {
    receiver: mpsc::Receiver<Result<Bytes, std::io::Error>>,
}

impl ChannelByteStream {
    pub fn new(receiver: mpsc::Receiver<Result<Bytes, std::io::Error>>) -> Self {
        Self { receiver }
    }

    pub fn channel(capacity: usize) -> (mpsc::Sender<Result<Bytes, std::io::Error>>, Self) {
        let (sender, receiver) = mpsc::channel(capacity);
        (sender, Self::new(receiver))
    }
}

impl Stream for ChannelByteStream {
    type Item = Result<Bytes, std::io::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.get_mut().receiver.poll_recv(cx)
    }
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

    async fn parts_of(upload: &mut ChunkedUpload, size: usize) -> Vec<String> {
        let mut parts = Vec::new();
        loop {
            let part = upload.next_part(size).await.unwrap();
            if part.is_empty() {
                return parts;
            }
            parts.push(String::from_utf8(part.to_vec()).unwrap());
        }
    }

    #[tokio::test]
    async fn reads_a_short_head_to_the_end() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"hello ", b"world"]));

        assert_eq!(&upload.next_part(64).await.unwrap()[..], b"hello world");
        assert!(upload.is_exhausted().await.unwrap());
        assert_eq!(upload.total_size(), 11);
    }

    #[tokio::test]
    async fn stops_the_head_at_its_size() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"aaaa", b"bbbb", b"cccc", b"dddd"]));

        assert_eq!(&upload.next_part(6).await.unwrap()[..], b"aaaabb");
        assert!(!upload.is_exhausted().await.unwrap());
        assert!(upload.total_size() < 16);
    }

    #[tokio::test]
    async fn reports_an_exact_fit_as_exhausted_only_after_peeking() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"12345"]));

        assert_eq!(&upload.next_part(5).await.unwrap()[..], b"12345");
        assert!(upload.is_exhausted().await.unwrap());
        assert!(upload.next_part(5).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn splits_the_stream_into_parts_across_chunk_boundaries() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"aaaa", b"bbbb", b"cc"]));

        assert_eq!(
            parts_of(&mut upload, 3).await,
            vec!["aaa", "abb", "bbc", "c"]
        );
        assert_eq!(upload.total_size(), 10);
    }

    #[tokio::test]
    async fn hands_out_slices_of_large_chunks_without_copying() {
        let chunk = Bytes::from(vec![7u8; 10]);
        let address = chunk.as_ptr() as usize;
        let stream: ByteStream = Box::pin(futures::stream::iter(vec![Ok(chunk)]));
        let mut upload = ChunkedUpload::new(stream);

        let first = upload.next_part(4).await.unwrap();
        let second = upload.next_part(4).await.unwrap();

        assert_eq!(first.as_ptr() as usize, address);
        assert_eq!(second.as_ptr() as usize, address + 4);
        assert_eq!(upload.next_part(4).await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn skips_empty_chunks() {
        let mut upload = ChunkedUpload::new(stream_of(vec![b"", b"ab", b"", b"cd", b""]));

        assert_eq!(parts_of(&mut upload, 3).await, vec!["abc", "d"]);
        assert!(upload.is_exhausted().await.unwrap());
    }

    #[tokio::test]
    async fn hashes_the_whole_object_across_parts() {
        let mut chunked = ChunkedUpload::new(stream_of(vec![b"aaaa", b"bbbb"]));
        parts_of(&mut chunked, 3).await;

        let mut whole = ChunkedUpload::new(stream_of(vec![b"aaaabbbb"]));
        whole.next_part(64).await.unwrap();

        let chunked = chunked.digests().unwrap();
        assert_eq!(chunked, whole.digests().unwrap());
        assert_eq!(chunked.sha256, crate::backend::compute_etag(b"aaaabbbb"));
        assert_eq!(chunked.git_blob_sha1, None);
    }

    #[tokio::test]
    async fn computes_the_git_blob_id_with_an_exact_size() {
        let mut upload = ChunkedUpload::with_exact_size(stream_of(vec![b"hello", b"\n"]), Some(6));
        parts_of(&mut upload, 4).await;

        assert_eq!(
            upload.digests().unwrap().git_blob_sha1.as_deref(),
            Some("ce013625030ba8dba906f756967f9e9ca394464a")
        );
    }

    #[tokio::test]
    async fn refuses_a_stream_longer_than_its_exact_size() {
        let mut upload = ChunkedUpload::with_exact_size(stream_of(vec![b"aaaa", b"bbbb"]), Some(6));

        assert_eq!(&upload.next_part(4).await.unwrap()[..], b"aaaa");
        assert!(matches!(
            upload.next_part(4).await,
            Err(BackendError::SizeMismatch(_))
        ));
    }

    #[tokio::test]
    async fn refuses_a_stream_shorter_than_its_exact_size_once_it_ends() {
        let mut upload = ChunkedUpload::with_exact_size(stream_of(vec![b"aaaa"]), Some(6));

        assert_eq!(&upload.next_part(4).await.unwrap()[..], b"aaaa");
        assert!(matches!(
            upload.is_exhausted().await,
            Err(BackendError::SizeMismatch(_))
        ));
    }

    #[tokio::test]
    async fn surfaces_stream_errors() {
        let stream: ByteStream = Box::pin(futures::stream::iter(vec![
            Ok(Bytes::from_static(b"ok")),
            Err(std::io::Error::other("boom")),
        ]));

        let result = ChunkedUpload::new(stream).next_part(1024).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn channel_stream_forwards_every_chunk() {
        let (sender, mut stream) = ChannelByteStream::channel(1);

        tokio::spawn(async move {
            for chunk in [&b"aaaa"[..], &b"bbbb"[..]] {
                sender.send(Ok(Bytes::from_static(chunk))).await.unwrap();
            }
        });

        let mut seen = Vec::new();
        while let Some(chunk) = stream.next().await {
            seen.extend_from_slice(&chunk.unwrap());
        }

        assert_eq!(seen, b"aaaabbbb");
    }

    #[test]
    fn channel_stream_is_send_and_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<ChannelByteStream>();
    }
}
