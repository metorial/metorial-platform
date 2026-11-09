// Package export holds what every provider's manifest export shares: the structured error
// returned to Origin, the result and progress counters, and the request options.
package export

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Code string

const (
	CodeManifestInvalid      Code = "manifest_invalid"
	CodeSourceNotFound       Code = "source_not_found"
	CodeContentMismatch      Code = "content_mismatch"
	CodeDeletionGuardTripped Code = "deletion_guard_tripped"
	CodeTreeTooLarge         Code = "tree_too_large"
	CodeRateLimited          Code = "rate_limited"
	CodeFileTooLarge         Code = "file_too_large"
	CodeLFSQuotaExceeded     Code = "lfs_quota_exceeded"
	CodeBranchMissing        Code = "branch_missing"
	CodeDestinationTooLarge  Code = "destination_too_large"
	CodePathConflict         Code = "path_conflict"
	CodeUnimplemented        Code = "unimplemented"
)

// StatusPrefix starts the gRPC status message of every structured export error; the
// rest of the message is the JSON encoding of Payload. Origin's TS side parses it from
// the nice-grpc ClientError's `details`.
const StatusPrefix = "origin_export_error:"

// MaxStatusBytes keeps the percent-encoded grpc-message header well under grpc-js's
// default 8 KiB metadata limit.
const MaxStatusBytes = 6 << 10

const (
	maxSamples       = 20
	maxMessageBytes  = 1024
	maxDetailPathLen = 1024
)

// Details carries code-specific context. Paths and Keys are samples; Total is the full
// count they were sampled from.
type Details struct {
	Paths []string `json:"paths,omitempty"`
	Keys  []string `json:"keys,omitempty"`
	Total int      `json:"total,omitempty"`

	Path   string `json:"path,omitempty"`
	Key    string `json:"key,omitempty"`
	Line   int    `json:"line,omitempty"`
	Reason string `json:"reason,omitempty"`
	Size   int64  `json:"size,omitempty"`
	Limit  int64  `json:"limit,omitempty"`

	UnexpectedDeletes        int     `json:"unexpectedDeletes,omitempty"`
	ScopeEntries             int     `json:"scopeEntries,omitempty"`
	MaxUnexpectedDeletes     uint32  `json:"maxUnexpectedDeletes,omitempty"`
	MaxUnexpectedDeleteRatio float64 `json:"maxUnexpectedDeleteRatio,omitempty"`
}

// Progress is reported with a failure too, so Origin can tell whether the attempt moved
// the branch forward.
type Progress struct {
	Stats          Stats
	CommitsCreated uint32
	RetryAfter     time.Time
	NewRemoteState *RemoteState
	Lineage        Lineage
	WriteRequests  uint32
}

type Error struct {
	Code     Code
	Message  string
	Details  Details
	Progress Progress
	Err      error
}

func (e *Error) Error() string {
	if e.Message == "" {
		return string(e.Code)
	}
	return string(e.Code) + ": " + e.Message
}

func (e *Error) Unwrap() error { return e.Err }

func NewError(code Code, format string, args ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...)}
}

// Unimplemented is what provider manifest exporters return until they are built.
func Unimplemented(provider string) *Error {
	return NewError(CodeUnimplemented, "manifest export to %s is not implemented yet", provider)
}

func (e *Error) grpcCode() codes.Code {
	switch e.Code {
	case CodeManifestInvalid:
		return codes.InvalidArgument
	case CodeSourceNotFound:
		return codes.NotFound
	case CodeRateLimited:
		return codes.ResourceExhausted
	case CodeUnimplemented:
		return codes.Unimplemented
	default:
		return codes.FailedPrecondition
	}
}

// Payload is the JSON after StatusPrefix.
type Payload struct {
	Code           Code         `json:"code"`
	Message        string       `json:"message"`
	Details        Details      `json:"details"`
	CommitsCreated uint32       `json:"commitsCreated"`
	RetryAfterUnix int64        `json:"retryAfterUnix,omitempty"`
	Stats          Stats        `json:"stats"`
	NewRemoteState *RemoteState `json:"newRemoteState,omitempty"`
	Lineage
	WriteRequests uint32 `json:"writeRequests"`
}

func (e *Error) payload() Payload {
	payload := Payload{
		Code:           e.Code,
		Message:        truncate(e.Message, maxMessageBytes),
		Details:        e.Details,
		CommitsCreated: e.Progress.CommitsCreated,
		Stats:          e.Progress.Stats,
		NewRemoteState: e.Progress.NewRemoteState,
		Lineage:        e.Progress.Lineage,
		WriteRequests:  e.Progress.WriteRequests,
	}
	if !e.Progress.RetryAfter.IsZero() {
		payload.RetryAfterUnix = e.Progress.RetryAfter.Unix()
	}

	payload.Details.Path = truncate(payload.Details.Path, maxDetailPathLen)
	payload.Details.Key = truncate(payload.Details.Key, maxDetailPathLen)
	if payload.Details.Total == 0 {
		payload.Details.Total = max(len(payload.Details.Paths), len(payload.Details.Keys))
	}
	payload.Details.Paths = sample(payload.Details.Paths)
	payload.Details.Keys = sample(payload.Details.Keys)
	return payload
}

func sample(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	out := make([]string, 0, min(len(values), maxSamples))
	for _, value := range values[:min(len(values), maxSamples)] {
		out = append(out, truncate(value, maxDetailPathLen))
	}
	return out
}

func truncate(s string, limit int) string {
	if len(s) <= limit {
		return s
	}

	cut := limit
	for cut > 0 && s[cut]&0xC0 == 0x80 {
		cut--
	}
	return s[:cut] + "…"
}

// StatusMessage renders the error as StatusPrefix + JSON, dropping detail samples until
// it fits MaxStatusBytes once percent-encoded.
func (e *Error) StatusMessage() string {
	payload := e.payload()

	for {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return StatusPrefix + `{"code":"` + string(e.Code) + `","message":"unencodable error"}`
		}

		message := StatusPrefix + string(encoded)
		if percentEncodedLen(message) <= MaxStatusBytes {
			return message
		}

		switch {
		case len(payload.Details.Paths) > 1:
			payload.Details.Paths = payload.Details.Paths[:len(payload.Details.Paths)/2]
		case len(payload.Details.Keys) > 1:
			payload.Details.Keys = payload.Details.Keys[:len(payload.Details.Keys)/2]
		case len(payload.Details.Paths) == 1 || len(payload.Details.Keys) == 1:
			payload.Details.Paths, payload.Details.Keys = nil, nil
		case payload.Details.Path != "" || payload.Details.Key != "":
			payload.Details.Path, payload.Details.Key = truncate(payload.Details.Path, 128), truncate(payload.Details.Key, 128)
			if len(payload.Message) > 256 {
				payload.Message = truncate(payload.Message, 256)
			} else {
				payload.Details.Path, payload.Details.Key = "", ""
			}
		default:
			payload.Message = truncate(payload.Message, 256)
			payload.NewRemoteState = nil
			encoded, _ = json.Marshal(payload)
			return StatusPrefix + string(encoded)
		}
	}
}

// percentEncodedLen mirrors gRPC's grpc-message encoding: bytes outside printable ASCII
// and '%' become three bytes.
func percentEncodedLen(s string) int {
	n := 0
	for i := 0; i < len(s); i++ {
		if c := s[i]; c < 0x20 || c > 0x7E || c == '%' {
			n += 3
		} else {
			n++
		}
	}
	return n
}

func (e *Error) GRPCStatus() *status.Status {
	return status.New(e.grpcCode(), e.StatusMessage())
}

// As returns the structured export error in err's chain, if any.
func As(err error) (*Error, bool) {
	var exportErr *Error
	if errors.As(err, &exportErr) {
		return exportErr, true
	}
	return nil, false
}
