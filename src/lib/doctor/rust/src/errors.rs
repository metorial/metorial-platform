use std::error::Error;
use std::fmt;
use std::io;

use serde::{Deserialize, Serialize};

use crate::redact::redact_string;

const MAX_CAUSE_DEPTH: usize = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorKind {
    Dns,
    ConnectionRefused,
    ConnectionReset,
    Timeout,
    Tls,
    Authentication,
    Permission,
    NotFound,
    Limit,
    Unavailable,
    InvalidState,
    Misconfigured,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub kind: ErrorKind,
    pub code: Option<String>,
    pub message: String,
    pub hint: Option<String>,
}

/// Attaches a protocol error code (an AWS error code, a SQLSTATE, ...) to an error so
/// `describe_error` can classify it. The message stays the wrapped error's message.
#[derive(Debug)]
pub struct CodedError {
    pub code: String,
    pub source: Box<dyn Error + Send + Sync + 'static>,
}

impl CodedError {
    pub fn new(
        code: impl Into<String>,
        source: impl Into<Box<dyn Error + Send + Sync + 'static>>,
    ) -> Self {
        Self {
            code: code.into(),
            source: source.into(),
        }
    }
}

impl fmt::Display for CodedError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.source.fmt(f)
    }
}

impl Error for CodedError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        Some(self.source.as_ref())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpStatusError {
    pub status: u16,
    pub url: String,
}

impl fmt::Display for HttpStatusError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} responded with HTTP {}", self.url, self.status)
    }
}

impl Error for HttpStatusError {}

// Mirrors spec/fixtures/error-codes.json; tests/conformance.rs keeps them equal.
pub static ERROR_CODE_KINDS: &[(&str, ErrorKind)] = &[
    ("ENOTFOUND", ErrorKind::Dns),
    ("EAI_AGAIN", ErrorKind::Dns),
    ("EAI_NONAME", ErrorKind::Dns),
    ("ECONNREFUSED", ErrorKind::ConnectionRefused),
    ("P1001", ErrorKind::ConnectionRefused),
    ("ECONNRESET", ErrorKind::ConnectionReset),
    ("EPIPE", ErrorKind::ConnectionReset),
    ("P1017", ErrorKind::ConnectionReset),
    ("ETIMEDOUT", ErrorKind::Timeout),
    ("ESOCKETTIMEDOUT", ErrorKind::Timeout),
    ("UND_ERR_CONNECT_TIMEOUT", ErrorKind::Timeout),
    ("UND_ERR_HEADERS_TIMEOUT", ErrorKind::Timeout),
    ("TimeoutError", ErrorKind::Timeout),
    ("RequestTimeout", ErrorKind::Timeout),
    ("RequestTimeoutException", ErrorKind::Timeout),
    ("DEADLINE_EXCEEDED", ErrorKind::Timeout),
    ("P1002", ErrorKind::Timeout),
    ("P1008", ErrorKind::Timeout),
    ("CERT_HAS_EXPIRED", ErrorKind::Tls),
    ("DEPTH_ZERO_SELF_SIGNED_CERT", ErrorKind::Tls),
    ("SELF_SIGNED_CERT_IN_CHAIN", ErrorKind::Tls),
    ("UNABLE_TO_VERIFY_LEAF_SIGNATURE", ErrorKind::Tls),
    ("UNABLE_TO_GET_ISSUER_CERT_LOCALLY", ErrorKind::Tls),
    ("ERR_TLS_CERT_ALTNAME_INVALID", ErrorKind::Tls),
    ("P1011", ErrorKind::Tls),
    ("28P01", ErrorKind::Authentication),
    ("28000", ErrorKind::Authentication),
    ("P1000", ErrorKind::Authentication),
    ("NOAUTH", ErrorKind::Authentication),
    ("WRONGPASS", ErrorKind::Authentication),
    ("AuthenticationFailed", ErrorKind::Authentication),
    ("UnrecognizedClientException", ErrorKind::Authentication),
    ("InvalidClientTokenId", ErrorKind::Authentication),
    ("InvalidAccessKeyId", ErrorKind::Authentication),
    ("ExpiredToken", ErrorKind::Authentication),
    ("ExpiredTokenException", ErrorKind::Authentication),
    ("InvalidSignatureException", ErrorKind::Authentication),
    ("SignatureDoesNotMatch", ErrorKind::Authentication),
    ("UNAUTHENTICATED", ErrorKind::Authentication),
    ("InvalidAuthenticationInfo", ErrorKind::Authentication),
    ("NoAuthenticationInformation", ErrorKind::Authentication),
    ("42501", ErrorKind::Permission),
    ("P1010", ErrorKind::Permission),
    ("AccessDenied", ErrorKind::Permission),
    ("AccessDeniedException", ErrorKind::Permission),
    ("AllAccessDisabled", ErrorKind::Permission),
    ("Unauthorized", ErrorKind::Permission),
    ("PERMISSION_DENIED", ErrorKind::Permission),
    ("AuthorizationPermissionMismatch", ErrorKind::Permission),
    ("AuthorizationFailure", ErrorKind::Permission),
    ("Forbidden", ErrorKind::Permission),
    ("3D000", ErrorKind::NotFound),
    ("P1003", ErrorKind::NotFound),
    ("NotFoundException", ErrorKind::NotFound),
    ("ResourceNotFoundException", ErrorKind::NotFound),
    ("NoSuchBucket", ErrorKind::NotFound),
    ("NoSuchKey", ErrorKind::NotFound),
    ("NOT_FOUND", ErrorKind::NotFound),
    ("ContainerNotFound", ErrorKind::NotFound),
    ("BlobNotFound", ErrorKind::NotFound),
    ("NamespaceNotFound", ErrorKind::NotFound),
    ("53300", ErrorKind::Limit),
    ("P2037", ErrorKind::Limit),
    ("ThrottlingException", ErrorKind::Limit),
    ("TooManyRequestsException", ErrorKind::Limit),
    ("LimitExceededException", ErrorKind::Limit),
    ("SlowDown", ErrorKind::Limit),
    ("RESOURCE_EXHAUSTED", ErrorKind::Limit),
    ("57P03", ErrorKind::Unavailable),
    ("CLUSTERDOWN", ErrorKind::Unavailable),
    ("LOADING", ErrorKind::Unavailable),
    ("NotWritablePrimary", ErrorKind::Unavailable),
    ("MongoServerSelectionError", ErrorKind::Unavailable),
    ("UNAVAILABLE", ErrorKind::Unavailable),
    ("ServiceUnavailable", ErrorKind::Unavailable),
    ("ServiceUnavailableException", ErrorKind::Unavailable),
    ("KeyUnavailableException", ErrorKind::Unavailable),
    ("KMSInvalidStateException", ErrorKind::InvalidState),
    ("DisabledException", ErrorKind::InvalidState),
    ("FAILED_PRECONDITION", ErrorKind::InvalidState),
    ("PermanentRedirect", ErrorKind::Misconfigured),
    ("AuthorizationHeaderMalformed", ErrorKind::Misconfigured),
    (
        "IllegalLocationConstraintException",
        ErrorKind::Misconfigured,
    ),
    ("InvalidRegion", ErrorKind::Misconfigured),
];

pub static HTTP_STATUS_KINDS: &[(u16, ErrorKind)] = &[
    (401, ErrorKind::Authentication),
    (403, ErrorKind::Permission),
    (404, ErrorKind::NotFound),
    (408, ErrorKind::Timeout),
    (429, ErrorKind::Limit),
    (502, ErrorKind::Unavailable),
    (503, ErrorKind::Unavailable),
    (504, ErrorKind::Timeout),
];

impl ErrorKind {
    pub fn hint(self) -> Option<&'static str> {
        match self {
            ErrorKind::Dns => Some("The hostname could not be resolved. Check the host name and the cluster's DNS."),
            ErrorKind::ConnectionRefused => Some("Nothing is listening at that address. Check the host, the port and that the service is running."),
            ErrorKind::ConnectionReset => Some("The connection was closed unexpectedly. Check proxies, TLS settings and the service's logs."),
            ErrorKind::Timeout => Some("The request timed out. Check network policies, firewalls and security groups between the two."),
            ErrorKind::Tls => Some("The TLS handshake failed. Check the certificate chain, the hostname and any custom CA."),
            ErrorKind::Authentication => Some("The credentials were rejected. Check the username, password, key or token."),
            ErrorKind::Permission => Some("The credentials are valid but lack permission for this operation. Grant the missing permission."),
            ErrorKind::NotFound => Some("The resource does not exist. Check its name and region, or create it."),
            ErrorKind::Limit => Some("A limit or quota was reached. Raise the limit or reduce the load."),
            ErrorKind::Unavailable => Some("The service is unavailable. Check its health and status."),
            ErrorKind::InvalidState => Some("The resource is in a state that does not allow this operation, for example a disabled key."),
            ErrorKind::Misconfigured => Some("The request reached the service but the configuration does not match it, for example the wrong region or endpoint."),
            ErrorKind::Unknown => None,
        }
    }
}

pub fn classify_code(code: &str) -> Option<ErrorKind> {
    ERROR_CODE_KINDS
        .iter()
        .find(|(candidate, _)| *candidate == code)
        .map(|(_, kind)| *kind)
}

pub fn describe_error(error: &(dyn Error + 'static)) -> ErrorInfo {
    describe_error_with_code(error, None)
}

pub fn describe_error_with_code(error: &(dyn Error + 'static), code: Option<&str>) -> ErrorInfo {
    let chain = causes(error);
    let message = error.to_string();

    let mut codes: Vec<String> = code.map(str::to_string).into_iter().collect();
    for item in &chain {
        codes.extend(codes_of(*item));
    }
    codes.retain(|code| !code.is_empty());

    let first_code = codes.first().cloned();
    for candidate in &codes {
        if let Some(kind) = classify_code(candidate) {
            return described(kind, Some(candidate.clone()), &message);
        }
    }

    for item in &chain {
        if let Some(status) = item.downcast_ref::<HttpStatusError>() {
            if let Some((_, kind)) = HTTP_STATUS_KINDS
                .iter()
                .find(|(code, _)| *code == status.status)
            {
                let code = first_code
                    .clone()
                    .unwrap_or_else(|| format!("HTTP {}", status.status));
                return described(*kind, Some(code), &message);
            }
        }
    }

    for item in &chain {
        if item.is::<tokio::time::error::Elapsed>() {
            return described(ErrorKind::Timeout, first_code, &message);
        }
        if let Some(io_error) = item.downcast_ref::<io::Error>() {
            if io_error.to_string().contains("failed to lookup address") {
                return described(ErrorKind::Dns, first_code, &message);
            }
            if io_error.kind() == io::ErrorKind::InvalidData
                && io_error.to_string().contains("certificate")
            {
                return described(ErrorKind::Tls, first_code, &message);
            }
        }
    }

    described(ErrorKind::Unknown, first_code, &message)
}

fn described(kind: ErrorKind, code: Option<String>, message: &str) -> ErrorInfo {
    ErrorInfo {
        kind,
        code,
        message: redact_string(message),
        hint: kind.hint().map(str::to_string),
    }
}

fn causes<'a>(error: &'a (dyn Error + 'static)) -> Vec<&'a (dyn Error + 'static)> {
    let mut chain = vec![error];
    let mut current = error;

    while let Some(source) = current.source() {
        if chain.len() >= MAX_CAUSE_DEPTH {
            break;
        }
        chain.push(source);
        current = source;
    }

    chain
}

fn codes_of(error: &(dyn Error + 'static)) -> Vec<String> {
    if let Some(coded) = error.downcast_ref::<CodedError>() {
        return vec![coded.code.clone()];
    }

    if let Some(io_error) = error.downcast_ref::<io::Error>() {
        let code = match io_error.kind() {
            io::ErrorKind::ConnectionRefused => Some("ECONNREFUSED"),
            io::ErrorKind::ConnectionReset | io::ErrorKind::ConnectionAborted => Some("ECONNRESET"),
            io::ErrorKind::BrokenPipe => Some("EPIPE"),
            io::ErrorKind::TimedOut => Some("ETIMEDOUT"),
            _ => None,
        };
        return code.map(|code| vec![code.to_string()]).unwrap_or_default();
    }

    Vec::new()
}
