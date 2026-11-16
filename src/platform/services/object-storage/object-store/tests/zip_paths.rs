use std::path::{Component, Path, PathBuf};

use object_store::zip::{validate_entry_path, validate_entry_paths, PathErrorReason};
use proptest::prelude::*;

fn reason(path: &str) -> PathErrorReason {
    let error = validate_entry_path(path).expect_err(path);
    assert_eq!(error.path, path);
    error.reason
}

fn segment(text: &str) -> String {
    text.to_string()
}

#[test]
fn accepts_ordinary_paths() {
    let long_segment = "a".repeat(255);
    let long_path = vec!["abcdefg"; 512].join("/");
    assert_eq!(long_path.len(), 4095);

    for path in [
        "SKILL.md",
        "README",
        "plugins/a/skills/b/SKILL.md",
        ".github/workflows/ci.yml",
        ".env.example",
        "..hidden",
        "a..b",
        "name with spaces in the middle.txt",
        " leading space.txt",
        "日本語/ファイル.txt",
        "émoji 🎉 name.md",
        "family 👨\u{200D}👩\u{200D}👧.png",
        "می\u{200C}خواهم.txt",
        "café.txt",
        "CONSOLE.txt",
        "COM0",
        "LPT10",
        "x.CON",
        "con-fig.md",
        "nul_file",
        "a/b/c/d/e/f/g/h/i/j/k.txt",
        "~user/file",
        "-dash",
        "#hash%percent&amp;",
        "C",
        "a.b.c",
        long_segment.as_str(),
        long_path.as_str(),
    ] {
        assert_eq!(validate_entry_path(path), Ok(()), "{path:?}");
    }
}

#[test]
fn rejects_each_rule_with_its_reason() {
    let too_long = vec!["abcdefg"; 513].join("/");
    let long_segment = format!("dir/{}", "a".repeat(256));

    let cases: Vec<(&str, PathErrorReason)> = vec![
        ("", PathErrorReason::Empty),
        (too_long.as_str(), PathErrorReason::TooLong { len: 4103 }),
        (
            long_segment.as_str(),
            PathErrorReason::SegmentTooLong {
                segment: "a".repeat(256),
            },
        ),
        ("/etc/passwd", PathErrorReason::Absolute),
        ("/", PathErrorReason::Absolute),
        ("//server/share", PathErrorReason::Absolute),
        ("C:", PathErrorReason::DriveLetter),
        ("C:/Windows/system32", PathErrorReason::DriveLetter),
        ("c:foo", PathErrorReason::DriveLetter),
        ("z:\\x", PathErrorReason::DriveLetter),
        ("dir\\file", PathErrorReason::Backslash),
        ("..\\evil", PathErrorReason::Backslash),
        ("\\\\server\\share", PathErrorReason::Backslash),
        ("a\0b", PathErrorReason::ControlCharacter(0)),
        ("a\nb", PathErrorReason::ControlCharacter(0x0a)),
        ("a\rb", PathErrorReason::ControlCharacter(0x0d)),
        ("a\tb", PathErrorReason::ControlCharacter(0x09)),
        ("a\u{1b}[31mb", PathErrorReason::ControlCharacter(0x1b)),
        ("a\u{1f}b", PathErrorReason::ControlCharacter(0x1f)),
        ("a\u{7f}b", PathErrorReason::ControlCharacter(0x7f)),
        ("a\u{85}b", PathErrorReason::ControlCharacter(0x85)),
        ("a\u{9b}b", PathErrorReason::ControlCharacter(0x9b)),
        (
            "invoice\u{202E}fdp.exe",
            PathErrorReason::InvisibleCharacter(0x202e),
        ),
        ("a\u{202A}b", PathErrorReason::InvisibleCharacter(0x202a)),
        ("a\u{202B}b", PathErrorReason::InvisibleCharacter(0x202b)),
        ("a\u{202C}b", PathErrorReason::InvisibleCharacter(0x202c)),
        ("a\u{202D}b", PathErrorReason::InvisibleCharacter(0x202d)),
        ("a\u{2066}b", PathErrorReason::InvisibleCharacter(0x2066)),
        ("a\u{2067}b", PathErrorReason::InvisibleCharacter(0x2067)),
        ("a\u{2068}b", PathErrorReason::InvisibleCharacter(0x2068)),
        ("a\u{2069}b", PathErrorReason::InvisibleCharacter(0x2069)),
        ("a\u{200E}b", PathErrorReason::InvisibleCharacter(0x200e)),
        ("a\u{200F}b", PathErrorReason::InvisibleCharacter(0x200f)),
        ("a\u{061C}b", PathErrorReason::InvisibleCharacter(0x061c)),
        (
            "SKILL\u{200B}.md",
            PathErrorReason::InvisibleCharacter(0x200b),
        ),
        (
            "\u{FEFF}SKILL.md",
            PathErrorReason::InvisibleCharacter(0xfeff),
        ),
        ("a\u{2060}b", PathErrorReason::InvisibleCharacter(0x2060)),
        ("a\u{00AD}b", PathErrorReason::InvisibleCharacter(0xad)),
        ("a\u{2028}b", PathErrorReason::InvisibleCharacter(0x2028)),
        ("a\u{2029}b", PathErrorReason::InvisibleCharacter(0x2029)),
        ("a\u{E0041}b", PathErrorReason::InvisibleCharacter(0xe0041)),
        ("dir/", PathErrorReason::TrailingSlash),
        ("a/b/", PathErrorReason::TrailingSlash),
        ("a//b", PathErrorReason::EmptySegment),
        (".", PathErrorReason::DotSegment),
        ("..", PathErrorReason::DotSegment),
        ("../etc/passwd", PathErrorReason::DotSegment),
        ("a/../../b", PathErrorReason::DotSegment),
        ("a/./b", PathErrorReason::DotSegment),
        ("a/..", PathErrorReason::DotSegment),
        ("./a", PathErrorReason::DotSegment),
        ("a:b", PathErrorReason::DriveLetter),
        ("ab:c", PathErrorReason::WindowsInvalidCharacter(':')),
        (
            "file.txt:stream",
            PathErrorReason::WindowsInvalidCharacter(':'),
        ),
        ("a<b", PathErrorReason::WindowsInvalidCharacter('<')),
        ("a>b", PathErrorReason::WindowsInvalidCharacter('>')),
        ("a\"b", PathErrorReason::WindowsInvalidCharacter('"')),
        ("a|b", PathErrorReason::WindowsInvalidCharacter('|')),
        ("a?b", PathErrorReason::WindowsInvalidCharacter('?')),
        ("a*b", PathErrorReason::WindowsInvalidCharacter('*')),
        (
            "CON",
            PathErrorReason::WindowsReservedName {
                segment: segment("CON"),
            },
        ),
        (
            "dir/con.txt",
            PathErrorReason::WindowsReservedName {
                segment: segment("con.txt"),
            },
        ),
        (
            "Prn.tar.gz",
            PathErrorReason::WindowsReservedName {
                segment: segment("Prn.tar.gz"),
            },
        ),
        (
            "aux",
            PathErrorReason::WindowsReservedName {
                segment: segment("aux"),
            },
        ),
        (
            "NUL.md",
            PathErrorReason::WindowsReservedName {
                segment: segment("NUL.md"),
            },
        ),
        (
            "com1",
            PathErrorReason::WindowsReservedName {
                segment: segment("com1"),
            },
        ),
        (
            "COM9.log",
            PathErrorReason::WindowsReservedName {
                segment: segment("COM9.log"),
            },
        ),
        (
            "lpt5",
            PathErrorReason::WindowsReservedName {
                segment: segment("lpt5"),
            },
        ),
        (
            "LPT9.txt",
            PathErrorReason::WindowsReservedName {
                segment: segment("LPT9.txt"),
            },
        ),
        (
            "COM¹",
            PathErrorReason::WindowsReservedName {
                segment: segment("COM¹"),
            },
        ),
        (
            "conin$",
            PathErrorReason::WindowsReservedName {
                segment: segment("conin$"),
            },
        ),
        (
            "CON .txt",
            PathErrorReason::WindowsReservedName {
                segment: segment("CON .txt"),
            },
        ),
        (
            "a/Aux/b",
            PathErrorReason::WindowsReservedName {
                segment: segment("Aux"),
            },
        ),
        (
            "file.",
            PathErrorReason::TrailingDotOrSpace {
                segment: segment("file."),
            },
        ),
        (
            "file ",
            PathErrorReason::TrailingDotOrSpace {
                segment: segment("file "),
            },
        ),
        (
            "dir./file",
            PathErrorReason::TrailingDotOrSpace {
                segment: segment("dir."),
            },
        ),
        (
            "...",
            PathErrorReason::TrailingDotOrSpace {
                segment: segment("..."),
            },
        ),
        (
            " ",
            PathErrorReason::TrailingDotOrSpace {
                segment: segment(" "),
            },
        ),
        (
            "\u{FF0E}\u{FF0E}/evil",
            PathErrorReason::LookalikeCharacter(0xff0e),
        ),
        ("a/\u{FF0E}", PathErrorReason::LookalikeCharacter(0xff0e)),
        ("a\u{FF0F}b", PathErrorReason::LookalikeCharacter(0xff0f)),
        ("a\u{FF3C}b", PathErrorReason::LookalikeCharacter(0xff3c)),
        (
            "\u{FE52}\u{FE52}",
            PathErrorReason::LookalikeCharacter(0xfe52),
        ),
        ("\u{2025}", PathErrorReason::LookalikeCharacter(0x2025)),
        (
            "file\u{2026}txt",
            PathErrorReason::LookalikeCharacter(0x2026),
        ),
        ("\u{2488}md", PathErrorReason::LookalikeCharacter(0x2488)),
    ];

    for (path, expected) in cases {
        assert_eq!(reason(path), expected, "{path:?}");
    }
}

#[test]
fn rejects_windows_best_fit_lookalikes_and_invisible_fillers() {
    for lookalike in [
        '\u{2215}', '\u{2216}', '\u{2044}', '\u{00A5}', '\u{20A9}', '\u{FF0F}', '\u{FF3C}',
        '\u{FF0E}', '\u{2024}', '\u{2025}', '\u{FE52}', '\u{FE68}', '\u{29F5}', '\u{29F8}',
        '\u{29F9}',
    ] {
        let path = format!("a{lookalike}b.txt");
        assert_eq!(
            reason(&path),
            PathErrorReason::LookalikeCharacter(lookalike as u32),
            "{path:?}"
        );
    }

    for filler in [
        '\u{034F}', '\u{115F}', '\u{1160}', '\u{3164}', '\u{FFA0}', '\u{2800}',
    ] {
        let path = format!("a{filler}b.txt");
        assert_eq!(
            reason(&path),
            PathErrorReason::InvisibleCharacter(filler as u32),
            "{path:?}"
        );
    }

    for selected in [
        "heart \u{2764}\u{FE0F}.png",
        "text \u{2764}\u{FE0E}.md",
        "\u{8FBB}\u{E0100}.txt",
    ] {
        assert_eq!(validate_entry_path(selected), Ok(()), "{selected:?}");
    }
}

#[test]
fn rejects_names_that_ntfs_or_apfs_fold_together() {
    let pairs = [
        ("s.txt", "\u{017F}.txt"),
        ("\u{03C3}", "\u{03C2}"),
        ("\u{0391}\u{03C3}", "\u{0391}\u{03A3}"),
        ("\u{03BC}.txt", "\u{00B5}.txt"),
        ("\u{03B2}.txt", "\u{03D0}.txt"),
        ("\u{03B8}.txt", "\u{03D1}.txt"),
        ("i.txt", "\u{0131}.txt"),
        ("k.txt", "\u{212A}.txt"),
        ("stra\u{00DF}e", "strasse"),
    ];

    for (first, second) in pairs {
        let error = validate_entry_paths([first, second]).expect_err(second);
        assert_eq!(error.path, second);
        assert_eq!(
            error.reason,
            PathErrorReason::CaseCollision {
                other: first.to_string()
            }
        );

        let nested = [format!("{first}/x"), format!("{second}/y")];
        validate_entry_paths(nested.iter().map(String::as_str)).unwrap();
        let file_and_directory = [first.to_string(), format!("{second}/y")];
        let error =
            validate_entry_paths(file_and_directory.iter().map(String::as_str)).unwrap_err();
        assert!(
            matches!(error.reason, PathErrorReason::FileDirectoryConflict { .. }),
            "{first:?} {second:?}: {error}"
        );
    }
}

#[test]
fn rejects_exact_case_and_normalization_duplicates() {
    let cases: Vec<(Vec<&str>, &str, PathErrorReason)> = vec![
        (
            vec!["a.txt", "b.txt", "a.txt"],
            "a.txt",
            PathErrorReason::Duplicate,
        ),
        (
            vec!["README.md", "readme.md"],
            "readme.md",
            PathErrorReason::CaseCollision {
                other: "README.md".to_string(),
            },
        ),
        (
            vec!["Dir/File", "dir/file"],
            "dir/file",
            PathErrorReason::CaseCollision {
                other: "Dir/File".to_string(),
            },
        ),
        (
            vec!["caf\u{e9}.txt", "cafe\u{301}.txt"],
            "cafe\u{301}.txt",
            PathErrorReason::CaseCollision {
                other: "caf\u{e9}.txt".to_string(),
            },
        ),
        (
            vec!["ÄRGER.md", "ärger.md"],
            "ärger.md",
            PathErrorReason::CaseCollision {
                other: "ÄRGER.md".to_string(),
            },
        ),
        (
            vec!["\u{212A}elvin", "kelvin"],
            "kelvin",
            PathErrorReason::CaseCollision {
                other: "\u{212A}elvin".to_string(),
            },
        ),
        (
            vec!["ΣΊΣΥΦΟΣ", "σίσυφος"],
            "σίσυφος",
            PathErrorReason::CaseCollision {
                other: "ΣΊΣΥΦΟΣ".to_string(),
            },
        ),
    ];

    for (paths, offending, expected) in cases {
        let error = validate_entry_paths(paths.iter().copied()).expect_err(offending);
        assert_eq!(error.path, offending, "{paths:?}");
        assert_eq!(error.reason, expected, "{paths:?}");
        assert!(error.reason.is_conflict());
    }
}

#[test]
fn rejects_paths_that_are_both_file_and_directory() {
    let cases: Vec<(Vec<&str>, &str, &str)> = vec![
        (vec!["a", "a/b"], "a/b", "a"),
        (vec!["a/b", "a"], "a", "a/b"),
        (vec!["x/y/z.txt", "x/y"], "x/y", "x/y/z.txt"),
        (vec!["x/y", "x/y/z/w.txt"], "x/y/z/w.txt", "x/y"),
        (vec!["Docs", "docs/readme.md"], "docs/readme.md", "Docs"),
        (vec!["docs/readme.md", "DOCS"], "DOCS", "docs/readme.md"),
    ];

    for (paths, offending, other) in cases {
        let error = validate_entry_paths(paths.iter().copied()).expect_err(offending);
        assert_eq!(error.path, offending, "{paths:?}");
        assert_eq!(
            error.reason,
            PathErrorReason::FileDirectoryConflict {
                other: other.to_string()
            },
            "{paths:?}"
        );
    }
}

#[test]
fn accepts_distinct_sets_including_shared_directories() {
    validate_entry_paths([
        "a/b.txt",
        "a/c.txt",
        "a/d/e.txt",
        "ab",
        "a.b",
        "b/a",
        "café/x",
        "cafe/x",
        "file",
        "file.txt",
        ".github/workflows/ci.yml",
        ".github/CODEOWNERS",
    ])
    .unwrap();
}

#[test]
fn set_validation_also_checks_each_path() {
    let error = validate_entry_paths(["ok.txt", "../bad"]).unwrap_err();
    assert_eq!(error.path, "../bad");
    assert_eq!(error.reason, PathErrorReason::DotSegment);
}

#[test]
fn error_display_includes_escaped_path_and_reason() {
    let message = validate_entry_path("a\nb").unwrap_err().to_string();
    assert_eq!(
        message,
        "invalid zip entry path \"a\\nb\": path contains control character U+000A"
    );
}

/// Joins `relative` onto `base` and resolves `.`/`..` lexically, the way a naive extractor
/// would, returning `None` if a component re-roots the path.
fn naive_extract_target(base: &Path, relative: &str) -> Option<PathBuf> {
    let mut resolved = PathBuf::new();
    for component in base.join(relative).components() {
        match component {
            Component::ParentDir => {
                resolved.pop();
            }
            Component::CurDir => {}
            Component::Normal(part) => resolved.push(part),
            Component::RootDir | Component::Prefix(_) => {
                if resolved.as_os_str().is_empty() {
                    resolved.push(component);
                } else {
                    return None;
                }
            }
        }
    }
    Some(resolved)
}

fn path_like_strings() -> impl Strategy<Value = String> {
    let piece = prop_oneof![
        Just("/".to_string()),
        Just(".".to_string()),
        Just("..".to_string()),
        Just("\\".to_string()),
        Just(":".to_string()),
        Just("C:".to_string()),
        Just(" ".to_string()),
        Just("\0".to_string()),
        Just("\u{202E}".to_string()),
        Just("\u{FF0E}".to_string()),
        Just("con".to_string()),
        Just("é".to_string()),
        "[a-zA-Z0-9_-]{1,8}",
        any::<char>().prop_map(|c| c.to_string()),
    ];
    proptest::collection::vec(piece, 0..12).prop_map(|pieces| pieces.concat())
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(4096))]

    #[test]
    fn arbitrary_bytes_never_panic(bytes in proptest::collection::vec(any::<u8>(), 0..300)) {
        let path = String::from_utf8_lossy(&bytes);
        let _ = validate_entry_path(&path);
        let _ = validate_entry_paths([path.as_ref(), "x", "X"]);
    }

    #[test]
    fn arbitrary_strings_never_panic(path in any::<String>()) {
        let _ = validate_entry_path(&path);
    }

    #[test]
    fn accepted_paths_stay_inside_the_extraction_directory(path in path_like_strings()) {
        if validate_entry_path(&path).is_ok() {
            let base = Path::new("/tmp/extract-base");
            let target = naive_extract_target(base, &path);
            prop_assert!(
                target.as_ref().is_some_and(|target| target.starts_with(base) && target != base),
                "{path:?} escapes to {target:?}"
            );
            prop_assert!(Path::new(&path)
                .components()
                .all(|component| matches!(component, Component::Normal(_))));
            prop_assert!(!path.contains(['\\', ':', '\0']));
            prop_assert!(validate_entry_paths([path.as_str()]).is_ok());
        }
    }
}
