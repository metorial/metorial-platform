package mterror

import (
	"encoding/json"
	"errors"
	"fmt"
)

type MTError struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"-"`

	inner error `json:"-"` // Optional inner error for more context
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

func New(code, message string) *MTError {
	return &MTError{
		Code:    code,
		Message: message,
	}
}

func WithDetails(code, message string, details map[string]any) *MTError {
	return &MTError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

func WithInnerError(code, message string, inner error) *MTError {
	return &MTError{
		Code:    code,
		Message: message,
		inner:   inner,
	}
}

func WithInnerErrorAndDetails(code, message string, inner error, details map[string]any) *MTError {
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
