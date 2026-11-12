use std::borrow::Cow;
use std::collections::HashMap;

use thiserror::Error;
use unicode_normalization::UnicodeNormalization;

pub const MAX_PATH_BYTES: usize = 4096;
pub const MAX_SEGMENT_BYTES: usize = 255;

pub(crate) const REPLACEMENT_CHARACTER: char = '_';

const WINDOWS_INVALID_CHARACTERS: &[char] = &['<', '>', ':', '"', '|', '?', '*'];

const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$", "COM1", "COM2", "COM3", "COM4", "COM5",
    "COM6", "COM7", "COM8", "COM9", "COM¹", "COM²", "COM³", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5",
    "LPT6", "LPT7", "LPT8", "LPT9", "LPT¹", "LPT²", "LPT³",
];

#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[error("invalid zip entry path {path:?}: {reason}")]
pub struct PathError {
    pub path: String,
    pub reason: PathErrorReason,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PathErrorReason {
    #[error("path is empty")]
    Empty,

    #[error("path is {len} bytes, more than {MAX_PATH_BYTES}")]
    TooLong { len: usize },

    #[error("segment {segment:?} is more than {MAX_SEGMENT_BYTES} bytes")]
    SegmentTooLong { segment: String },

    #[error("path starts with '/'")]
    Absolute,

    #[error("path starts with a drive letter")]
    DriveLetter,

    #[error("path ends with '/' (directory entries are not allowed)")]
    TrailingSlash,

    #[error("path contains an empty segment")]
    EmptySegment,

    #[error("path contains a '.' or '..' segment")]
    DotSegment,

    #[error("path contains a backslash")]
    Backslash,

    #[error("path contains control character U+{0:04X}")]
    ControlCharacter(u32),

    #[error("path contains invisible or bidirectional formatting character U+{0:04X}")]
    InvisibleCharacter(u32),

    #[error("path contains {0:?}, which is not allowed in Windows file names")]
    WindowsInvalidCharacter(char),

    #[error("path contains U+{0:04X}, a lookalike of '/', '\\' or '.'")]
    LookalikeCharacter(u32),

    #[error("segment {segment:?} is a reserved Windows device name")]
    WindowsReservedName { segment: String },

    #[error("segment {segment:?} ends with '.' or a space")]
    TrailingDotOrSpace { segment: String },

    #[error("duplicate path")]
    Duplicate,

    #[error("collides with {other:?} on case-insensitive or normalizing file systems")]
    CaseCollision { other: String },

    #[error("conflicts with {other:?}: one is a file and the other needs it as a directory")]
    FileDirectoryConflict { other: String },
}

impl PathErrorReason {
    pub fn is_conflict(&self) -> bool {
        matches!(
            self,
            PathErrorReason::Duplicate
                | PathErrorReason::CaseCollision { .. }
                | PathErrorReason::FileDirectoryConflict { .. }
        )
    }
}

/// Checks one entry path in isolation. Accepted paths are relative, `/`-separated file paths
/// that extract to the same place on Linux, macOS and Windows and cannot escape the
/// extraction directory. A path passes exactly when it is structurally valid and
/// `plan_entry_names` would not need to sanitize it.
pub fn validate_entry_path(path: &str) -> Result<(), PathError> {
    check_path(path).map_err(|reason| PathError {
        path: path.to_string(),
        reason,
    })
}

/// Checks every path with [`validate_entry_path`] and the set for exact duplicates,
/// case-insensitive or Unicode-normalization collisions, and paths that are both a file and a
/// parent directory of another entry. Errors report the first offending path in input order.
pub fn validate_entry_paths<'a, I>(paths: I) -> Result<(), PathError>
where
    I: IntoIterator<Item = &'a str>,
{
    check_paths(paths, true)
}

pub(crate) fn check_conflicts<'a, I>(paths: I) -> Result<(), PathError>
where
    I: IntoIterator<Item = &'a str>,
{
    check_paths(paths, false)
}

fn check_paths<'a, I>(paths: I, check_each: bool) -> Result<(), PathError>
where
    I: IntoIterator<Item = &'a str>,
{
    let mut files: HashMap<Cow<'a, str>, &'a str> = HashMap::new();
    let mut directories: HashMap<String, &'a str> = HashMap::new();

    for path in paths {
        if check_each {
            validate_entry_path(path)?;
        }

        let key = collision_key(path);
        let error = |reason| PathError {
            path: path.to_string(),
            reason,
        };

        if let Some(other) = files.get(key.as_ref()) {
            return Err(error(if *other == path {
                PathErrorReason::Duplicate
            } else {
                PathErrorReason::CaseCollision {
                    other: other.to_string(),
                }
            }));
        }

        if let Some(other) = directories.get(key.as_ref()) {
            return Err(error(PathErrorReason::FileDirectoryConflict {
                other: other.to_string(),
            }));
        }

        for directory in directory_keys(&key) {
            if let Some(other) = files.get(directory) {
                return Err(error(PathErrorReason::FileDirectoryConflict {
                    other: other.to_string(),
                }));
            }

            if !directories.contains_key(directory) {
                directories.insert(directory.to_string(), path);
            }
        }

        files.insert(key, path);
    }

    Ok(())
}

/// Two paths with the same key land on the same file on APFS/HFS+ (case-insensitive,
/// normalization-insensitive) or NTFS (case-insensitive). Borrows the path when it is its own
/// key, as lowercase ASCII is.
///
/// Lowercasing alone misses letters that NTFS's upcase table or APFS's case folding merge with
/// another one (`ſ` and `s`, `ς` and `σ`, `µ` and `μ`, `ı` and `i`), so every character is
/// uppercased first and then lowercased one at a time, without the context-dependent final sigma
/// rule. This also merges some names no file system does (`ß` and `ss`), which only renames.
pub(crate) fn collision_key(path: &str) -> Cow<'_, str> {
    if path.is_ascii() && !path.bytes().any(|byte| byte.is_ascii_uppercase()) {
        return Cow::Borrowed(path);
    }
    let folded: String = path
        .nfc()
        .flat_map(char::to_uppercase)
        .flat_map(char::to_lowercase)
        .collect();
    Cow::Owned(folded.nfc().collect())
}

/// The keys of every parent directory of a path key: `a/b/c` yields `a` and `a/b`.
pub(crate) fn directory_keys(key: &str) -> impl Iterator<Item = &str> {
    key.match_indices('/').map(|(index, _)| &key[..index])
}

fn check_path(path: &str) -> Result<(), PathErrorReason> {
    check_structure(path)?;

    let bytes = path.as_bytes();
    if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        return Err(PathErrorReason::DriveLetter);
    }

    if let Some(reason) = path.chars().find_map(unsafe_character) {
        return Err(reason);
    }

    for segment in path.split('/') {
        if ends_with_dot_or_space(segment) {
            return Err(PathErrorReason::TrailingDotOrSpace {
                segment: segment.to_string(),
            });
        }

        if reserved_stem_len(segment).is_some() {
            return Err(PathErrorReason::WindowsReservedName {
                segment: segment.to_string(),
            });
        }
    }

    Ok(())
}

/// Problems that sanitizing cannot or must not fix: they indicate a caller bug or an attack.
pub(crate) fn check_structure(path: &str) -> Result<(), PathErrorReason> {
    if path.is_empty() {
        return Err(PathErrorReason::Empty);
    }

    check_lengths(path)?;

    if path.starts_with('/') {
        return Err(PathErrorReason::Absolute);
    }

    if path.ends_with('/') {
        return Err(PathErrorReason::TrailingSlash);
    }

    for segment in path.split('/') {
        if segment.is_empty() {
            return Err(PathErrorReason::EmptySegment);
        }

        if segment == "." || segment == ".." {
            return Err(PathErrorReason::DotSegment);
        }
    }

    Ok(())
}

pub(crate) fn check_lengths(path: &str) -> Result<(), PathErrorReason> {
    if path.len() > MAX_PATH_BYTES {
        return Err(PathErrorReason::TooLong { len: path.len() });
    }

    match path
        .split('/')
        .find(|segment| segment.len() > MAX_SEGMENT_BYTES)
    {
        Some(segment) => Err(PathErrorReason::SegmentTooLong {
            segment: segment.to_string(),
        }),
        None => Ok(()),
    }
}

/// Replaces everything [`validate_entry_path`] rejects inside a segment, without touching the
/// path's structure. Every character maps to exactly one character and nothing maps to `.`,
/// so a non-empty segment stays non-empty and only a segment that was already `.` or `..`
/// can be one afterwards (which `check_structure` rejects first).
pub(crate) fn sanitize_path(path: &str) -> String {
    path.split('/')
        .map(sanitize_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn sanitize_segment(segment: &str) -> String {
    let mut sanitized: String = segment
        .chars()
        .map(|character| match unsafe_character(character) {
            Some(_) => REPLACEMENT_CHARACTER,
            None => character,
        })
        .collect();

    let kept_len = sanitized.trim_end_matches(['.', ' ']).len();
    let trailing = sanitized.len() - kept_len;
    sanitized.truncate(kept_len);
    sanitized.extend(std::iter::repeat_n(REPLACEMENT_CHARACTER, trailing));

    if let Some(stem_len) = reserved_stem_len(&sanitized) {
        sanitized.insert(stem_len, REPLACEMENT_CHARACTER);
    }

    sanitized
}

fn unsafe_character(character: char) -> Option<PathErrorReason> {
    if character.is_control() {
        Some(PathErrorReason::ControlCharacter(character as u32))
    } else if character == '\\' {
        Some(PathErrorReason::Backslash)
    } else if WINDOWS_INVALID_CHARACTERS.contains(&character) {
        Some(PathErrorReason::WindowsInvalidCharacter(character))
    } else if is_invisible(character) {
        Some(PathErrorReason::InvisibleCharacter(character as u32))
    } else if is_lookalike(character) {
        Some(PathErrorReason::LookalikeCharacter(character as u32))
    } else {
        None
    }
}

/// Characters that render as nothing or reorder the displayed text, so a name can look like a
/// different one (`SKILL.md` vs `SKILL\u{200B}.md`, or a right-to-left override hiding the real
/// extension). ZWJ/ZWNJ (U+200C/U+200D) are allowed because emoji sequences and several scripts
/// need them, and so are variation selectors, which pick emoji presentation.
fn is_invisible(character: char) -> bool {
    matches!(
        character,
        '\u{00AD}'
            | '\u{034F}'
            | '\u{061C}'
            | '\u{115F}'
            | '\u{1160}'
            | '\u{180E}'
            | '\u{200B}'
            | '\u{200E}'
            | '\u{200F}'
            | '\u{2028}'..='\u{202E}'
            | '\u{2060}'..='\u{206F}'
            | '\u{2800}'
            | '\u{3164}'
            | '\u{FEFF}'
            | '\u{FFA0}'
            | '\u{FFF9}'..='\u{FFFB}'
            | '\u{E0000}'..='\u{E007F}'
    )
}

/// Characters that Windows "best fit" conversion to an ANSI code page turns into `/`, `\` or `.`
/// (an archive tool extracting through such an API then sees a separator or a dot). Most have
/// no compatibility decomposition, so NFKC alone does not catch them; `¥` and `₩` sit at the
/// position of `\` in the Japanese and Korean code pages.
const BEST_FIT_LOOKALIKES: &[char] = &[
    '\u{00A5}', '\u{2024}', '\u{2025}', '\u{2044}', '\u{20A9}', '\u{2215}', '\u{2216}', '\u{29F5}',
    '\u{29F8}', '\u{29F9}', '\u{FE52}', '\u{FE68}', '\u{FF0E}', '\u{FF0F}', '\u{FF3C}',
];

/// Compatibility normalization turns e.g. U+FF0F FULLWIDTH SOLIDUS into `/` and U+FF0E
/// FULLWIDTH FULL STOP into `.`, so `．．` could become a parent-directory segment after
/// extraction. Composition never produces these ASCII characters, so checking characters one at
/// a time covers every sequence.
fn is_lookalike(character: char) -> bool {
    !character.is_ascii()
        && (BEST_FIT_LOOKALIKES.contains(&character)
            || std::iter::once(character)
                .nfkc()
                .any(|normalized| matches!(normalized, '/' | '\\' | '.')))
}

fn ends_with_dot_or_space(segment: &str) -> bool {
    segment.ends_with(['.', ' '])
}

/// Windows treats `CON`, `con.txt` and `CON .tar.gz` all as the console device: everything from
/// the first dot on is ignored, as are trailing spaces before it. Returns the byte length of
/// the reserved name at the start of the segment.
fn reserved_stem_len(segment: &str) -> Option<usize> {
    let stem = segment
        .split('.')
        .next()
        .unwrap_or(segment)
        .trim_end_matches(' ');

    WINDOWS_RESERVED_NAMES
        .iter()
        .any(|reserved| stem.eq_ignore_ascii_case(reserved))
        .then_some(stem.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reserved_name_matching_ignores_extension_case_and_trailing_spaces() {
        assert_eq!(reserved_stem_len("CON"), Some(3));
        assert_eq!(reserved_stem_len("con.txt"), Some(3));
        assert_eq!(reserved_stem_len("Con  .tar.gz"), Some(3));
        assert_eq!(reserved_stem_len("com¹"), Some(5));
        assert_eq!(reserved_stem_len("CONSOLE"), None);
        assert_eq!(reserved_stem_len("COM0"), None);
        assert_eq!(reserved_stem_len("x.CON"), None);
    }

    #[test]
    fn collision_key_folds_case_and_normalization() {
        assert_eq!(collision_key("README.md"), collision_key("readme.MD"));
        assert_eq!(collision_key("caf\u{e9}"), collision_key("cafe\u{301}"));
        assert_eq!(collision_key("CAF\u{c9}"), collision_key("cafe\u{301}"));
        assert_ne!(collision_key("a"), collision_key("b"));

        for (a, b) in [
            ("s.txt", "\u{17F}.txt"),
            ("\u{3C3}", "\u{3C2}"),
            ("\u{391}\u{3C3}", "\u{391}\u{3A3}"),
            ("\u{3BC}.txt", "\u{B5}.txt"),
            ("\u{3B2}.txt", "\u{3D0}.txt"),
            ("\u{3B8}.txt", "\u{3D1}.txt"),
            ("i.txt", "\u{131}.txt"),
            ("k.txt", "\u{212A}.txt"),
            ("ss", "\u{DF}"),
        ] {
            assert_eq!(collision_key(a), collision_key(b), "{a:?} {b:?}");
        }
        assert!(matches!(collision_key("s.txt"), Cow::Borrowed(_)));
    }

    #[test]
    fn directory_keys_lists_every_parent() {
        assert_eq!(directory_keys("a/b/c").collect::<Vec<_>>(), ["a", "a/b"]);
        assert_eq!(directory_keys("a").count(), 0);
    }

    #[test]
    fn sanitize_segment_examples() {
        for (input, expected) in [
            ("CON", "CON_"),
            ("con.txt", "con_.txt"),
            ("CON .txt", "CON_ .txt"),
            ("COM¹.md", "COM¹_.md"),
            ("CON.", "CON_"),
            ("notes.", "notes_"),
            ("a. . ", "a____"),
            ("...", "___"),
            ("\u{FF0E}\u{FF0E}", "__"),
            ("what?.md", "what_.md"),
            ("ok", "ok"),
        ] {
            assert_eq!(sanitize_segment(input), expected, "{input:?}");
        }
    }
}
