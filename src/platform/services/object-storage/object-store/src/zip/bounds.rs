use super::entry::DEFLATE_BLOCK_BYTES;
use super::format::{
    CENTRAL_DIRECTORY_HEADER_LEN, CENTRAL_ZIP64_EXTRA_MAX_LEN, END_RECORDS_MAX_LEN,
    LOCAL_FILE_HEADER_LEN, LOCAL_ZIP64_EXTRA_LEN, ZIP64_DATA_DESCRIPTOR_LEN,
};

const PER_ENTRY_OVERHEAD_MAX: u64 = LOCAL_FILE_HEADER_LEN
    + LOCAL_ZIP64_EXTRA_LEN
    + ZIP64_DATA_DESCRIPTOR_LEN
    + CENTRAL_DIRECTORY_HEADER_LEN
    + CENTRAL_ZIP64_EXTRA_MAX_LEN;

const BLOCK_OVERHEAD_MAX: u64 = 64;

/// Upper bound on the raw Deflate output of one block of `len` input bytes, compressed on its
/// own and ended by a sync flush or BFINAL: `len + len/8 + 64`.
///
/// miniz_oxide (flate2's `rust_backend`) ends a Deflate block after about 31 KiB of poorly
/// compressing input and stores it instead (5 bytes of overhead) if it would expand, so real
/// output stays within a few bytes per 32 KiB of `len`. A sync flush adds an empty stored block
/// of at most 5 bytes, and an empty last block is 2 bytes; the property tests check the rest.
pub fn deflate_block_upper_bound(len: u64) -> u64 {
    len.saturating_add(len / 8)
        .saturating_add(BLOCK_OVERHEAD_MAX)
}

/// Upper bound on the raw Deflate output for `uncompressed_size` input bytes, saturating at
/// `u64::MAX`: the sum of [`deflate_block_upper_bound`] over its `DEFLATE_BLOCK_BYTES` blocks
/// and its last (possibly empty) block, which is `n + n/8 + 64` per block. It also bounds a
/// single stream over the same bytes, which needs only one block's 64.
pub fn deflate_upper_bound(uncompressed_size: u64) -> u64 {
    let blocks = uncompressed_size / DEFLATE_BLOCK_BYTES as u64 + 1;
    uncompressed_size
        .saturating_add(uncompressed_size / 8)
        .saturating_add(blocks.saturating_mul(BLOCK_OVERHEAD_MAX))
}

/// Upper bound on the size of an archive containing entries of `(path length in bytes,
/// uncompressed size)`, whatever method each entry uses and whether or not its sizes are known
/// up front. Every entry is counted with ZIP64 headers, a ZIP64 data descriptor, a full ZIP64
/// central directory extra and `deflate_upper_bound` data; the archive with ZIP64 end records.
/// Saturates at `u64::MAX`.
pub fn archive_size_upper_bound<I>(entries: I) -> u64
where
    I: IntoIterator<Item = (usize, u64)>,
{
    archive_size_upper_bound_for_data(
        entries.into_iter().map(|(path_len, uncompressed_size)| {
            (path_len, deflate_upper_bound(uncompressed_size))
        }),
    )
}

/// Like [`archive_size_upper_bound`], but with the caller's own bound on each entry's data
/// bytes as written, e.g. the exact size for entries that are certainly stored.
pub fn archive_size_upper_bound_for_data<I>(entries: I) -> u64
where
    I: IntoIterator<Item = (usize, u64)>,
{
    entries
        .into_iter()
        .fold(END_RECORDS_MAX_LEN, |total, (path_len, max_data_size)| {
            total
                .saturating_add(PER_ENTRY_OVERHEAD_MAX)
                .saturating_add((path_len as u64).saturating_mul(2))
                .saturating_add(max_data_size)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deflate_bound_formula() {
        assert_eq!(deflate_upper_bound(0), 64);
        assert_eq!(deflate_upper_bound(8), 73);
        assert_eq!(
            deflate_upper_bound((1 << 20) - 1),
            (1 << 20) - 1 + (1 << 17) - 1 + 64
        );
        assert_eq!(deflate_upper_bound(1 << 20), (1 << 20) + (1 << 17) + 2 * 64);
        assert_eq!(
            deflate_upper_bound(3 << 20 | 1),
            (3 << 20 | 1) + (3 << 17) + 4 * 64
        );
        assert_eq!(deflate_upper_bound(u64::MAX), u64::MAX);
        assert_eq!(deflate_block_upper_bound(0), 64);
        assert_eq!(deflate_block_upper_bound(u64::MAX), u64::MAX);
    }

    #[test]
    fn deflate_bound_is_the_sum_of_its_block_bounds() {
        let block = DEFLATE_BLOCK_BYTES as u64;
        for size in [
            0,
            1,
            block - 1,
            block,
            block + 1,
            3 * block,
            3 * block + 7,
            1 << 33,
        ] {
            let full = size / block;
            let last = size % block;
            assert_eq!(
                deflate_upper_bound(size),
                full * deflate_block_upper_bound(block) + deflate_block_upper_bound(last),
                "{size}"
            );
        }
    }

    #[test]
    fn archive_bound_of_empty_archive_covers_zip64_end_records() {
        assert_eq!(archive_size_upper_bound([]), END_RECORDS_MAX_LEN);
    }

    #[test]
    fn data_bound_variant_matches_when_given_the_deflate_bound() {
        let entries = [(3, 0), (40, 1 << 20), (7, 5)];
        assert_eq!(
            archive_size_upper_bound(entries),
            archive_size_upper_bound_for_data(
                entries.map(|(path_len, size)| (path_len, deflate_upper_bound(size)))
            )
        );
        assert!(archive_size_upper_bound_for_data([(3, 10)]) < archive_size_upper_bound([(3, 10)]));
    }

    #[test]
    fn archive_bound_saturates() {
        assert_eq!(
            archive_size_upper_bound([(10, u64::MAX - 10), (10, 10)]),
            u64::MAX
        );
    }
}
