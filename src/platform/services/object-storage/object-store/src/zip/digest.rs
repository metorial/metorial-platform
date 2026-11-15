use super::EntrySizes;

/// Accumulates the CRC-32 and both sizes of an entry while its data streams through, producing
/// the [`EntrySizes`] to pass to `ZipWriter::end_entry`.
#[derive(Clone, Default)]
pub struct EntryDigest {
    crc32: crc32fast::Hasher,
    uncompressed_size: u64,
    compressed_size: u64,
}

impl EntryDigest {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn update_uncompressed(&mut self, data: &[u8]) {
        self.crc32.update(data);
        self.uncompressed_size = self.uncompressed_size.saturating_add(data.len() as u64);
    }

    pub fn add_compressed(&mut self, len: u64) {
        self.compressed_size = self.compressed_size.saturating_add(len);
    }

    pub fn finish(self) -> EntrySizes {
        EntrySizes {
            crc32: self.crc32.finalize(),
            compressed_size: self.compressed_size,
            uncompressed_size: self.uncompressed_size,
        }
    }
}

impl EntrySizes {
    pub fn stored(data: &[u8]) -> Self {
        EntrySizes {
            crc32: crc32fast::hash(data),
            compressed_size: data.len() as u64,
            uncompressed_size: data.len() as u64,
        }
    }

    pub fn deflated(uncompressed: &[u8], compressed_size: u64) -> Self {
        EntrySizes {
            crc32: crc32fast::hash(uncompressed),
            compressed_size,
            uncompressed_size: uncompressed.len() as u64,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digest_matches_one_shot_helpers() {
        let mut digest = EntryDigest::new();
        digest.update_uncompressed(b"hel");
        digest.update_uncompressed(b"lo");
        digest.add_compressed(3);
        digest.add_compressed(2);

        assert_eq!(digest.finish(), EntrySizes::stored(b"hello"));
        assert_eq!(EntrySizes::stored(b"hello").crc32, 0x3610_a686);
    }
}
