use std::borrow::Cow;
use std::collections::{HashMap, HashSet};

use super::path::{
    check_lengths, check_structure, collision_key, directory_keys, sanitize_path,
    validate_entry_path, PathError, PathErrorReason,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PlannedName {
    pub archive_path: String,
    /// `archive_path` differs from the requested path.
    pub renamed: bool,
}

/// Chooses the archive path for every requested path, in input order. Every result passes
/// [`validate_entry_path`](super::validate_entry_path), and the set passes
/// [`validate_entry_paths`](super::validate_entry_paths). The result depends only on the input
/// paths and their order.
///
/// Rejected outright: empty paths, paths over `MAX_PATH_BYTES` or segments over
/// `MAX_SEGMENT_BYTES` (before and after renaming), a leading `/`, a trailing `/`, empty
/// segments, `.` or `..` segments, and the same input path twice.
///
/// Sanitized, segment by segment, replacing with `_`: control characters, `\`, `< > : " | ? *`,
/// invisible and bidirectional formatting characters, non-ASCII characters whose compatibility
/// form contains `/`, `\` or `.` or that Windows best-fit conversion turns into one of them
/// (`∕`, `¥`, `₩`, ...), and each trailing `.` or space. A segment whose stem (up to
/// the first `.`, ignoring trailing spaces) is a Windows device name gets `_` right after that
/// name: `CON` → `CON_`, `con.txt` → `con_.txt`, `CON .txt` → `CON_ .txt`.
///
/// Deduplicated after sanitizing, comparing case- and Unicode-normalization-insensitively, with
/// case folded the way NTFS and APFS fold it (`ſ`/`s`, `ς`/`σ` and `µ`/`μ` collide): the
/// first path keeps its name and later colliding ones are renamed. A file whose path is also a
/// parent directory of another entry is always the one renamed, never the directory. Renaming
/// inserts `~N` before the last `.` of the final segment, or appends it when there is no such
/// dot or it is the segment's first character (`readme~2.md`, `archive.tar~2.gz`, `Makefile~2`,
/// `.env~2`), using the smallest `N >= 2` that collides with no requested file, no directory
/// and no earlier renamed entry.
pub fn plan_entry_names<'a, I>(paths: I) -> Result<Vec<PlannedName>, PathError>
where
    I: IntoIterator<Item = &'a str>,
{
    let paths: Vec<&str> = paths.into_iter().collect();
    let mut renames = plan_renames(paths.len(), |index| paths[index], false)?.into_iter();
    let mut next_rename = renames.next();

    let mut planned = Vec::with_capacity(paths.len());
    for (index, path) in paths.iter().enumerate() {
        let archive_path = match next_rename.take() {
            Some((renamed, archive_path)) if renamed == index => {
                next_rename = renames.next();
                archive_path
            }
            other => {
                next_rename = other;
                path.to_string()
            }
        };
        planned.push(PlannedName {
            renamed: archive_path != *path,
            archive_path,
        });
    }
    Ok(planned)
}

/// [`plan_entry_names`] for the `count` paths that `path` returns by index, giving only the
/// archive paths that differ from the requested ones, by index in increasing order. `sorted`
/// promises the paths are in bytewise order, which finds duplicates without a set.
pub(crate) fn plan_renames<'a, F>(
    count: usize,
    path: F,
    sorted: bool,
) -> Result<Vec<(usize, String)>, PathError>
where
    F: Fn(usize) -> &'a str,
{
    let mut requested = (!sorted).then(|| HashSet::with_capacity(count));
    let mut sanitized: HashMap<usize, String> = HashMap::new();
    let mut owned_keys: Vec<Option<Box<str>>> = Vec::with_capacity(count);

    for index in 0..count {
        let requested_path = path(index);
        let error = |reason| PathError {
            path: requested_path.to_string(),
            reason,
        };

        check_structure(requested_path).map_err(error)?;

        let duplicate = match &mut requested {
            Some(requested) => !requested.insert(requested_path),
            None => index > 0 && path(index - 1) == requested_path,
        };
        if duplicate {
            return Err(error(PathErrorReason::Duplicate));
        }

        // Most paths need no sanitizing and are their own key, so a million-entry plan holds no
        // copies of them.
        let clean = sanitize_path(requested_path);
        if clean == requested_path {
            check_lengths(requested_path).map_err(error)?;
            owned_keys.push(match collision_key(requested_path) {
                Cow::Borrowed(_) => None,
                Cow::Owned(key) => Some(key.into_boxed_str()),
            });
        } else {
            check_lengths(&clean).map_err(error)?;
            owned_keys.push(Some(collision_key(&clean).into_owned().into_boxed_str()));
            sanitized.insert(index, clean);
        }
    }
    drop(requested);

    let key = |index: usize| owned_keys[index].as_deref().unwrap_or_else(|| path(index));
    let clean = |index: usize| {
        sanitized
            .get(&index)
            .map_or_else(|| path(index), |s| s.as_str())
    };

    let mut by_key: Vec<usize> = (0..count).collect();
    by_key.sort_unstable_by(|&a, &b| key(a).cmp(key(b)).then(a.cmp(&b)));
    let mut first_owner = vec![false; count];
    for (rank, &index) in by_key.iter().enumerate() {
        first_owner[index] = rank == 0 || key(by_key[rank - 1]) != key(index);
    }

    let mut directories: HashSet<&str> = HashSet::new();
    for index in 0..count {
        directories.extend(directory_keys(key(index)));
    }

    let requested_key = |candidate: &str| {
        by_key
            .binary_search_by(|&index| key(index).cmp(candidate))
            .is_ok()
    };
    let mut renamed_keys: HashSet<String> = HashSet::new();
    let mut renames = Vec::new();

    for (index, &first_owner) in first_owner.iter().enumerate() {
        let error = |reason| PathError {
            path: path(index).to_string(),
            reason,
        };
        let clean = clean(index);

        let archive_path = if first_owner && !directories.contains(key(index)) {
            Cow::Borrowed(clean)
        } else {
            // Each N yields a different key and only finitely many keys are taken, so this
            // terminates; growing N only lengthens the name, so a length error is final.
            let mut n = 2usize;
            loop {
                let candidate = with_suffix(clean, n);
                check_lengths(&candidate).map_err(error)?;

                let candidate_key = collision_key(&candidate);
                let taken = requested_key(&candidate_key)
                    || directories.contains(candidate_key.as_ref())
                    || renamed_keys.contains(candidate_key.as_ref());

                if !taken {
                    renamed_keys.insert(candidate_key.into_owned());
                    break Cow::Owned(candidate);
                }

                n += 1;
            }
        };

        validate_entry_path(&archive_path).map_err(|invalid| error(invalid.reason))?;

        if archive_path != path(index) {
            renames.push((index, archive_path.into_owned()));
        }
    }

    Ok(renames)
}

fn with_suffix(path: &str, n: usize) -> String {
    let name_start = path.rfind('/').map_or(0, |index| index + 1);
    let name = &path[name_start..];
    let insert_at = match name.rfind('.') {
        Some(dot) if dot > 0 => name_start + dot,
        _ => path.len(),
    };

    format!("{}~{n}{}", &path[..insert_at], &path[insert_at..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suffix_goes_before_the_last_dot_of_the_final_segment() {
        for (path, expected) in [
            ("readme.md", "readme~2.md"),
            ("archive.tar.gz", "archive.tar~2.gz"),
            ("Makefile", "Makefile~2"),
            (".env", ".env~2"),
            (".env.local", ".env~2.local"),
            ("dir.d/file", "dir.d/file~2"),
            ("a/b/c.txt", "a/b/c~2.txt"),
        ] {
            assert_eq!(with_suffix(path, 2), expected, "{path}");
        }
        assert_eq!(with_suffix("x.md", 13), "x~13.md");
    }

    #[test]
    fn sorted_paths_plan_the_same_as_unsorted_ones() {
        let segments = [
            "a",
            "A",
            "b",
            "readme.md",
            "README.md",
            "con",
            "x:y",
            "caf\u{e9}",
        ];
        let mut seed = 0x2545_f491_4f6c_dd1du64;
        for _ in 0..200 {
            let mut paths: Vec<String> = (0..12)
                .map(|_| {
                    let depth = 1 + (seed % 3) as usize;
                    let path: Vec<&str> = (0..depth)
                        .map(|_| {
                            seed ^= seed << 13;
                            seed ^= seed >> 7;
                            seed ^= seed << 17;
                            segments[(seed % segments.len() as u64) as usize]
                        })
                        .collect();
                    path.join("/")
                })
                .collect();
            paths.sort();

            let unsorted = plan_renames(paths.len(), |index| &paths[index], false);
            let sorted = plan_renames(paths.len(), |index| &paths[index], true);
            assert_eq!(sorted, unsorted, "{paths:?}");
        }
    }
}
