use bytes::Bytes;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use sha2::{Digest, Sha256};
use tokio::sync::mpsc;

use crate::backend::ByteStream;
use crate::error::{BackendError, BackendResult};

/// Chunks read ahead of the hashing thread by `digest_stream`.
const READ_AHEAD_CHUNKS: usize = 16;

/// Digests of an object's content, all computed in one pass over its bytes.
///
/// `git_blob_sha1` is the object id git gives the content as a blob: the SHA-1 of
/// `blob <size>\0` followed by the bytes. The size comes first, so it is only computed when the
/// size was known before the first byte arrived.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContentDigests {
    pub size: u64,
    pub sha256: String,
    pub crc32: u32,
    pub git_blob_sha1: Option<String>,
}

/// Hashes content incrementally. With an expected size it also computes the git blob id, and
/// refuses content that turns out longer or shorter than expected.
#[derive(Clone)]
pub struct ContentDigester {
    size: u64,
    expected_size: Option<u64>,
    sha256: Sha256,
    crc32: crc32fast::Hasher,
    git_blob: Option<Sha1>,
}

impl ContentDigester {
    pub fn new(expected_size: Option<u64>) -> Self {
        let git_blob = expected_size.map(|size| {
            let mut hasher = Sha1::new();
            hasher.update(format!("blob {}\0", size).as_bytes());
            hasher
        });

        Self {
            size: 0,
            expected_size,
            sha256: Sha256::new(),
            crc32: crc32fast::Hasher::new(),
            git_blob,
        }
    }

    pub fn update(&mut self, data: &[u8]) -> BackendResult<()> {
        let size = self
            .size
            .checked_add(data.len() as u64)
            .ok_or_else(|| BackendError::TooLarge("content exceeds 2^64 bytes".to_string()))?;

        if let Some(expected) = self.expected_size {
            if size > expected {
                return Err(BackendError::SizeMismatch(format!(
                    "the content is more than the {} bytes expected",
                    expected
                )));
            }
        }

        self.size = size;
        self.sha256.update(data);
        self.crc32.update(data);
        if let Some(git_blob) = &mut self.git_blob {
            git_blob.update(data);
        }

        Ok(())
    }

    pub fn size(&self) -> u64 {
        self.size
    }

    /// Fails when the content ended before the expected size.
    pub fn check_complete(&self) -> BackendResult<()> {
        match self.expected_size {
            Some(expected) if self.size != expected => Err(BackendError::SizeMismatch(format!(
                "the content is {} bytes, not the {} expected",
                self.size, expected
            ))),
            _ => Ok(()),
        }
    }

    pub fn finish(self) -> BackendResult<ContentDigests> {
        self.check_complete()?;

        Ok(ContentDigests {
            size: self.size,
            sha256: hex::encode(self.sha256.finalize()),
            crc32: self.crc32.finalize(),
            git_blob_sha1: self.git_blob.map(|hasher| hex::encode(hasher.finalize())),
        })
    }
}

/// Digests a stream without holding it: chunks are hashed on a blocking thread while the next
/// ones are read, with at most `READ_AHEAD_CHUNKS` chunks between the two.
pub async fn digest_stream(
    mut stream: ByteStream,
    expected_size: Option<u64>,
) -> BackendResult<ContentDigests> {
    let (sender, mut receiver) = mpsc::channel::<Bytes>(READ_AHEAD_CHUNKS);

    let hashing = tokio::task::spawn_blocking(move || {
        let mut digester = ContentDigester::new(expected_size);
        while let Some(chunk) = receiver.blocking_recv() {
            digester.update(&chunk)?;
        }
        digester.finish()
    });

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if chunk.is_empty() {
            continue;
        }
        // The hashing thread only hangs up after refusing the content; its error says why.
        if sender.send(chunk).await.is_err() {
            break;
        }
    }
    drop(sender);

    hashing
        .await
        .map_err(|error| BackendError::Internal(format!("hashing task failed: {}", error)))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stream_of(chunks: Vec<Vec<u8>>) -> ByteStream {
        Box::pin(futures::stream::iter(
            chunks.into_iter().map(|chunk| Ok(Bytes::from(chunk))),
        ))
    }

    fn digest(data: &[u8], expected_size: Option<u64>) -> BackendResult<ContentDigests> {
        let mut digester = ContentDigester::new(expected_size);
        digester.update(data)?;
        digester.finish()
    }

    #[test]
    fn matches_git_and_reference_digests() {
        // `printf 'hello\n' | git hash-object --stdin`, `sha256sum` and `crc32`.
        let digests = digest(b"hello\n", Some(6)).unwrap();
        assert_eq!(digests.size, 6);
        assert_eq!(
            digests.git_blob_sha1.as_deref(),
            Some("ce013625030ba8dba906f756967f9e9ca394464a")
        );
        assert_eq!(
            digests.sha256,
            "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"
        );
        assert_eq!(digests.crc32, 0x363a_3020);
    }

    #[test]
    fn digests_empty_content() {
        let digests = digest(b"", Some(0)).unwrap();
        assert_eq!(digests.size, 0);
        assert_eq!(
            digests.git_blob_sha1.as_deref(),
            Some("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391")
        );
        assert_eq!(
            digests.sha256,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(digests.crc32, 0);
    }

    #[test]
    fn leaves_out_the_git_blob_id_without_an_expected_size() {
        let digests = digest(b"hello\n", None).unwrap();
        assert_eq!(digests.git_blob_sha1, None);
        assert_eq!(
            digests,
            ContentDigests {
                git_blob_sha1: None,
                ..digest(b"hello\n", Some(6)).unwrap()
            }
        );
    }

    #[test]
    fn gives_the_same_digests_however_the_content_is_split() {
        let data: Vec<u8> = (0..100_000u32).map(|i| (i * 31 % 251) as u8).collect();
        let whole = digest(&data, Some(data.len() as u64)).unwrap();

        let mut digester = ContentDigester::new(Some(data.len() as u64));
        for chunk in data.chunks(7_919) {
            digester.update(chunk).unwrap();
        }
        assert_eq!(digester.finish().unwrap(), whole);
    }

    #[test]
    fn refuses_content_longer_than_expected() {
        let mut digester = ContentDigester::new(Some(4));
        digester.update(b"abc").unwrap();
        assert!(matches!(
            digester.update(b"de"),
            Err(BackendError::SizeMismatch(_))
        ));
        assert_eq!(digester.size(), 3);
    }

    #[test]
    fn refuses_content_shorter_than_expected() {
        assert!(matches!(
            digest(b"abc", Some(4)),
            Err(BackendError::SizeMismatch(_))
        ));
    }

    #[tokio::test]
    async fn digests_a_stream_like_the_whole_content() {
        let data: Vec<u8> = (0..1_000_000u32).map(|i| (i % 256) as u8).collect();
        let chunks = data.chunks(65_536).map(<[u8]>::to_vec).collect::<Vec<_>>();
        let mut with_empty = chunks.clone();
        with_empty.insert(3, Vec::new());

        let streamed = digest_stream(stream_of(with_empty), Some(data.len() as u64))
            .await
            .unwrap();
        assert_eq!(streamed, digest(&data, Some(data.len() as u64)).unwrap());

        let unsized_digests = digest_stream(stream_of(chunks), None).await.unwrap();
        assert_eq!(unsized_digests.git_blob_sha1, None);
        assert_eq!(unsized_digests.sha256, streamed.sha256);
    }

    #[tokio::test]
    async fn stops_reading_a_stream_longer_than_expected() {
        let reads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counter = reads.clone();
        let stream: ByteStream = Box::pin(futures::stream::iter(0..10_000).map(move |_| {
            counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            Ok(Bytes::from_static(b"0123456789"))
        }));

        let result = digest_stream(stream, Some(15)).await;
        assert!(matches!(result, Err(BackendError::SizeMismatch(_))));
        assert!(reads.load(std::sync::atomic::Ordering::SeqCst) < 10_000);
    }

    #[tokio::test]
    async fn surfaces_stream_errors() {
        let stream: ByteStream = Box::pin(futures::stream::iter(vec![
            Ok(Bytes::from_static(b"ok")),
            Err(std::io::Error::other("connection reset")),
        ]));

        assert!(matches!(
            digest_stream(stream, None).await,
            Err(BackendError::Io(_))
        ));
    }
}
