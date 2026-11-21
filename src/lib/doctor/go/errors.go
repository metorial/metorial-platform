package doctor

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net"
	"strconv"
	"syscall"
)

const maxCauseDepth = 16

type ErrorKind string

const (
	KindDNS               ErrorKind = "dns"
	KindConnectionRefused ErrorKind = "connection_refused"
	KindConnectionReset   ErrorKind = "connection_reset"
	KindTimeout           ErrorKind = "timeout"
	KindTLS               ErrorKind = "tls"
	KindAuthentication    ErrorKind = "authentication"
	KindPermission        ErrorKind = "permission"
	KindNotFound          ErrorKind = "not_found"
	KindLimit             ErrorKind = "limit"
	KindUnavailable       ErrorKind = "unavailable"
	KindInvalidState      ErrorKind = "invalid_state"
	KindMisconfigured     ErrorKind = "misconfigured"
	KindUnknown           ErrorKind = "unknown"
)

type ErrorInfo struct {
	Kind    ErrorKind `json:"kind"`
	Code    *string   `json:"code"`
	Message string    `json:"message"`
	Hint    *string   `json:"hint"`
}

// Mirrors spec/fixtures/error-codes.json; errors_test.go keeps them equal.
var ErrorCodeKinds = map[string]ErrorKind{
	"ENOTFOUND":  KindDNS,
	"EAI_AGAIN":  KindDNS,
	"EAI_NONAME": KindDNS,

	"ECONNREFUSED": KindConnectionRefused,
	"P1001":        KindConnectionRefused,

	"ECONNRESET": KindConnectionReset,
	"EPIPE":      KindConnectionReset,
	"P1017":      KindConnectionReset,

	"ETIMEDOUT":               KindTimeout,
	"ESOCKETTIMEDOUT":         KindTimeout,
	"UND_ERR_CONNECT_TIMEOUT": KindTimeout,
	"UND_ERR_HEADERS_TIMEOUT": KindTimeout,
	"TimeoutError":            KindTimeout,
	"RequestTimeout":          KindTimeout,
	"RequestTimeoutException": KindTimeout,
	"DEADLINE_EXCEEDED":       KindTimeout,
	"P1002":                   KindTimeout,
	"P1008":                   KindTimeout,

	"CERT_HAS_EXPIRED":                  KindTLS,
	"DEPTH_ZERO_SELF_SIGNED_CERT":       KindTLS,
	"SELF_SIGNED_CERT_IN_CHAIN":         KindTLS,
	"UNABLE_TO_VERIFY_LEAF_SIGNATURE":   KindTLS,
	"UNABLE_TO_GET_ISSUER_CERT_LOCALLY": KindTLS,
	"ERR_TLS_CERT_ALTNAME_INVALID":      KindTLS,
	"P1011":                             KindTLS,

	"28P01":                       KindAuthentication,
	"28000":                       KindAuthentication,
	"P1000":                       KindAuthentication,
	"NOAUTH":                      KindAuthentication,
	"WRONGPASS":                   KindAuthentication,
	"AuthenticationFailed":        KindAuthentication,
	"UnrecognizedClientException": KindAuthentication,
	"InvalidClientTokenId":        KindAuthentication,
	"InvalidAccessKeyId":          KindAuthentication,
	"ExpiredToken":                KindAuthentication,
	"ExpiredTokenException":       KindAuthentication,
	"InvalidSignatureException":   KindAuthentication,
	"SignatureDoesNotMatch":       KindAuthentication,
	"UNAUTHENTICATED":             KindAuthentication,
	"InvalidAuthenticationInfo":   KindAuthentication,
	"NoAuthenticationInformation": KindAuthentication,

	"42501":                           KindPermission,
	"P1010":                           KindPermission,
	"AccessDenied":                    KindPermission,
	"AccessDeniedException":           KindPermission,
	"AllAccessDisabled":               KindPermission,
	"Unauthorized":                    KindPermission,
	"PERMISSION_DENIED":               KindPermission,
	"AuthorizationPermissionMismatch": KindPermission,
	"AuthorizationFailure":            KindPermission,
	"Forbidden":                       KindPermission,

	"3D000":                     KindNotFound,
	"P1003":                     KindNotFound,
	"NotFoundException":         KindNotFound,
	"ResourceNotFoundException": KindNotFound,
	"NoSuchBucket":              KindNotFound,
	"NoSuchKey":                 KindNotFound,
	"NOT_FOUND":                 KindNotFound,
	"ContainerNotFound":         KindNotFound,
	"BlobNotFound":              KindNotFound,
	"NamespaceNotFound":         KindNotFound,

	"53300":                    KindLimit,
	"P2037":                    KindLimit,
	"ThrottlingException":      KindLimit,
	"TooManyRequestsException": KindLimit,
	"LimitExceededException":   KindLimit,
	"SlowDown":                 KindLimit,
	"RESOURCE_EXHAUSTED":       KindLimit,

	"57P03":                       KindUnavailable,
	"CLUSTERDOWN":                 KindUnavailable,
	"LOADING":                     KindUnavailable,
	"NotWritablePrimary":          KindUnavailable,
	"MongoServerSelectionError":   KindUnavailable,
	"UNAVAILABLE":                 KindUnavailable,
	"ServiceUnavailable":          KindUnavailable,
	"ServiceUnavailableException": KindUnavailable,
	"KeyUnavailableException":     KindUnavailable,

	"KMSInvalidStateException": KindInvalidState,
	"DisabledException":        KindInvalidState,
	"FAILED_PRECONDITION":      KindInvalidState,

	"PermanentRedirect":                  KindMisconfigured,
	"AuthorizationHeaderMalformed":       KindMisconfigured,
	"IllegalLocationConstraintException": KindMisconfigured,
	"InvalidRegion":                      KindMisconfigured,
}

var HTTPStatusKinds = map[string]ErrorKind{
	"401": KindAuthentication,
	"403": KindPermission,
	"404": KindNotFound,
	"408": KindTimeout,
	"429": KindLimit,
	"502": KindUnavailable,
	"503": KindUnavailable,
	"504": KindTimeout,
}

var ErrorKindHints = map[ErrorKind]string{
	KindDNS:               "The hostname could not be resolved. Check the host name and the cluster's DNS.",
	KindConnectionRefused: "Nothing is listening at that address. Check the host, the port and that the service is running.",
	KindConnectionReset:   "The connection was closed unexpectedly. Check proxies, TLS settings and the service's logs.",
	KindTimeout:           "The request timed out. Check network policies, firewalls and security groups between the two.",
	KindTLS:               "The TLS handshake failed. Check the certificate chain, the hostname and any custom CA.",
	KindAuthentication:    "The credentials were rejected. Check the username, password, key or token.",
	KindPermission:        "The credentials are valid but lack permission for this operation. Grant the missing permission.",
	KindNotFound:          "The resource does not exist. Check its name and region, or create it.",
	KindLimit:             "A limit or quota was reached. Raise the limit or reduce the load.",
	KindUnavailable:       "The service is unavailable. Check its health and status.",
	KindInvalidState:      "The resource is in a state that does not allow this operation, for example a disabled key.",
	KindMisconfigured:     "The request reached the service but the configuration does not match it, for example the wrong region or endpoint.",
}

var errnoCodes = map[syscall.Errno]string{
	syscall.ECONNREFUSED: "ECONNREFUSED",
	syscall.ECONNRESET:   "ECONNRESET",
	syscall.EPIPE:        "EPIPE",
	syscall.ETIMEDOUT:    "ETIMEDOUT",
}

// ClassifyCode looks up the shared code table. It returns "" for unknown codes.
func ClassifyCode(code string) ErrorKind {
	return ErrorCodeKinds[code]
}

func DescribeError(err error) ErrorInfo {
	if err == nil {
		return describedAs(KindUnknown, "", "")
	}

	chain := causes(err)
	message := err.Error()
	firstCode := ""

	for _, item := range chain {
		for _, code := range codesOf(item) {
			if firstCode == "" {
				firstCode = code
			}
			if kind := ClassifyCode(code); kind != "" {
				return describedAs(kind, code, message)
			}
		}
	}

	for _, item := range chain {
		if status, ok := item.(interface{ HTTPStatusCode() int }); ok {
			code := strconv.Itoa(status.HTTPStatusCode())
			if kind, ok := HTTPStatusKinds[code]; ok {
				if firstCode == "" {
					firstCode = "HTTP " + code
				}
				return describedAs(kind, firstCode, message)
			}
		}
	}

	for _, item := range chain {
		var dnsErr *net.DNSError
		if errors.As(item, &dnsErr) {
			return describedAs(KindDNS, firstCode, message)
		}

		var netErr net.Error
		if errors.Is(item, context.DeadlineExceeded) || (errors.As(item, &netErr) && netErr.Timeout()) {
			return describedAs(KindTimeout, firstCode, message)
		}

		var recordErr tls.RecordHeaderError
		if errors.As(item, &recordErr) {
			return describedAs(KindTLS, firstCode, message)
		}
	}

	return describedAs(KindUnknown, firstCode, message)
}

func describedAs(kind ErrorKind, code, message string) ErrorInfo {
	info := ErrorInfo{Kind: kind, Message: RedactString(message)}
	if code != "" {
		info.Code = &code
	}
	if hint, ok := ErrorKindHints[kind]; ok {
		info.Hint = &hint
	}
	return info
}

func causes(err error) []error {
	var chain []error
	queue := []error{err}

	for len(queue) > 0 && len(chain) < maxCauseDepth {
		current := queue[0]
		queue = queue[1:]
		if current == nil {
			continue
		}
		chain = append(chain, current)

		switch unwrapped := current.(type) {
		case interface{ Unwrap() []error }:
			queue = append(queue, unwrapped.Unwrap()...)
		case interface{ Unwrap() error }:
			queue = append(queue, unwrapped.Unwrap())
		}
	}

	return chain
}

// codesOf finds codes on a single error without unwrapping, so the chain order decides which
// code wins. AWS smithy errors expose ErrorCode() and pgconn errors SQLState(), which keeps this
// package free of those imports.
func codesOf(err error) []string {
	var codes []string
	add := func(code string) {
		if code != "" {
			codes = append(codes, code)
		}
	}

	if coded, ok := err.(interface{ ErrorCode() string }); ok {
		add(coded.ErrorCode())
	}
	if coded, ok := err.(interface{ SQLState() string }); ok {
		add(coded.SQLState())
	}
	if errno, ok := err.(syscall.Errno); ok {
		add(errnoCodes[errno])
	}
	if dnsErr, ok := err.(*net.DNSError); ok && dnsErr.IsNotFound {
		add("ENOTFOUND")
	}

	switch certErr := err.(type) {
	case x509.CertificateInvalidError:
		if certErr.Reason == x509.Expired {
			add("CERT_HAS_EXPIRED")
		} else {
			add("UNABLE_TO_VERIFY_LEAF_SIGNATURE")
		}
	case *x509.CertificateInvalidError:
		if certErr.Reason == x509.Expired {
			add("CERT_HAS_EXPIRED")
		} else {
			add("UNABLE_TO_VERIFY_LEAF_SIGNATURE")
		}
	case x509.HostnameError, *x509.HostnameError:
		add("ERR_TLS_CERT_ALTNAME_INVALID")
	case x509.UnknownAuthorityError, *x509.UnknownAuthorityError:
		add("UNABLE_TO_GET_ISSUER_CERT_LOCALLY")
	}

	return codes
}
