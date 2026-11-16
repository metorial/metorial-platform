use std::sync::{Arc, OnceLock};

use flate2::{Compress, Compression, FlushCompress, Status};
use object_store_backends::multipart::{KIB, MIB};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tokio::task::JoinHandle;

use super::bounds::{deflate_block_upper_bound, deflate_upper_bound};
use super::error::ZipJobError;
use super::spec::CompressionHint;
use super::writer::Method;

/// Input block size for Deflate. Input is always cut into exactly these blocks, so the compressed
/// bytes don't depend on how the source happened to chunk its stream.
pub const DEFLATE_BLOCK_BYTES: usize = MIB as usize;

/// How much of a large `auto` entry is compressed to decide between Deflate and stored.
pub const SAMPLE_BYTES: usize = 256 * KIB as usize;

/// A large `auto` entry is deflated only if its sample compresses to at most this percentage of
/// its size (saves at least 10%); otherwise Deflate costs CPU for too little gain.
pub const SAMPLE_MAX_RATIO_PERCENT: usize = 90;

/// Inputs up to this size are compressed on the calling task: handing them to the blocking
/// pool would cost more than compressing them.
const INLINE_COMPRESSION_BYTES: usize = 16 * KIB as usize;

const OUTPUT_GROWTH_BYTES: usize = 64 * KIB as usize;

/// Under `auto`, files with these extensions are stored without trying Deflate.
pub const PRECOMPRESSED_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "avif", "heic", "mp3", "mp4", "mov", "webm", "zip", "gz",
    "tgz", "bz2", "xz", "zst", "7z", "rar", "woff", "woff2", "pdf",
];

/// Under `auto`, sources with these content types are stored without trying Deflate.
pub const PRECOMPRESSED_CONTENT_TYPES: &[&str] = &[
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/heic",
    "audio/mpeg",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "application/zip",
    "application/gzip",
    "application/x-gzip",
    "application/x-bzip2",
    "application/x-xz",
    "application/zstd",
    "application/x-7z-compressed",
    "application/vnd.rar",
    "application/x-rar-compressed",
    "font/woff",
    "font/woff2",
    "application/pdf",
];

/// How an entry is written, decided from the spec and the source's HEAD before any data is read.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntryPlan {
    /// Stored with known sizes; the source is not read.
    Empty,
    /// Fetched whole, then written with known sizes (no data descriptor).
    Small(SmallMode),
    /// Streamed when its turn comes.
    Large(LargeMode),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmallMode {
    Store,
    Deflate,
    /// Deflate, kept only if strictly smaller than the data.
    Smaller,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LargeMode {
    Store,
    Deflate,
    /// Deflate if the first `SAMPLE_BYTES` compress well enough, otherwise stored.
    Sample,
}

impl EntryPlan {
    pub fn decide(
        hint: CompressionHint,
        archive_path: &str,
        content_type: Option<&str>,
        size: u64,
        small_entry_bytes: u64,
    ) -> EntryPlan {
        if size == 0 {
            return EntryPlan::Empty;
        }

        let auto_stores = || is_precompressed(archive_path, content_type);

        if size <= small_entry_bytes {
            EntryPlan::Small(match hint {
                CompressionHint::Store => SmallMode::Store,
                CompressionHint::Deflate => SmallMode::Deflate,
                CompressionHint::Auto if auto_stores() => SmallMode::Store,
                CompressionHint::Auto => SmallMode::Smaller,
            })
        } else {
            EntryPlan::Large(match hint {
                CompressionHint::Store => LargeMode::Store,
                CompressionHint::Deflate => LargeMode::Deflate,
                CompressionHint::Auto if auto_stores() => LargeMode::Store,
                CompressionHint::Auto => LargeMode::Sample,
            })
        }
    }

    /// Upper bound on the entry's data bytes in the archive.
    pub fn max_data_size(&self, size: u64) -> u64 {
        match self {
            EntryPlan::Empty => 0,
            EntryPlan::Small(SmallMode::Store | SmallMode::Smaller)
            | EntryPlan::Large(LargeMode::Store) => size,
            EntryPlan::Small(SmallMode::Deflate)
            | EntryPlan::Large(LargeMode::Deflate | LargeMode::Sample) => deflate_upper_bound(size),
        }
    }
}

pub fn is_precompressed(path: &str, content_type: Option<&str>) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path);
    let by_extension = name
        .rsplit_once('.')
        .filter(|(stem, _)| !stem.is_empty())
        .is_some_and(|(_, extension)| {
            PRECOMPRESSED_EXTENSIONS
                .iter()
                .any(|known| extension.eq_ignore_ascii_case(known))
        });

    let by_content_type = content_type.is_some_and(|content_type| {
        let essence = content_type.split(';').next().unwrap_or("").trim();
        PRECOMPRESSED_CONTENT_TYPES
            .iter()
            .any(|known| essence.eq_ignore_ascii_case(known))
    });

    by_extension || by_content_type
}

/// A whole small entry, ready to write.
pub struct CompressedEntry {
    pub method: Method,
    pub data: Vec<u8>,
}

/// Compresses `data` according to `mode`. Large inputs run on the blocking pool under the
/// process-wide compression limit.
pub async fn compress_small(
    mode: SmallMode,
    level: u32,
    data: Vec<u8>,
) -> Result<CompressedEntry, ZipJobError> {
    let data_len = data.len();
    let work = move || -> Result<CompressedEntry, ZipJobError> {
        match mode {
            SmallMode::Store => Ok(CompressedEntry {
                method: Method::Stored,
                data,
            }),
            SmallMode::Deflate => Ok(CompressedEntry {
                method: Method::Deflate,
                data: deflate_all(level, &data, None)?
                    .ok_or_else(|| ZipJobError::internal("unbounded Deflate output overflowed"))?,
            }),
            SmallMode::Smaller => {
                let limit = data.len().saturating_sub(1);
                Ok(match deflate_all(level, &data, Some(limit))? {
                    Some(compressed) => CompressedEntry {
                        method: Method::Deflate,
                        data: compressed,
                    },
                    None => CompressedEntry {
                        method: Method::Stored,
                        data,
                    },
                })
            }
        }
    };

    if mode == SmallMode::Store || data_len <= INLINE_COMPRESSION_BYTES {
        return work();
    }
    run_compression(work).await?.await.map_err(join_error)?
}

/// Whether a sample compresses to at most `SAMPLE_MAX_RATIO_PERCENT` of its size.
pub async fn sample_compresses(level: u32, sample: bytes::Bytes) -> Result<bool, ZipJobError> {
    let limit = sample.len() * SAMPLE_MAX_RATIO_PERCENT / 100;
    let compressed = run_compression(move || deflate_all(level, &sample, Some(limit)))
        .await?
        .await
        .map_err(join_error)??;
    Ok(compressed.is_some())
}

/// Raw Deflate of `input` in one stream, cut into `DEFLATE_BLOCK_BYTES` blocks. `None` if the
/// output would exceed `limit` bytes.
pub fn deflate_all(
    level: u32,
    input: &[u8],
    limit: Option<usize>,
) -> Result<Option<Vec<u8>>, ZipJobError> {
    let capacity = input
        .len()
        .max(1)
        .min(usize::try_from(deflate_upper_bound(input.len() as u64)).unwrap_or(usize::MAX))
        .min(limit.unwrap_or(usize::MAX));
    if capacity == 0 {
        return Ok(None);
    }

    let mut deflater = Deflater::new(level);
    let mut out = Vec::with_capacity(capacity);

    let mut blocks = input.chunks(DEFLATE_BLOCK_BYTES).peekable();
    if blocks.peek().is_none() {
        let fits = deflater.compress(&[], true, &mut out, limit)?;
        return Ok(fits.then_some(out));
    }

    while let Some(block) = blocks.next() {
        let last = blocks.peek().is_none();
        if !deflater.compress(block, last, &mut out, limit)? {
            return Ok(None);
        }
    }
    Ok(Some(out))
}

/// Raw Deflate of one block of a large entry, compressed on its own so that the blocks of an
/// entry can be compressed in parallel. The entry's data is the concatenation of its blocks.
///
/// Every block starts from a fresh compressor, so it never refers back into an earlier block.
/// A block that is not `last` ends with a sync flush: an empty stored block, which leaves the
/// output byte-aligned and does not set BFINAL. Only the `last` block (which may be empty) sets
/// BFINAL. The concatenation is therefore one valid raw Deflate stream.
pub fn deflate_block(level: u32, input: &[u8], last: bool) -> Result<Vec<u8>, ZipJobError> {
    let flush = if last {
        FlushCompress::Finish
    } else {
        FlushCompress::Sync
    };

    // When miniz_oxide fills the output mid-block, its next call only drains what it held back
    // and then reports a sync flush as done although buffered input was never compressed. So a
    // block is compressed in a single call, into more room than it can need.
    let mut capacity = deflate_block_upper_bound(input.len() as u64) as usize + 1;
    loop {
        let mut compress = Compress::new(Compression::new(level), false);
        let mut out = Vec::with_capacity(capacity);
        let status = compress
            .compress_vec(input, &mut out, flush)
            .map_err(|error| ZipJobError::internal(format!("Deflate failed: {}", error)))?;

        let consumed = compress.total_in() == input.len() as u64;
        let ended = !last || status == Status::StreamEnd;
        if consumed && ended && out.len() < out.capacity() {
            out.shrink_to_fit();
            return Ok(out);
        }
        capacity = capacity.saturating_mul(2);
    }
}

/// Raw Deflate state for one entry, fed block by block.
pub struct Deflater {
    compress: Compress,
}

impl Deflater {
    pub fn new(level: u32) -> Self {
        Deflater {
            compress: Compress::new(Compression::new(level), false),
        }
    }

    /// Feeds one block and appends whatever output it produces to `out`; `finish` ends the
    /// stream. Returns `false`, leaving the stream unusable, if `out` would grow past `limit`.
    pub fn compress(
        &mut self,
        input: &[u8],
        finish: bool,
        out: &mut Vec<u8>,
        limit: Option<usize>,
    ) -> Result<bool, ZipJobError> {
        let flush = if finish {
            FlushCompress::Finish
        } else {
            FlushCompress::None
        };
        let start = self.compress.total_in();

        loop {
            let consumed = (self.compress.total_in() - start) as usize;

            if out.len() == out.capacity() {
                let room = match limit {
                    Some(limit) if out.len() >= limit => return Ok(false),
                    Some(limit) => limit - out.len(),
                    None => usize::MAX,
                };
                let wanted = (input.len() - consumed).max(OUTPUT_GROWTH_BYTES);
                out.reserve_exact(wanted.min(room));
            }

            let produced_before = out.len();
            let status = self
                .compress
                .compress_vec(&input[consumed..], out, flush)
                .map_err(|error| ZipJobError::internal(format!("Deflate failed: {}", error)))?;
            let consumed_now = (self.compress.total_in() - start) as usize;
            let within_limit = limit.is_none_or(|limit| out.len() <= limit);

            match status {
                Status::StreamEnd => return Ok(within_limit),
                Status::Ok | Status::BufError => {
                    let has_room = out.len() < out.capacity();
                    if !finish && consumed_now == input.len() && has_room {
                        return Ok(within_limit);
                    }
                    if has_room && consumed_now == consumed && out.len() == produced_before {
                        return Err(ZipJobError::internal("Deflate made no progress"));
                    }
                }
            }
        }
    }
}

/// Starts `work` on the blocking pool once one of the process-wide compression slots is free,
/// so concurrent jobs share the CPU instead of piling work onto it.
pub async fn run_compression<T, F>(work: F) -> Result<JoinHandle<T>, ZipJobError>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    Ok(spawn_compression(compression_slot().await?, work))
}

/// Waits for one of the process-wide compression slots.
pub async fn compression_slot() -> Result<OwnedSemaphorePermit, ZipJobError> {
    compression_slots()
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| ZipJobError::internal("compression slots are closed"))
}

/// A compression slot if one is free right now and nobody is queued for it.
pub fn try_compression_slot() -> Option<OwnedSemaphorePermit> {
    compression_slots().clone().try_acquire_owned().ok()
}

/// Runs `work` on the blocking pool, holding `slot` until it is done.
pub fn spawn_compression<T, F>(slot: OwnedSemaphorePermit, work: F) -> JoinHandle<T>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    tokio::task::spawn_blocking(move || {
        let result = work();
        drop(slot);
        result
    })
}

/// Process-wide compression slots, one per CPU.
pub fn compression_slots() -> &'static Arc<Semaphore> {
    static SLOTS: OnceLock<Arc<Semaphore>> = OnceLock::new();
    SLOTS.get_or_init(|| Arc::new(Semaphore::new(cpu_count())))
}

pub fn cpu_count() -> usize {
    static CPUS: OnceLock<usize> = OnceLock::new();
    *CPUS.get_or_init(|| std::thread::available_parallelism().map_or(4, |n| n.get()))
}

pub fn join_error(error: tokio::task::JoinError) -> ZipJobError {
    ZipJobError::internal(format!("compression task failed: {}", error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn inflate(data: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        flate2::read::DeflateDecoder::new(data)
            .read_to_end(&mut out)
            .unwrap();
        out
    }

    fn noise(len: usize) -> Vec<u8> {
        let mut state = 0x9E37_79B9_7F4A_7C15u64;
        (0..len)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 7;
                state ^= state << 17;
                state as u8
            })
            .collect()
    }

    #[test]
    fn decides_by_hint_extension_content_type_and_size() {
        let decide =
            |hint, path, content_type, size| EntryPlan::decide(hint, path, content_type, size, MIB);

        assert_eq!(
            decide(CompressionHint::Deflate, "a.txt", None, 0),
            EntryPlan::Empty
        );
        assert_eq!(
            decide(CompressionHint::Auto, "a.txt", None, 10),
            EntryPlan::Small(SmallMode::Smaller)
        );
        assert_eq!(
            decide(CompressionHint::Auto, "a/b.PNG", None, 10),
            EntryPlan::Small(SmallMode::Store)
        );
        assert_eq!(
            decide(CompressionHint::Auto, "blob", Some("image/jpeg; q=1"), 10),
            EntryPlan::Small(SmallMode::Store)
        );
        assert_eq!(
            decide(CompressionHint::Deflate, "a.zip", None, 10),
            EntryPlan::Small(SmallMode::Deflate)
        );
        assert_eq!(
            decide(CompressionHint::Store, "a.txt", None, MIB),
            EntryPlan::Small(SmallMode::Store)
        );
        assert_eq!(
            decide(CompressionHint::Auto, "a.txt", None, MIB + 1),
            EntryPlan::Large(LargeMode::Sample)
        );
        assert_eq!(
            decide(CompressionHint::Auto, "movie.mp4", None, MIB + 1),
            EntryPlan::Large(LargeMode::Store)
        );
        assert_eq!(
            decide(CompressionHint::Deflate, "movie.mp4", None, MIB + 1),
            EntryPlan::Large(LargeMode::Deflate)
        );
        assert_eq!(
            decide(CompressionHint::Auto, ".png", None, 10),
            EntryPlan::Small(SmallMode::Smaller)
        );
    }

    #[test]
    fn bounds_data_by_plan() {
        assert_eq!(EntryPlan::Empty.max_data_size(0), 0);
        assert_eq!(EntryPlan::Small(SmallMode::Smaller).max_data_size(100), 100);
        assert_eq!(EntryPlan::Large(LargeMode::Store).max_data_size(100), 100);
        assert_eq!(
            EntryPlan::Large(LargeMode::Sample).max_data_size(100),
            deflate_upper_bound(100)
        );
    }

    #[test]
    fn deflates_independently_of_block_feeding() {
        let mut data = "metorial ".repeat(400_000).into_bytes();
        data.extend(noise(300_000));

        let whole = deflate_all(6, &data, None).unwrap().unwrap();
        assert_eq!(inflate(&whole), data);

        let mut deflater = Deflater::new(6);
        let mut streamed = Vec::new();
        let blocks: Vec<_> = data.chunks(DEFLATE_BLOCK_BYTES).collect();
        for (index, block) in blocks.iter().enumerate() {
            let mut out = Vec::with_capacity(17);
            deflater
                .compress(block, index + 1 == blocks.len(), &mut out, None)
                .unwrap();
            streamed.extend(out);
        }
        assert_eq!(streamed, whole);
    }

    /// A large entry's blocks: full `block_len` blocks, then the rest as the last block.
    fn deflate_in_blocks(level: u32, data: &[u8], block_len: usize) -> Vec<Vec<u8>> {
        let full = data.len() / block_len;
        let mut blocks: Vec<Vec<u8>> = data
            .chunks(block_len)
            .take(full)
            .map(|block| deflate_block(level, block, false).unwrap())
            .collect();
        blocks.push(deflate_block(level, &data[full * block_len..], true).unwrap());
        blocks
    }

    #[test]
    fn independent_blocks_form_one_stream_within_the_bound() {
        let block = DEFLATE_BLOCK_BYTES;
        let text = |len: usize| {
            "metorial skill export\n".repeat(len / 22 + 1).into_bytes()[..len].to_vec()
        };

        for size in [0, 1, block - 1, block, block + 1, 3 * block] {
            for (kind, data) in [
                ("text", text(size)),
                ("noise", noise(size)),
                ("zeros", vec![0; size]),
            ] {
                for level in [1, 6, 9] {
                    let case = format!("{kind} {size} level {level}");
                    let blocks = deflate_in_blocks(level, &data, block);
                    assert_eq!(blocks.len(), size / block + 1);

                    for (index, compressed) in blocks.iter().enumerate() {
                        let input = (size - index * block).min(block) as u64;
                        assert!(compressed.len() as u64 <= deflate_block_upper_bound(input));
                        if index + 1 < blocks.len() {
                            assert!(compressed.ends_with(&[0, 0, 0xff, 0xff]), "{case}");
                        }
                    }

                    let stream = blocks.concat();
                    assert!(
                        stream.len() as u64 <= deflate_upper_bound(size as u64),
                        "{case}"
                    );
                    assert!(inflate(&stream) == data, "{case}: round trip");
                }
            }
        }

        assert_eq!(deflate_block(6, &[], true).unwrap(), [0x03, 0x00]);
        assert_eq!(
            deflate_block(6, &[], false).unwrap(),
            [0x00, 0x00, 0x00, 0xff, 0xff]
        );
    }

    #[test]
    fn blocks_are_identical_however_many_compress_at_once() {
        let mut data = "metorial ".repeat(30_000).into_bytes();
        data.extend(noise(70_000));
        let block = 16 * KIB as usize;
        let full = data.len() / block;
        let mut inputs: Vec<&[u8]> = data.chunks(block).take(full).collect();
        inputs.push(&data[full * block..]);
        let reference = deflate_in_blocks(6, &data, block).concat();

        for threads in [2, 5, 16] {
            let mut compressed = vec![Vec::new(); inputs.len()];
            std::thread::scope(|scope| {
                let mut slots: Vec<Vec<(usize, &mut Vec<u8>)>> =
                    (0..threads).map(|_| Vec::new()).collect();
                for (index, out) in compressed.iter_mut().enumerate() {
                    slots[index % threads].push((index, out));
                }
                for slot in slots {
                    let inputs = &inputs;
                    scope.spawn(move || {
                        for (index, out) in slot {
                            *out = deflate_block(6, inputs[index], index == full).unwrap();
                        }
                    });
                }
            });
            assert!(compressed.concat() == reference, "{threads} threads");
        }
        assert_eq!(inflate(&reference), data);
    }

    #[test]
    fn gives_up_when_the_limit_is_reached() {
        let random = noise(10_000);
        assert!(deflate_all(6, &random, Some(random.len() - 1))
            .unwrap()
            .is_none());

        let text = "abc".repeat(10_000).into_bytes();
        let compressed = deflate_all(6, &text, Some(text.len() - 1))
            .unwrap()
            .unwrap();
        assert!(compressed.len() < 200);
        assert_eq!(inflate(&compressed), text);

        assert_eq!(inflate(&deflate_all(6, b"", None).unwrap().unwrap()), b"");
    }

    #[tokio::test]
    async fn keeps_the_smaller_form() {
        let random = noise(50_000);
        let stored = compress_small(SmallMode::Smaller, 6, random.clone())
            .await
            .unwrap();
        assert_eq!(stored.method, Method::Stored);
        assert_eq!(stored.data, random);

        let forced = compress_small(SmallMode::Deflate, 6, random.clone())
            .await
            .unwrap();
        assert_eq!(forced.method, Method::Deflate);
        assert!(forced.data.len() > random.len());
        assert_eq!(inflate(&forced.data), random);

        let text = b"hello hello hello hello hello".to_vec();
        let deflated = compress_small(SmallMode::Smaller, 6, text.clone())
            .await
            .unwrap();
        assert_eq!(deflated.method, Method::Deflate);
        assert_eq!(inflate(&deflated.data), text);
    }

    #[tokio::test]
    async fn samples_with_a_ten_percent_threshold() {
        assert!(
            sample_compresses(6, "x".repeat(SAMPLE_BYTES).into_bytes().into())
                .await
                .unwrap()
        );
        assert!(!sample_compresses(6, noise(SAMPLE_BYTES).into())
            .await
            .unwrap());
    }
}
