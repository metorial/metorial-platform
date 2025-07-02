package mterror

import (
	"encoding/json"
	"errors"
	"fmt"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ErrorCode string

const (
	// General errors
	UnknownErrorCode   ErrorCode = "unknown_error"
	InvalidRequestCode ErrorCode = "invalid_request"
	InternalErrorCode  ErrorCode = "internal_error"
	NotFoundCode       ErrorCode = "not_found"
	ConflictCode       ErrorCode = "conflict"
	ForbiddenCode      ErrorCode = "forbidden"
	TimeoutCode        ErrorCode = "timeout"
)

type MTError struct {
	Code    ErrorCode         `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"-"`

	inner error
}

func (e *MTError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *MTError) MarshalJSON() ([]byte, error) {
	root := map[string]any{
		"code":    e.Code,
		"message": e.Message,
	}

	for k, v := range e.Details {
		if k != "code" && k != "message" {
			root[k] = v
		}
	}

	return json.Marshal(root)
}

func New(code ErrorCode, message string) *MTError {
	return &MTError{
		Code:    code,
		Message: message,
	}
}

func NewWithDetails(code ErrorCode, message string, details map[string]string) *MTError {
	return &MTError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

func NewWithInnerError(code ErrorCode, message string, inner error) *MTError {
	return &MTError{
		Code:    code,
		Message: message,
		inner:   inner,
	}
}

func NewWithInnerErrorAndDetails(code ErrorCode, message string, inner error, details map[string]string) *MTError {
	return &MTError{
		Code:    code,
		Message: message,
		inner:   inner,
		Details: details,
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

	st := status.New(mtErrorCodeToGRPCCode(e.Code), e.Message)
	if len(e.Details) > 0 {
		details := &errdetails.ErrorInfo{
			Reason:   string(e.Code),
			Metadata: e.Details,
		}
		st, _ = st.WithDetails(details)
	}

	return st
}

func mtErrorCodeToGRPCCode(code ErrorCode) codes.Code {
	switch code {
	case UnknownErrorCode:
		return codes.Unknown
	case InvalidRequestCode:
		return codes.InvalidArgument
	case InternalErrorCode:
		return codes.Internal
	case NotFoundCode:
		return codes.NotFound
	case ConflictCode:
		return codes.AlreadyExists
	case ForbiddenCode:
		return codes.PermissionDenied
	case TimeoutCode:
		return codes.DeadlineExceeded
	default:
		return codes.Unknown
	}
}
