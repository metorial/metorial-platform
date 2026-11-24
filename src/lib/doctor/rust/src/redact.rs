use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};

const MAX_DEPTH: usize = 8;
const MAX_STRING_LENGTH: usize = 2048;
const REDACTED: &str = "***";
const TRUNCATED_VALUE: &str = "[truncated]";
const TRUNCATED_SUFFIX: &str = "…[truncated]";

const SECRET_KEY_PARTS: &[&str] = &[
    "password",
    "passwd",
    "secret",
    "token",
    "apikey",
    "privatekey",
    "credential",
    "authorization",
    "cookie",
    "signature",
];

const SECRET_KEY_NAMES: &[&str] = &["pwd", "pass", "auth"];

static PEM: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END [A-Z0-9 ]+-----").unwrap()
});

static URL_PASSWORD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"([a-zA-Z][a-zA-Z0-9+.-]*://)([^\s:/?#@]*):([^\s/?#@]*)@").unwrap()
});

static QUERY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)([?&;](?:password|passwd|pwd|secret|token|access_token|refresh_token|id_token|api_key|apikey|key|sig|signature|credential|auth|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&\s#"']*"#).unwrap()
});

static BEARER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}").unwrap());

pub fn is_secret_key(key: &str) -> bool {
    let normalized: String = key
        .to_lowercase()
        .chars()
        .filter(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        .collect();

    SECRET_KEY_NAMES.contains(&normalized.as_str())
        || SECRET_KEY_PARTS
            .iter()
            .any(|part| normalized.contains(part))
}

pub fn redact_string(value: &str) -> String {
    let result = PEM.replace_all(value, "[redacted ${1}]");
    let result = URL_PASSWORD.replace_all(&result, format!("${{1}}${{2}}:{REDACTED}@"));
    let result = QUERY.replace_all(&result, format!("${{1}}{REDACTED}"));
    let result = BEARER.replace_all(&result, format!("${{1}} {REDACTED}"));

    if result.chars().count() <= MAX_STRING_LENGTH {
        return result.into_owned();
    }

    let mut truncated: String = result.chars().take(MAX_STRING_LENGTH).collect();
    truncated.push_str(TRUNCATED_SUFFIX);
    truncated
}

pub fn redact(value: &Value) -> Value {
    redact_value(value, 0)
}

pub fn redact_details(details: &Map<String, Value>) -> Map<String, Value> {
    match redact_value(&Value::Object(details.clone()), 0) {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

fn redact_value(value: &Value, depth: usize) -> Value {
    match value {
        Value::String(string) => Value::String(redact_string(string)),
        Value::Array(items) => {
            if depth >= MAX_DEPTH {
                return Value::String(TRUNCATED_VALUE.into());
            }
            Value::Array(
                items
                    .iter()
                    .map(|item| redact_value(item, depth + 1))
                    .collect(),
            )
        }
        Value::Object(map) => {
            if depth >= MAX_DEPTH {
                return Value::String(TRUNCATED_VALUE.into());
            }
            let redacted = map
                .iter()
                .map(|(key, item)| {
                    let value = if is_secret_key(key) && !item.is_null() {
                        Value::String(REDACTED.into())
                    } else {
                        redact_value(item, depth + 1)
                    };
                    (key.clone(), value)
                })
                .collect();
            Value::Object(redacted)
        }
        other => other.clone(),
    }
}
