use std::collections::HashMap;
use std::path::PathBuf;

use lowerdeck_doctor::{
    describe_error, is_secret_key, parse_report, redact, redact_string, CodedError, ErrorKind,
    HttpStatusError, ERROR_CODE_KINDS, HTTP_STATUS_KINDS,
};
use serde::Deserialize;
use serde_json::Value;

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../spec/fixtures")
}

fn read(name: &str) -> Vec<u8> {
    std::fs::read(fixtures().join(name)).unwrap_or_else(|error| panic!("read {name}: {error}"))
}

fn names(dir: &str) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(fixtures().join(dir))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .filter(|name| name.ends_with(".json"))
        .map(|name| format!("{dir}/{name}"))
        .collect();
    names.sort();
    assert!(!names.is_empty(), "no fixtures in {dir}");
    names
}

#[derive(Deserialize)]
struct Vector {
    name: String,
    input: Value,
    expected: Value,
}

#[test]
fn redaction_vectors() {
    let vectors: Vec<Vector> = serde_json::from_slice(&read("redaction.json")).unwrap();

    for vector in vectors {
        assert_eq!(redact(&vector.input), vector.expected, "{}", vector.name);
    }
}

#[test]
fn redaction_caps_length_in_code_points() {
    let redacted = redact_string(&"é".repeat(3000));
    let kept = redacted.strip_suffix("…[truncated]").expect("suffix");

    assert_eq!(kept.chars().count(), 2048);
    assert_eq!(redact_string(&"a".repeat(2048)), "a".repeat(2048));
}

#[test]
fn secret_keys() {
    for (key, expected) in [
        ("password", true),
        ("DB_PASSWORD", true),
        ("x-api-key", true),
        ("pwd", true),
        ("Authorization", true),
        ("author", false),
        ("passive", false),
        ("keyId", false),
    ] {
        assert_eq!(is_secret_key(key), expected, "{key}");
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ErrorFixture {
    codes: HashMap<String, ErrorKind>,
    http_status: HashMap<String, ErrorKind>,
    hints: HashMap<ErrorKind, String>,
}

#[test]
fn error_tables_match_fixture() {
    let fixture: ErrorFixture = serde_json::from_slice(&read("error-codes.json")).unwrap();

    let codes: HashMap<String, ErrorKind> = ERROR_CODE_KINDS
        .iter()
        .map(|(code, kind)| (code.to_string(), *kind))
        .collect();
    assert_eq!(codes, fixture.codes);
    assert_eq!(codes.len(), ERROR_CODE_KINDS.len(), "duplicate codes");

    let statuses: HashMap<String, ErrorKind> = HTTP_STATUS_KINDS
        .iter()
        .map(|(status, kind)| (status.to_string(), *kind))
        .collect();
    assert_eq!(statuses, fixture.http_status);

    for kind in [
        ErrorKind::Dns,
        ErrorKind::ConnectionRefused,
        ErrorKind::ConnectionReset,
        ErrorKind::Timeout,
        ErrorKind::Tls,
        ErrorKind::Authentication,
        ErrorKind::Permission,
        ErrorKind::NotFound,
        ErrorKind::Limit,
        ErrorKind::Unavailable,
        ErrorKind::InvalidState,
        ErrorKind::Misconfigured,
        ErrorKind::Unknown,
    ] {
        assert_eq!(
            kind.hint(),
            fixture.hints.get(&kind).map(String::as_str),
            "{kind:?}"
        );
    }
}

#[test]
fn describes_errors() {
    let refused = std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "connection refused");
    let info = describe_error(&refused);
    assert_eq!(
        (info.kind, info.code.as_deref()),
        (ErrorKind::ConnectionRefused, Some("ECONNREFUSED"))
    );

    let coded = CodedError::new(
        "KMSInvalidStateException",
        "key arn:aws:kms:1 is pending deletion",
    );
    let info = describe_error(&coded);
    assert_eq!(info.kind, ErrorKind::InvalidState);
    assert_eq!(info.message, "key arn:aws:kms:1 is pending deletion");
    assert!(info.hint.is_some());

    let wrapped = CodedError::new(
        "Weird",
        HttpStatusError {
            status: 429,
            url: "https://api".into(),
        },
    );
    let info = describe_error(&wrapped);
    assert_eq!(
        (info.kind, info.code.as_deref()),
        (ErrorKind::Limit, Some("Weird"))
    );

    let status = HttpStatusError {
        status: 503,
        url: "https://api".into(),
    };
    assert_eq!(describe_error(&status).code.as_deref(), Some("HTTP 503"));

    let secret = std::io::Error::other("connect postgres://app:hunter2@db/core failed");
    let info = describe_error(&secret);
    assert_eq!((info.kind, info.hint), (ErrorKind::Unknown, None));
    assert_eq!(info.message, "connect postgres://app:***@db/core failed");
}

#[test]
fn valid_reports_round_trip() {
    for name in names("reports") {
        let data = read(&name);
        let report = parse_report(&data).unwrap_or_else(|error| panic!("{name}: {error}"));

        let original: Value = serde_json::from_slice(&data).unwrap();
        assert_eq!(serde_json::to_value(&report).unwrap(), original, "{name}");
    }
}

#[test]
fn invalid_reports_are_rejected() {
    for name in names("invalid") {
        assert!(parse_report(&read(&name)).is_err(), "{name} was accepted");
    }
}

#[test]
fn absent_optional_fields_serialize_as_null() {
    let report = parse_report(
        br#"{
            "doctor": 1, "component": "gateway", "instance": "gateway-0",
            "processStartedAt": "2026-11-17T10:00:00.000Z",
            "startedAt": "2026-11-17T10:00:00.000Z",
            "generatedAt": "2026-11-17T10:00:00.000Z",
            "durationMs": 0, "runId": "abc", "future": true,
            "checks": [{
                "id": "db.reachable", "title": "Database", "category": "database",
                "status": "pass", "severity": "critical", "durationMs": 1, "message": "OK"
            }]
        }"#,
    )
    .unwrap();

    let value = serde_json::to_value(&report).unwrap();
    for key in ["releaseVersion", "buildVersion", "channel", "publicUrl"] {
        assert_eq!(value[key], Value::Null, "{key}");
    }
    for key in ["target", "resolution", "details", "cachedAt"] {
        assert!(
            value["checks"][0].get(key).is_some_and(Value::is_null),
            "checks.0.{key}"
        );
    }
}
