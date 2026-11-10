use std::path::{Component, Path, PathBuf};

use object_store::zip::{
    plan_entry_names, validate_entry_path, validate_entry_paths, PathErrorReason, PlannedName,
    MAX_PATH_BYTES, MAX_SEGMENT_BYTES,
};
use proptest::prelude::*;

fn plan(paths: &[&str]) -> Vec<String> {
    let planned = plan_entry_names(paths.iter().copied()).unwrap();
    assert_valid_plan(paths, &planned);
    planned.into_iter().map(|name| name.archive_path).collect()
}

fn plan_error(paths: &[&str]) -> (String, PathErrorReason) {
    let error = plan_entry_names(paths.iter().copied()).expect_err(&format!("{paths:?}"));
    (error.path, error.reason)
}

fn assert_valid_plan(paths: &[&str], planned: &[PlannedName]) {
    assert_eq!(planned.len(), paths.len());

    for (path, name) in paths.iter().zip(planned) {
        assert_eq!(validate_entry_path(&name.archive_path), Ok(()), "{path:?}");
        assert_eq!(name.renamed, name.archive_path != *path);
    }

    validate_entry_paths(planned.iter().map(|name| name.archive_path.as_str())).unwrap();
}

#[test]
fn sanitizes_each_rule() {
    let long_ok = "a".repeat(MAX_SEGMENT_BYTES);

    let cases: Vec<(&str, &str)> = vec![
        ("..\\..\\evil", ".._.._evil"),
        ("..\\..\\", ".._.._"),
        ("C:\\Windows\\x", "C__Windows_x"),
        ("C:foo", "C_foo"),
        ("C:", "C_"),
        ("C:/Windows/system32", "C_/Windows/system32"),
        ("a:b", "a_b"),
        ("file.txt:stream", "file.txt_stream"),
        ("dir\\file", "dir_file"),
        ("\\\\server\\share", "__server_share"),
        ("<>:\"|?*", "_______"),
        ("what?.md", "what_.md"),
        ("a\0b", "a_b"),
        ("tab\there.txt", "tab_here.txt"),
        ("line\nbreak", "line_break"),
        ("esc\u{1b}[31m", "esc_[31m"),
        ("del\u{7f}", "del_"),
        ("c1\u{85}\u{9b}", "c1__"),
        ("invoice\u{202E}fdp.exe", "invoice_fdp.exe"),
        ("\u{2066}isolate\u{2069}", "_isolate_"),
        ("SKILL\u{200B}.md", "SKILL_.md"),
        ("\u{FEFF}bom.txt", "_bom.txt"),
        ("tag\u{E0041}s", "tag_s"),
        ("\u{FF0E}\u{FF0E}/x", "__/x"),
        ("a/\u{FF0E}", "a/_"),
        ("\u{FF0E}", "_"),
        ("\u{2025}", "_"),
        ("\u{FE52}\u{FE52}", "__"),
        ("a\u{FF0F}b", "a_b"),
        ("a\u{FF3C}b", "a_b"),
        ("file\u{2026}txt", "file_txt"),
        ("notes.", "notes_"),
        ("trailing ", "trailing_"),
        ("dots...", "dots___"),
        ("mixed. .", "mixed___"),
        ("...", "___"),
        (" ", "_"),
        ("dir./file", "dir_/file"),
        ("dir /file", "dir_/file"),
        ("CON", "CON_"),
        ("con", "con_"),
        ("aux.md", "aux_.md"),
        ("nul.tar.gz", "nul_.tar.gz"),
        ("PRN.txt", "PRN_.txt"),
        ("CON .txt", "CON_ .txt"),
        ("COM1", "COM1_"),
        ("lpt9.log", "lpt9_.log"),
        ("COM¹.md", "COM¹_.md"),
        ("conin$", "conin$_"),
        ("dir/LPT9/x", "dir/LPT9_/x"),
        ("CON.", "CON_"),
        ("CON:", "CON_"),
        ("CON?.txt", "CON_.txt"),
        ("x.CON", "x.CON"),
        ("CONSOLE", "CONSOLE"),
        (long_ok.as_str(), long_ok.as_str()),
    ];

    for (input, expected) in cases {
        assert_eq!(plan(&[input]), vec![expected.to_string()], "{input:?}");
    }
}

#[test]
fn leaves_valid_paths_alone() {
    let paths = [
        "SKILL.md",
        ".github/workflows/ci.yml",
        "scripts/run.sh",
        "..hidden",
        "日本語/ファイル.txt",
        "family 👨\u{200D}👩\u{200D}👧.png",
        "می\u{200C}خواهم.txt",
        "name with spaces.md",
        "readme~2.md",
    ];

    let planned = plan_entry_names(paths).unwrap();
    assert_valid_plan(&paths, &planned);
    assert!(planned.iter().all(|name| !name.renamed));
}

#[test]
fn hard_errors_are_not_sanitized() {
    let too_long = "a".repeat(MAX_PATH_BYTES + 1);
    let long_segment = "a".repeat(MAX_SEGMENT_BYTES + 1);
    let reserved_too_long = format!("con.{}", "a".repeat(MAX_SEGMENT_BYTES - 4));
    let many_reserved = vec!["con"; 1024].join("/");
    assert_eq!(many_reserved.len(), 4095);

    let cases: Vec<(Vec<&str>, &str, PathErrorReason)> = vec![
        (vec![""], "", PathErrorReason::Empty),
        (
            vec![too_long.as_str()],
            too_long.as_str(),
            PathErrorReason::TooLong {
                len: MAX_PATH_BYTES + 1,
            },
        ),
        (
            vec![long_segment.as_str()],
            long_segment.as_str(),
            PathErrorReason::SegmentTooLong {
                segment: long_segment.clone(),
            },
        ),
        (
            vec![reserved_too_long.as_str()],
            reserved_too_long.as_str(),
            PathErrorReason::SegmentTooLong {
                segment: format!("con_.{}", "a".repeat(MAX_SEGMENT_BYTES - 4)),
            },
        ),
        (
            vec![many_reserved.as_str()],
            many_reserved.as_str(),
            PathErrorReason::TooLong { len: 4095 + 1024 },
        ),
        (
            vec!["/etc/passwd"],
            "/etc/passwd",
            PathErrorReason::Absolute,
        ),
        (vec!["dir/"], "dir/", PathErrorReason::TrailingSlash),
        (vec!["a//b"], "a//b", PathErrorReason::EmptySegment),
        (vec!["."], ".", PathErrorReason::DotSegment),
        (vec![".."], "..", PathErrorReason::DotSegment),
        (vec!["../x"], "../x", PathErrorReason::DotSegment),
        (vec!["a/./b"], "a/./b", PathErrorReason::DotSegment),
        (vec!["a/.."], "a/..", PathErrorReason::DotSegment),
        (
            vec!["ok.md", "x", "ok.md"],
            "ok.md",
            PathErrorReason::Duplicate,
        ),
        (
            vec!["ok", "/bad", "../worse"],
            "/bad",
            PathErrorReason::Absolute,
        ),
    ];

    for (paths, offending, expected) in cases {
        assert_eq!(
            plan_error(&paths),
            (offending.to_string(), expected),
            "{paths:?}"
        );
    }
}

#[test]
fn renaming_that_would_exceed_length_limits_is_an_error() {
    let lower = "a".repeat(MAX_SEGMENT_BYTES);
    let upper = "A".repeat(MAX_SEGMENT_BYTES);

    let (path, reason) = plan_error(&[&lower, &upper]);
    assert_eq!(path, upper);
    assert_eq!(
        reason,
        PathErrorReason::SegmentTooLong {
            segment: format!("{upper}~2"),
        }
    );
}

#[test]
fn dedupes_case_and_normalization_variants() {
    let cases: Vec<(Vec<&str>, Vec<&str>)> = vec![
        (
            vec!["README.md", "readme.md"],
            vec!["README.md", "readme~2.md"],
        ),
        (
            vec!["caf\u{e9}.md", "cafe\u{301}.md"],
            vec!["caf\u{e9}.md", "cafe\u{301}~2.md"],
        ),
        (
            vec!["a.md", "A.md", "a.MD"],
            vec!["a.md", "A~2.md", "a~3.MD"],
        ),
        (vec!["Makefile", "makefile"], vec!["Makefile", "makefile~2"]),
        (
            vec!["archive.tar.gz", "ARCHIVE.tar.gz"],
            vec!["archive.tar.gz", "ARCHIVE.tar~2.gz"],
        ),
        (vec![".env", ".ENV"], vec![".env", ".ENV~2"]),
        (
            vec!["dir/File.txt", "dir/file.txt", "other/file.txt"],
            vec!["dir/File.txt", "dir/file~2.txt", "other/file.txt"],
        ),
        (
            vec!["Docs/a.md", "docs/b.md"],
            vec!["Docs/a.md", "docs/b.md"],
        ),
    ];

    for (input, expected) in cases {
        assert_eq!(plan(&input), expected, "{input:?}");
    }
}

#[test]
fn dedupes_names_that_ntfs_or_apfs_fold_together() {
    let cases: Vec<(Vec<&str>, Vec<&str>)> = vec![
        (vec!["s.txt", "\u{17F}.txt"], vec!["s.txt", "\u{17F}~2.txt"]),
        (vec!["\u{3C3}", "\u{3C2}"], vec!["\u{3C3}", "\u{3C2}~2"]),
        (
            vec!["\u{391}\u{3C3}", "\u{391}\u{3A3}"],
            vec!["\u{391}\u{3C3}", "\u{391}\u{3A3}~2"],
        ),
        (
            vec!["\u{3BC}.txt", "\u{B5}.txt"],
            vec!["\u{3BC}.txt", "\u{B5}~2.txt"],
        ),
        (
            vec!["\u{3B2}.txt", "\u{3D0}.txt"],
            vec!["\u{3B2}.txt", "\u{3D0}~2.txt"],
        ),
        (
            vec!["\u{3B8}.txt", "\u{3D1}.txt"],
            vec!["\u{3B8}.txt", "\u{3D1}~2.txt"],
        ),
        (vec!["i.txt", "\u{131}.txt"], vec!["i.txt", "\u{131}~2.txt"]),
        (
            vec!["k.txt", "\u{212A}.txt"],
            vec!["k.txt", "\u{212A}~2.txt"],
        ),
        (
            vec!["stra\u{DF}e", "strasse"],
            vec!["stra\u{DF}e", "strasse~2"],
        ),
        (
            vec!["\u{17F}.txt", "s~2.txt", "S.txt"],
            vec!["\u{17F}.txt", "s~2.txt", "S~3.txt"],
        ),
        (vec!["\u{17F}", "s/x"], vec!["\u{17F}~2", "s/x"]),
    ];

    for (input, expected) in cases {
        assert_eq!(plan(&input), expected, "{input:?}");
        let mut reversed = input.clone();
        reversed.reverse();
        let replanned = plan_entry_names(expected.iter().copied()).unwrap();
        assert!(replanned.iter().all(|name| !name.renamed), "{expected:?}");
        assert_eq!(plan(&reversed).len(), input.len());
    }
}

#[test]
fn sanitizes_best_fit_lookalikes_and_invisible_fillers() {
    for character in [
        '\u{2215}', '\u{2216}', '\u{2044}', '\u{A5}', '\u{20A9}', '\u{FF0F}', '\u{FF3C}',
        '\u{FF0E}', '\u{2024}', '\u{2025}', '\u{FE52}', '\u{FE68}', '\u{29F5}', '\u{29F8}',
        '\u{29F9}', '\u{34F}', '\u{115F}', '\u{1160}', '\u{3164}', '\u{FFA0}', '\u{2800}',
    ] {
        let input = format!("a{character}b.txt");
        assert_eq!(plan(&[&input]), vec!["a_b.txt".to_string()], "{input:?}");
    }

    let emoji = "heart \u{2764}\u{FE0F}.png";
    assert_eq!(plan(&[emoji]), vec![emoji.to_string()]);
}

#[test]
fn dedupes_collisions_created_by_sanitizing() {
    let cases: Vec<(Vec<&str>, Vec<&str>)> = vec![
        (vec!["a?.md", "a_.md"], vec!["a_.md", "a_~2.md"]),
        (vec!["a_.md", "a?.md"], vec!["a_.md", "a_~2.md"]),
        (
            vec!["a*.md", "a?.md", "a_.md"],
            vec!["a_.md", "a_~2.md", "a_~3.md"],
        ),
        (vec!["CON", "CON_"], vec!["CON_", "CON_~2"]),
        (vec!["notes.", "notes_"], vec!["notes_", "notes_~2"]),
        (vec!["a:b", "A_B"], vec!["a_b", "A_B~2"]),
        (vec!["\u{FF0E}\u{FF0E}/x", "__/X"], vec!["__/x", "__/X~2"]),
        (
            vec!["SKILL\u{200B}.md", "SKILL_.md", "skill_.md"],
            vec!["SKILL_.md", "SKILL_~2.md", "skill_~3.md"],
        ),
    ];

    for (input, expected) in cases {
        assert_eq!(plan(&input), expected, "{input:?}");
    }
}

#[test]
fn suffixes_skip_names_that_exist_anywhere_in_the_input() {
    let cases: Vec<(Vec<&str>, Vec<&str>)> = vec![
        (
            vec!["README.md", "readme.md", "readme~2.md"],
            vec!["README.md", "readme~3.md", "readme~2.md"],
        ),
        (
            vec!["readme~2.md", "README.md", "readme.md"],
            vec!["readme~2.md", "README.md", "readme~3.md"],
        ),
        (
            vec!["a", "A", "a~2", "A~3", "a~4/x"],
            vec!["a", "A~5", "a~2", "A~3", "a~4/x"],
        ),
    ];

    for (input, expected) in cases {
        assert_eq!(plan(&input), expected, "{input:?}");
    }
}

#[test]
fn files_that_are_also_directories_are_renamed() {
    let cases: Vec<(Vec<&str>, Vec<&str>)> = vec![
        (vec!["a", "a/b"], vec!["a~2", "a/b"]),
        (vec!["a/b", "a"], vec!["a/b", "a~2"]),
        (vec!["A", "a/b"], vec!["A~2", "a/b"]),
        (vec!["a/b", "A"], vec!["a/b", "A~2"]),
        (vec!["x/y/z.txt", "x/y"], vec!["x/y/z.txt", "x/y~2"]),
        (vec!["x/y", "X/Y/z.txt"], vec!["x/y~2", "X/Y/z.txt"]),
        (vec!["a.md", "a.md/x"], vec!["a~2.md", "a.md/x"]),
        (vec!["a", "a/b", "a~2/c"], vec!["a~3", "a/b", "a~2/c"]),
        (vec!["a", "A", "a/b"], vec!["a~2", "A~3", "a/b"]),
        (vec!["a?", "a_/b"], vec!["a_~2", "a_/b"]),
    ];

    for (input, expected) in cases {
        assert_eq!(plan(&input), expected, "{input:?}");
    }
}

#[test]
fn renamed_flag_reports_any_change() {
    let planned = plan_entry_names(["ok.md", "OK.md", "bad?.md"]).unwrap();
    assert_eq!(
        planned,
        vec![
            PlannedName {
                archive_path: "ok.md".to_string(),
                renamed: false
            },
            PlannedName {
                archive_path: "OK~2.md".to_string(),
                renamed: true
            },
            PlannedName {
                archive_path: "bad_.md".to_string(),
                renamed: true
            },
        ]
    );
}

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

fn is_hard_error(reason: &PathErrorReason) -> bool {
    matches!(
        reason,
        PathErrorReason::Empty
            | PathErrorReason::TooLong { .. }
            | PathErrorReason::SegmentTooLong { .. }
            | PathErrorReason::Absolute
            | PathErrorReason::TrailingSlash
            | PathErrorReason::EmptySegment
            | PathErrorReason::DotSegment
            | PathErrorReason::Duplicate
    )
}

fn nasty_segment() -> impl Strategy<Value = String> {
    let piece = prop_oneof![
        Just(".".to_string()),
        Just("..".to_string()),
        Just(" ".to_string()),
        Just("\\".to_string()),
        Just(":".to_string()),
        Just("C:".to_string()),
        Just("?".to_string()),
        Just("_".to_string()),
        Just("~2".to_string()),
        Just(".md".to_string()),
        Just("\0".to_string()),
        Just("\u{202E}".to_string()),
        Just("\u{200B}".to_string()),
        Just("\u{FF0E}".to_string()),
        Just("\u{2025}".to_string()),
        Just("\u{2026}".to_string()),
        Just("\u{301}".to_string()),
        Just("con".to_string()),
        Just("CON".to_string()),
        Just("aux".to_string()),
        Just("é".to_string()),
        Just("e\u{301}".to_string()),
        Just("s".to_string()),
        Just("\u{17F}".to_string()),
        Just("\u{3C3}".to_string()),
        Just("\u{3C2}".to_string()),
        Just("\u{DF}".to_string()),
        Just("ss".to_string()),
        Just("\u{B5}".to_string()),
        Just("\u{131}".to_string()),
        Just("\u{2215}".to_string()),
        Just("\u{A5}".to_string()),
        Just("\u{3164}".to_string()),
        Just("a".to_string()),
        Just("A".to_string()),
        "[a-cA-C]{1,3}",
        any::<char>().prop_map(|character| character.to_string()),
    ];
    proptest::collection::vec(piece, 1..5).prop_map(|pieces| pieces.concat())
}

fn nasty_path() -> impl Strategy<Value = String> {
    proptest::collection::vec(nasty_segment(), 1..4).prop_map(|segments| segments.join("/"))
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(4096))]

    #[test]
    fn arbitrary_strings_never_panic(paths in proptest::collection::vec(any::<String>(), 0..8)) {
        let _ = plan_entry_names(paths.iter().map(String::as_str));
    }

    #[test]
    fn plans_are_valid_idempotent_deterministic_and_contained(
        paths in proptest::collection::vec(nasty_path(), 0..12)
    ) {
        let inputs: Vec<&str> = paths.iter().map(String::as_str).collect();

        match plan_entry_names(inputs.iter().copied()) {
            Err(error) => {
                prop_assert!(is_hard_error(&error.reason), "{error}");
                prop_assert!(inputs.contains(&error.path.as_str()));
            }
            Ok(planned) => {
                prop_assert_eq!(planned.len(), inputs.len());

                let outputs: Vec<&str> =
                    planned.iter().map(|name| name.archive_path.as_str()).collect();
                for (input, name) in inputs.iter().zip(&planned) {
                    prop_assert_eq!(validate_entry_path(&name.archive_path), Ok(()));
                    prop_assert_eq!(name.renamed, name.archive_path != *input);
                    for segment in name.archive_path.split('/') {
                        prop_assert!(!segment.is_empty() && segment != "." && segment != "..");
                    }

                    let base = Path::new("/tmp/extract-base");
                    let target = naive_extract_target(base, &name.archive_path);
                    prop_assert!(
                        target.as_ref().is_some_and(|target| target.starts_with(base) && target != base),
                        "{:?} escapes to {:?}", name.archive_path, target
                    );
                }
                prop_assert!(validate_entry_paths(outputs.iter().copied()).is_ok());

                prop_assert_eq!(&plan_entry_names(inputs.iter().copied()).unwrap(), &planned);

                let replanned = plan_entry_names(outputs.iter().copied()).unwrap();
                prop_assert!(replanned.iter().all(|name| !name.renamed));
                prop_assert_eq!(
                    replanned.iter().map(|name| name.archive_path.as_str()).collect::<Vec<_>>(),
                    outputs
                );
            }
        }
    }

    #[test]
    fn single_segments_never_sanitize_to_dot_or_empty(segment in nasty_segment()) {
        prop_assume!(!segment.is_empty() && segment != "." && segment != ".." && !segment.contains('/'));
        prop_assume!(segment.len() < MAX_SEGMENT_BYTES);

        let planned = plan_entry_names([segment.as_str()]).unwrap();
        let name = &planned[0].archive_path;
        prop_assert!(!name.is_empty() && name != "." && name != "..");
        prop_assert!(!name.contains('/'));
        prop_assert!(!name.ends_with(['.', ' ']));
    }

    #[test]
    fn strictly_valid_unique_sets_are_unchanged(paths in proptest::collection::vec(nasty_path(), 0..12)) {
        let inputs: Vec<&str> = paths.iter().map(String::as_str).collect();
        if validate_entry_paths(inputs.iter().copied()).is_ok() {
            let planned = plan_entry_names(inputs.iter().copied()).unwrap();
            prop_assert!(planned.iter().all(|name| !name.renamed));
        }
    }
}
