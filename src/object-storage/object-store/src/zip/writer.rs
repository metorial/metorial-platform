use std::fmt;

use bytes::{Bytes, BytesMut};
use thiserror::Error;

use super::bounds::deflate_upper_bound;
use super::format::{
    data_descriptor, exceeds_u32_field, CentralDirectoryHeader, EndRecords, LocalFileHeader,
    FLAG_DATA_DESCRIPTOR, FLAG_UTF8, METHOD_DEFLATE, METHOD_STORED,
};
use super::path::{check_conflicts, validate_entry_path, PathError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Method {
    Stored,
    Deflate,
}

impl Method {
    fn code(self) -> u16 {
        match self {
            Method::Stored => METHOD_STORED,
            Method::Deflate => METHOD_DEFLATE,
        }
    }

    fn max_compressed_size(self, uncompressed_size: u64) -> u64 {
        match self {
            Method::Stored => uncompressed_size,
            Method::Deflate => deflate_upper_bound(uncompressed_size),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub struct EntrySizes {
    pub crc32: u32,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DeclaredSizes {
    /// CRC-32 and sizes go into the local header; no data descriptor follows the data.
    Known(EntrySizes),
    /// The local header sets general purpose bit 3 and a data descriptor follows the data.
    /// `end_entry` rejects data larger than this bound (or, for Deflate, its
    /// `deflate_upper_bound`), because the bound decided whether the header is ZIP64.
    Unknown { max_uncompressed_size: u64 },
}

impl DeclaredSizes {
    fn max_sizes(&self, method: Method) -> (u64, u64) {
        match *self {
            DeclaredSizes::Known(sizes) => (sizes.uncompressed_size, sizes.compressed_size),
            DeclaredSizes::Unknown {
                max_uncompressed_size,
            } => (
                max_uncompressed_size,
                method.max_compressed_size(max_uncompressed_size),
            ),
        }
    }

    fn flags(&self) -> u16 {
        match self {
            DeclaredSizes::Known(_) => FLAG_UTF8,
            DeclaredSizes::Unknown { .. } => FLAG_UTF8 | FLAG_DATA_DESCRIPTOR,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct EntryHeader {
    pub path: String,
    pub method: Method,
    pub sizes: DeclaredSizes,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SizeField {
    Compressed,
    Uncompressed,
}

impl fmt::Display for SizeField {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SizeField::Compressed => f.write_str("compressed"),
            SizeField::Uncompressed => f.write_str("uncompressed"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ZipError {
    #[error("entry {open:?} is still open")]
    EntryAlreadyOpen { open: String },

    #[error("no entry is open")]
    NoOpenEntry,

    #[error("cannot finish while entry {open:?} is open")]
    FinishWithOpenEntry { open: String },

    #[error("the writer is unusable because an earlier entry failed")]
    Poisoned,

    #[error(transparent)]
    InvalidPath(#[from] PathError),

    #[error(
        "stored entry {path:?} has compressed size {compressed_size} \
         but uncompressed size {uncompressed_size}"
    )]
    StoredSizesDiffer {
        path: String,
        compressed_size: u64,
        uncompressed_size: u64,
    },

    #[error("entry {path:?} ended with sizes {actual:?}, but its header declared {declared:?}")]
    SizeMismatch {
        path: String,
        declared: EntrySizes,
        actual: EntrySizes,
    },

    #[error("entry {path:?} has CRC-32 {actual:#010x}, but its header declared {declared:#010x}")]
    CrcMismatch {
        path: String,
        declared: u32,
        actual: u32,
    },

    #[error(
        "entry {path:?} has {field} size {actual}, above the bound of {bound} declared for it"
    )]
    ExceedsDeclaredBound {
        path: String,
        field: SizeField,
        bound: u64,
        actual: u64,
    },

    #[error("archive would be larger than u64::MAX bytes")]
    ArchiveTooLarge,
}

impl ZipError {
    /// The entry's data did not match what was declared when its header was written, which
    /// for a pipeline reading from storage means the source changed underneath it.
    pub fn is_data_mismatch(&self) -> bool {
        matches!(
            self,
            ZipError::StoredSizesDiffer { .. }
                | ZipError::SizeMismatch { .. }
                | ZipError::CrcMismatch { .. }
                | ZipError::ExceedsDeclaredBound { .. }
        )
    }
}

/// A deterministic, streaming ZIP writer that never sees entry data.
///
/// For each entry, emit the bytes returned by [`begin_entry`](Self::begin_entry), then the
/// entry's data (stored, or raw Deflate produced by the caller), then the bytes returned by
/// [`end_entry`](Self::end_entry). After the last entry, emit the bytes from
/// [`finish`](Self::finish) or [`finish_chunked`](Self::finish_chunked).
///
/// Misordered calls return an error and leave the writer unchanged. An `end_entry` that rejects
/// the entry's sizes poisons the writer, since the entry's data has already been emitted.
pub struct ZipWriter {
    state: State,
    entries: Vec<CentralEntry>,
    bytes_written: u64,
    central_directory_len: u64,
}

enum State {
    Idle,
    Open(OpenEntry),
    Poisoned,
}

struct OpenEntry {
    path: String,
    method: Method,
    declared: DeclaredSizes,
    zip64: bool,
    local_header_offset: u64,
}

impl OpenEntry {
    fn check(&self, actual: &EntrySizes) -> Result<(), ZipError> {
        match self.declared {
            DeclaredSizes::Known(declared) => {
                if declared.compressed_size != actual.compressed_size
                    || declared.uncompressed_size != actual.uncompressed_size
                {
                    return Err(ZipError::SizeMismatch {
                        path: self.path.clone(),
                        declared,
                        actual: *actual,
                    });
                }

                if declared.crc32 != actual.crc32 {
                    return Err(ZipError::CrcMismatch {
                        path: self.path.clone(),
                        declared: declared.crc32,
                        actual: actual.crc32,
                    });
                }
            }
            DeclaredSizes::Unknown {
                max_uncompressed_size,
            } => {
                let exceeds = |field, bound, actual| {
                    Err(ZipError::ExceedsDeclaredBound {
                        path: self.path.clone(),
                        field,
                        bound,
                        actual,
                    })
                };

                if actual.uncompressed_size > max_uncompressed_size {
                    return exceeds(
                        SizeField::Uncompressed,
                        max_uncompressed_size,
                        actual.uncompressed_size,
                    );
                }

                let max_compressed_size = self.method.max_compressed_size(max_uncompressed_size);
                if actual.compressed_size > max_compressed_size {
                    return exceeds(
                        SizeField::Compressed,
                        max_compressed_size,
                        actual.compressed_size,
                    );
                }
            }
        }

        if self.method == Method::Stored {
            check_stored_sizes(&self.path, actual)?;
        }

        Ok(())
    }
}

struct CentralEntry {
    path: Box<str>,
    method: Method,
    flags: u16,
    local_zip64: bool,
    sizes: EntrySizes,
    local_header_offset: u64,
}

impl CentralEntry {
    fn header(&self) -> CentralDirectoryHeader<'_> {
        CentralDirectoryHeader {
            path: &self.path,
            method: self.method.code(),
            flags: self.flags,
            local_zip64: self.local_zip64,
            crc32: self.sizes.crc32,
            compressed_size: self.sizes.compressed_size,
            uncompressed_size: self.sizes.uncompressed_size,
            local_header_offset: self.local_header_offset,
        }
    }
}

fn check_stored_sizes(path: &str, sizes: &EntrySizes) -> Result<(), ZipError> {
    if sizes.compressed_size == sizes.uncompressed_size {
        Ok(())
    } else {
        Err(ZipError::StoredSizesDiffer {
            path: path.to_string(),
            compressed_size: sizes.compressed_size,
            uncompressed_size: sizes.uncompressed_size,
        })
    }
}

impl Default for ZipWriter {
    fn default() -> Self {
        Self::new()
    }
}

impl ZipWriter {
    pub fn new() -> Self {
        ZipWriter {
            state: State::Idle,
            entries: Vec::new(),
            bytes_written: 0,
            central_directory_len: 0,
        }
    }

    /// Archive bytes emitted so far, counting each finished entry's data as reported to
    /// `end_entry`. While an entry is open this is the offset its data starts at.
    pub fn bytes_written(&self) -> u64 {
        self.bytes_written
    }

    pub fn entry_count(&self) -> usize {
        self.entries.len()
    }

    /// Returns the local file header for `header` and opens the entry.
    ///
    /// The header is ZIP64 (version 4.5, a ZIP64 extra with both sizes, both fixed size fields
    /// set to the sentinel) when the declared uncompressed size or the largest possible
    /// compressed size is at least 0xFFFFFFFF; the entry's data descriptor then uses 8-byte
    /// sizes. The header's own offset only appears in the central directory, so an entry that
    /// starts past 4 GiB keeps a plain local header and a 16-byte descriptor, which streaming
    /// readers such as `java.util.zip.ZipInputStream` before JDK 21 need.
    pub fn begin_entry(&mut self, header: EntryHeader) -> Result<Bytes, ZipError> {
        match &self.state {
            State::Idle => {}
            State::Open(open) => {
                return Err(ZipError::EntryAlreadyOpen {
                    open: open.path.clone(),
                })
            }
            State::Poisoned => return Err(ZipError::Poisoned),
        }

        validate_entry_path(&header.path)?;

        if let (Method::Stored, DeclaredSizes::Known(sizes)) = (header.method, &header.sizes) {
            check_stored_sizes(&header.path, sizes)?;
        }

        let (max_uncompressed_size, max_compressed_size) = header.sizes.max_sizes(header.method);
        let zip64 =
            exceeds_u32_field(max_uncompressed_size) || exceeds_u32_field(max_compressed_size);

        let known = match header.sizes {
            DeclaredSizes::Known(sizes) => sizes,
            DeclaredSizes::Unknown { .. } => EntrySizes::default(),
        };

        let bytes = LocalFileHeader {
            path: &header.path,
            method: header.method.code(),
            flags: header.sizes.flags(),
            zip64,
            crc32: known.crc32,
            compressed_size: known.compressed_size,
            uncompressed_size: known.uncompressed_size,
        }
        .encode();

        let bytes_written = self
            .bytes_written
            .checked_add(bytes.len() as u64)
            .ok_or(ZipError::ArchiveTooLarge)?;

        self.state = State::Open(OpenEntry {
            path: header.path,
            method: header.method,
            declared: header.sizes,
            zip64,
            local_header_offset: self.bytes_written,
        });
        self.bytes_written = bytes_written;

        Ok(bytes)
    }

    /// Closes the open entry, whose data (`actual.compressed_size` bytes) the caller has emitted
    /// since `begin_entry`. Returns the data descriptor, or no bytes if the sizes were known.
    ///
    /// Rejects `actual` if it differs from `DeclaredSizes::Known`, exceeds the bound of
    /// `DeclaredSizes::Unknown`, or has differing sizes for a stored entry.
    pub fn end_entry(&mut self, actual: EntrySizes) -> Result<Bytes, ZipError> {
        let open = match std::mem::replace(&mut self.state, State::Poisoned) {
            State::Open(open) => open,
            State::Idle => {
                self.state = State::Idle;
                return Err(ZipError::NoOpenEntry);
            }
            State::Poisoned => return Err(ZipError::Poisoned),
        };

        let descriptor = self.complete_entry(open, actual)?;
        self.state = State::Idle;

        Ok(descriptor)
    }

    fn complete_entry(&mut self, open: OpenEntry, actual: EntrySizes) -> Result<Bytes, ZipError> {
        open.check(&actual)?;

        let descriptor = match open.declared {
            DeclaredSizes::Known(_) => Bytes::new(),
            DeclaredSizes::Unknown { .. } => data_descriptor(
                actual.crc32,
                actual.compressed_size,
                actual.uncompressed_size,
                open.zip64,
            ),
        };

        let bytes_written = self
            .bytes_written
            .checked_add(actual.compressed_size)
            .and_then(|total| total.checked_add(descriptor.len() as u64))
            .ok_or(ZipError::ArchiveTooLarge)?;

        let entry = CentralEntry {
            flags: open.declared.flags(),
            path: open.path.into_boxed_str(),
            method: open.method,
            local_zip64: open.zip64,
            sizes: actual,
            local_header_offset: open.local_header_offset,
        };

        let central_directory_len = self
            .central_directory_len
            .checked_add(entry.header().encoded_len())
            .ok_or(ZipError::ArchiveTooLarge)?;

        self.entries.push(entry);
        self.bytes_written = bytes_written;
        self.central_directory_len = central_directory_len;

        Ok(descriptor)
    }

    /// Returns the central directory and end records as one buffer. See
    /// [`finish_chunked`](Self::finish_chunked) for archives with many entries.
    pub fn finish(self) -> Result<Bytes, ZipError> {
        let trailer = self.finish_chunked(usize::MAX)?;
        let mut out = BytesMut::with_capacity(usize::try_from(trailer.total_len()).unwrap_or(0));

        for chunk in trailer {
            out.extend_from_slice(&chunk);
        }

        Ok(out.freeze())
    }

    /// Validates the finished archive and returns its trailer (central directory, then the
    /// ZIP64 end of central directory record and locator if needed, then the end of central
    /// directory record) as chunks of roughly `chunk_size` bytes, encoded lazily.
    ///
    /// Fails if an entry is open, if two entries collide on extraction (see
    /// `validate_entry_paths`), or if the archive would exceed `u64::MAX` bytes.
    pub fn finish_chunked(self, chunk_size: usize) -> Result<Trailer, ZipError> {
        match self.state {
            State::Idle => {}
            State::Open(open) => return Err(ZipError::FinishWithOpenEntry { open: open.path }),
            State::Poisoned => return Err(ZipError::Poisoned),
        }

        check_conflicts(self.entries.iter().map(|entry| &*entry.path))?;

        let end = EndRecords {
            entry_count: self.entries.len() as u64,
            central_directory_offset: self.bytes_written,
            central_directory_len: self.central_directory_len,
        };

        let total_len = self
            .central_directory_len
            .checked_add(end.encoded_len())
            .ok_or(ZipError::ArchiveTooLarge)?;
        self.bytes_written
            .checked_add(total_len)
            .ok_or(ZipError::ArchiveTooLarge)?;

        Ok(Trailer {
            entries: self.entries.into_iter(),
            end: Some(end.encode()),
            chunk_size: chunk_size.max(1),
            total_len,
        })
    }
}

/// The archive trailer as an iterator of byte chunks; see [`ZipWriter::finish_chunked`].
pub struct Trailer {
    entries: std::vec::IntoIter<CentralEntry>,
    end: Option<Bytes>,
    chunk_size: usize,
    total_len: u64,
}

impl Trailer {
    pub fn total_len(&self) -> u64 {
        self.total_len
    }
}

impl Iterator for Trailer {
    type Item = Bytes;

    fn next(&mut self) -> Option<Bytes> {
        let mut chunk = BytesMut::new();

        while chunk.len() < self.chunk_size {
            match self.entries.next() {
                Some(entry) => entry.header().encode_into(&mut chunk),
                None => {
                    if let Some(end) = self.end.take() {
                        chunk.extend_from_slice(&end);
                    }
                    break;
                }
            }
        }

        if chunk.is_empty() {
            None
        } else {
            Some(chunk.freeze())
        }
    }
}
