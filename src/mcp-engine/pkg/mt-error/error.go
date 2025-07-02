package mterror

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ErrorKind string

const (
	// General errors
	UnknownErrorKind   ErrorKind = "unknown_error"
	InvalidRequestKind ErrorKind = "invalid_request"
	InternalErrorKind  ErrorKind = "internal_error"
	NotFoundKind       ErrorKind = "not_found"
	ConflictKind       ErrorKind = "conflict"
	ForbiddenKind      ErrorKind = "forbidden"
	TimeoutKind        ErrorKind = "timeout"
)

type MTError struct {
	Kind    ErrorKind         `json:"kind"`
	Message string            `json:"message"`
	Details map[string]string `json:"-"`

	inner error
}

func (e *MTError) Error() string {
	return fmt.Sprintf("%s: %s", e.Kind, e.Message)
}

func (e *MTError) MarshalJSON() ([]byte, error) {
	root := map[string]any{
		"kind":    e.Kind,
		"code":    e.Kind,
		"message": e.Message,
	}

	for k, v := range e.Details {
		if k != "kind" && k != "message" { // If there is a code, it should replace the kind
			root[k] = v
		}
	}

	return json.Marshal(root)
}

func New(kind ErrorKind, message string) *MTError {
	return &MTError{
		Kind:    kind,
		Message: message,
	}
}

func NewWithDetails(kind ErrorKind, message string, details map[string]string) *MTError {
	return &MTError{
		Kind:    kind,
		Message: message,
		Details: details,
	}
}

func NewWithInnerError(kind ErrorKind, message string, inner error) *MTError {
	return &MTError{
		Kind:    kind,
		Message: message,
		inner:   inner,
	}
}

func NewWithInnerErrorAndDetails(kind ErrorKind, message string, inner error, details map[string]string) *MTError {
	return &MTError{
		Kind:    kind,
		Message: message,
		inner:   inner,
		Details: details,
	}
}

func NewWithCodeAndDetails(kind ErrorKind, code string, message string, details map[string]string) *MTError {
	ourDetails := cloneMap(details)
	ourDetails["code"] = code

	return &MTError{
		Kind:    kind,
		Message: message,
		Details: ourDetails,
	}
}

func NewWithCodeAndInnerError(kind ErrorKind, code string, message string, inner error) *MTError {
	return &MTError{
		Kind:    kind,
		Message: message,
		inner:   inner,
		Details: map[string]string{"code": code},
	}
}

func NewWithCodeAndInnerErrorAndDetails(kind ErrorKind, code string, message string, inner error, details map[string]string) *MTError {
	ourDetails := cloneMap(details)
	ourDetails["code"] = code

	return &MTError{
		Kind:    kind,
		Message: message,
		inner:   inner,
		Details: ourDetails,
	}
}

func (e *MTError) Unwrap() error {
	if e.inner != nil {
		return e.inner
	}
	return nil
}

func AsMTError(err error) (*MTError, bool) {
	var apiErr *MTError
	if errors.As(err, &apiErr) {
		return apiErr, true
	}
	return nil, false
}

func (e *MTError) ToGRPCStatus() *status.Status {
	if e == nil {
		return status.New(codes.OK, "")
	}

	st := status.New(mtErrorKindToGRPCCode(e.Kind), e.Message)
	if len(e.Details) > 0 {
		details := &errdetails.ErrorInfo{
			Reason:   string(e.Kind),
			Metadata: e.Details,
		}
		st, _ = st.WithDetails(details)
	}

	return st
}

func mtErrorKindToGRPCCode(kind ErrorKind) codes.Code {
	switch kind {
	case UnknownErrorKind:
		return codes.Unknown
	case InvalidRequestKind:
		return codes.InvalidArgument
	case InternalErrorKind:
		return codes.Internal
	case NotFoundKind:
		return codes.NotFound
	case ConflictKind:
		return codes.AlreadyExists
	case ForbiddenKind:
		return codes.PermissionDenied
	case TimeoutKind:
		return codes.DeadlineExceeded
	default:
		return codes.Unknown
	}
}

func cloneMap(original map[string]string) map[string]string {
	if original == nil {
		return map[string]string{}
	}
	clone := make(map[string]string, len(original))
	maps.Copy(clone, original)
	return clone
}
