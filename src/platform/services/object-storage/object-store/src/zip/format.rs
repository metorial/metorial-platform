use bytes::{BufMut, Bytes, BytesMut};

pub(crate) const LOCAL_FILE_HEADER_SIGNATURE: u32 = 0x0403_4b50;
pub(crate) const DATA_DESCRIPTOR_SIGNATURE: u32 = 0x0807_4b50;
pub(crate) const CENTRAL_DIRECTORY_HEADER_SIGNATURE: u32 = 0x0201_4b50;
pub(crate) const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE: u32 = 0x0606_4b50;
pub(crate) const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE: u32 = 0x0706_4b50;
pub(crate) const END_OF_CENTRAL_DIRECTORY_SIGNATURE: u32 = 0x0605_4b50;

pub(crate) const ZIP64_EXTRA_FIELD_TAG: u16 = 0x0001;

pub(crate) const U16_SENTINEL: u16 = 0xFFFF;
pub(crate) const U32_SENTINEL: u32 = 0xFFFF_FFFF;

pub(crate) const VERSION_DEFAULT: u16 = 20;
pub(crate) const VERSION_ZIP64: u16 = 45;
pub(crate) const HOST_UNIX: u16 = 3 << 8;

pub(crate) const FLAG_DATA_DESCRIPTOR: u16 = 1 << 3;
pub(crate) const FLAG_UTF8: u16 = 1 << 11;

pub(crate) const METHOD_STORED: u16 = 0;
pub(crate) const METHOD_DEFLATE: u16 = 8;

pub(crate) const DOS_TIME_MIDNIGHT: u16 = 0;
pub(crate) const DOS_DATE_1980_01_01: u16 = (1 << 5) | 1;
pub(crate) const EXTERNAL_ATTRIBUTES_REGULAR_0644: u32 = 0o100644 << 16;

pub(crate) const LOCAL_FILE_HEADER_LEN: u64 = 30;
pub(crate) const LOCAL_ZIP64_EXTRA_LEN: u64 = 4 + 8 + 8;
pub(crate) const DATA_DESCRIPTOR_LEN: u64 = 16;
pub(crate) const ZIP64_DATA_DESCRIPTOR_LEN: u64 = 24;
pub(crate) const CENTRAL_DIRECTORY_HEADER_LEN: u64 = 46;
pub(crate) const CENTRAL_ZIP64_EXTRA_MAX_LEN: u64 = 4 + 8 + 8 + 8;
pub(crate) const ZIP64_END_OF_CENTRAL_DIRECTORY_LEN: u64 = 56;
pub(crate) const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_LEN: u64 = 20;
pub(crate) const END_OF_CENTRAL_DIRECTORY_LEN: u64 = 22;
pub(crate) const END_RECORDS_MAX_LEN: u64 = ZIP64_END_OF_CENTRAL_DIRECTORY_LEN
    + ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_LEN
    + END_OF_CENTRAL_DIRECTORY_LEN;

/// The all-ones value of a 32-bit field is the sentinel that tells readers to look in the ZIP64
/// extra field, so a value *equal* to 0xFFFFFFFF already has to be written as ZIP64.
pub(crate) fn exceeds_u32_field(value: u64) -> bool {
    value >= U32_SENTINEL as u64
}

pub(crate) fn exceeds_u16_field(value: u64) -> bool {
    value >= U16_SENTINEL as u64
}

fn u32_field(value: u64) -> u32 {
    if exceeds_u32_field(value) {
        U32_SENTINEL
    } else {
        value as u32
    }
}

fn u16_field(value: u64) -> u16 {
    if exceeds_u16_field(value) {
        U16_SENTINEL
    } else {
        value as u16
    }
}

pub(crate) struct LocalFileHeader<'a> {
    pub path: &'a str,
    pub method: u16,
    pub flags: u16,
    pub zip64: bool,
    pub crc32: u32,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
}

impl LocalFileHeader<'_> {
    pub fn encode(&self) -> Bytes {
        let extra_len = if self.zip64 { LOCAL_ZIP64_EXTRA_LEN } else { 0 };
        let mut out =
            BytesMut::with_capacity((LOCAL_FILE_HEADER_LEN + extra_len) as usize + self.path.len());

        out.put_u32_le(LOCAL_FILE_HEADER_SIGNATURE);
        out.put_u16_le(if self.zip64 {
            VERSION_ZIP64
        } else {
            VERSION_DEFAULT
        });
        out.put_u16_le(self.flags);
        out.put_u16_le(self.method);
        out.put_u16_le(DOS_TIME_MIDNIGHT);
        out.put_u16_le(DOS_DATE_1980_01_01);
        out.put_u32_le(self.crc32);

        if self.zip64 {
            // A ZIP64 local extra must carry both sizes, so both fixed fields hold the sentinel
            // even when one of them would fit.
            out.put_u32_le(U32_SENTINEL);
            out.put_u32_le(U32_SENTINEL);
        } else {
            out.put_u32_le(self.compressed_size as u32);
            out.put_u32_le(self.uncompressed_size as u32);
        }

        out.put_u16_le(self.path.len() as u16);
        out.put_u16_le(extra_len as u16);
        out.put_slice(self.path.as_bytes());

        if self.zip64 {
            out.put_u16_le(ZIP64_EXTRA_FIELD_TAG);
            out.put_u16_le(16);
            out.put_u64_le(self.uncompressed_size);
            out.put_u64_le(self.compressed_size);
        }

        out.freeze()
    }
}

pub(crate) fn data_descriptor(
    crc32: u32,
    compressed_size: u64,
    uncompressed_size: u64,
    zip64: bool,
) -> Bytes {
    let len = if zip64 {
        ZIP64_DATA_DESCRIPTOR_LEN
    } else {
        DATA_DESCRIPTOR_LEN
    };
    let mut out = BytesMut::with_capacity(len as usize);

    out.put_u32_le(DATA_DESCRIPTOR_SIGNATURE);
    out.put_u32_le(crc32);

    if zip64 {
        out.put_u64_le(compressed_size);
        out.put_u64_le(uncompressed_size);
    } else {
        out.put_u32_le(compressed_size as u32);
        out.put_u32_le(uncompressed_size as u32);
    }

    out.freeze()
}

pub(crate) struct CentralDirectoryHeader<'a> {
    pub path: &'a str,
    pub method: u16,
    pub flags: u16,
    pub local_zip64: bool,
    pub crc32: u32,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub local_header_offset: u64,
}

impl CentralDirectoryHeader<'_> {
    fn zip64_extra_len(&self) -> u64 {
        let overflowing = [
            self.uncompressed_size,
            self.compressed_size,
            self.local_header_offset,
        ]
        .into_iter()
        .filter(|value| exceeds_u32_field(*value))
        .count() as u64;

        if overflowing == 0 {
            0
        } else {
            4 + 8 * overflowing
        }
    }

    pub fn encoded_len(&self) -> u64 {
        CENTRAL_DIRECTORY_HEADER_LEN + self.path.len() as u64 + self.zip64_extra_len()
    }

    pub fn encode_into(&self, out: &mut BytesMut) {
        let extra_len = self.zip64_extra_len();
        let version = if self.local_zip64 || extra_len > 0 {
            VERSION_ZIP64
        } else {
            VERSION_DEFAULT
        };

        out.put_u32_le(CENTRAL_DIRECTORY_HEADER_SIGNATURE);
        out.put_u16_le(HOST_UNIX | version);
        out.put_u16_le(version);
        out.put_u16_le(self.flags);
        out.put_u16_le(self.method);
        out.put_u16_le(DOS_TIME_MIDNIGHT);
        out.put_u16_le(DOS_DATE_1980_01_01);
        out.put_u32_le(self.crc32);
        out.put_u32_le(u32_field(self.compressed_size));
        out.put_u32_le(u32_field(self.uncompressed_size));
        out.put_u16_le(self.path.len() as u16);
        out.put_u16_le(extra_len as u16);
        out.put_u16_le(0); // comment length
        out.put_u16_le(0); // disk number start
        out.put_u16_le(0); // internal attributes
        out.put_u32_le(EXTERNAL_ATTRIBUTES_REGULAR_0644);
        out.put_u32_le(u32_field(self.local_header_offset));
        out.put_slice(self.path.as_bytes());

        if extra_len > 0 {
            out.put_u16_le(ZIP64_EXTRA_FIELD_TAG);
            out.put_u16_le((extra_len - 4) as u16);

            for value in [
                self.uncompressed_size,
                self.compressed_size,
                self.local_header_offset,
            ] {
                if exceeds_u32_field(value) {
                    out.put_u64_le(value);
                }
            }
        }
    }
}

pub(crate) struct EndRecords {
    pub entry_count: u64,
    pub central_directory_offset: u64,
    pub central_directory_len: u64,
}

impl EndRecords {
    pub fn needs_zip64(&self) -> bool {
        exceeds_u16_field(self.entry_count)
            || exceeds_u32_field(self.central_directory_offset)
            || exceeds_u32_field(self.central_directory_len)
    }

    pub fn encoded_len(&self) -> u64 {
        if self.needs_zip64() {
            END_RECORDS_MAX_LEN
        } else {
            END_OF_CENTRAL_DIRECTORY_LEN
        }
    }

    /// The caller must have checked that `central_directory_offset + central_directory_len`
    /// fits in a u64.
    pub fn encode(&self) -> Bytes {
        let mut out = BytesMut::with_capacity(self.encoded_len() as usize);

        if self.needs_zip64() {
            let zip64_record_offset = self.central_directory_offset + self.central_directory_len;

            out.put_u32_le(ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE);
            out.put_u64_le(ZIP64_END_OF_CENTRAL_DIRECTORY_LEN - 12);
            out.put_u16_le(HOST_UNIX | VERSION_ZIP64);
            out.put_u16_le(VERSION_ZIP64);
            out.put_u32_le(0); // number of this disk
            out.put_u32_le(0); // disk where the central directory starts
            out.put_u64_le(self.entry_count);
            out.put_u64_le(self.entry_count);
            out.put_u64_le(self.central_directory_len);
            out.put_u64_le(self.central_directory_offset);

            out.put_u32_le(ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE);
            out.put_u32_le(0); // disk with the ZIP64 end of central directory record
            out.put_u64_le(zip64_record_offset);
            out.put_u32_le(1); // total number of disks
        }

        out.put_u32_le(END_OF_CENTRAL_DIRECTORY_SIGNATURE);
        out.put_u16_le(0); // number of this disk
        out.put_u16_le(0); // disk where the central directory starts
        out.put_u16_le(u16_field(self.entry_count));
        out.put_u16_le(u16_field(self.entry_count));
        out.put_u32_le(u32_field(self.central_directory_len));
        out.put_u32_le(u32_field(self.central_directory_offset));
        out.put_u16_le(0); // comment length

        out.freeze()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn end(entry_count: u64, offset: u64, len: u64) -> EndRecords {
        EndRecords {
            entry_count,
            central_directory_offset: offset,
            central_directory_len: len,
        }
    }

    #[test]
    fn u32_threshold_includes_the_sentinel_itself() {
        assert!(!exceeds_u32_field(0xFFFF_FFFE));
        assert!(exceeds_u32_field(0xFFFF_FFFF));
        assert!(exceeds_u32_field(0x1_0000_0000));
        assert!(exceeds_u32_field(u64::MAX));
        assert_eq!(u32_field(0xFFFF_FFFE), 0xFFFF_FFFE);
        assert_eq!(u32_field(0xFFFF_FFFF), U32_SENTINEL);
    }

    #[test]
    fn u16_threshold_includes_the_sentinel_itself() {
        assert!(!exceeds_u16_field(0xFFFE));
        assert!(exceeds_u16_field(0xFFFF));
        assert_eq!(u16_field(0xFFFE), 0xFFFE);
        assert_eq!(u16_field(0x1_0000), U16_SENTINEL);
    }

    #[test]
    fn zip64_end_records_switch_on_each_field_independently() {
        assert!(!end(0xFFFE, 0xFFFF_FFFE, 0xFFFF_FFFE).needs_zip64());
        assert!(end(0xFFFF, 0, 0).needs_zip64());
        assert!(end(0, 0xFFFF_FFFF, 0).needs_zip64());
        assert!(end(0, 0, 0xFFFF_FFFF).needs_zip64());
    }

    #[test]
    fn central_directory_size_overflow_uses_sentinel_and_zip64_record() {
        let records = end(3, 100, 0x1_0000_0005);
        let bytes = records.encode();
        assert_eq!(bytes.len() as u64, records.encoded_len());
        assert_eq!(bytes.len() as u64, END_RECORDS_MAX_LEN);

        let eocd = &bytes[bytes.len() - 22..];
        assert_eq!(&eocd[8..10], &3u16.to_le_bytes());
        assert_eq!(&eocd[12..16], &U32_SENTINEL.to_le_bytes());
        assert_eq!(&eocd[16..20], &100u32.to_le_bytes());

        assert_eq!(&bytes[40..48], &0x1_0000_0005u64.to_le_bytes());
        assert_eq!(&bytes[48..56], &100u64.to_le_bytes());
        assert_eq!(&bytes[64..72], &0x1_0000_0069u64.to_le_bytes());
    }

    #[test]
    fn central_header_encoded_len_matches_bytes() {
        for (uncompressed, compressed, offset) in [
            (1, 1, 1),
            (0xFFFF_FFFF, 1, 1),
            (1, 0xFFFF_FFFF, 1),
            (1, 1, 0xFFFF_FFFF),
            (u64::MAX, u64::MAX, u64::MAX),
        ] {
            let header = CentralDirectoryHeader {
                path: "dir/file.txt",
                method: METHOD_STORED,
                flags: FLAG_UTF8,
                local_zip64: false,
                crc32: 0,
                compressed_size: compressed,
                uncompressed_size: uncompressed,
                local_header_offset: offset,
            };
            let mut out = BytesMut::new();
            header.encode_into(&mut out);
            assert_eq!(out.len() as u64, header.encoded_len());
        }
    }
}
