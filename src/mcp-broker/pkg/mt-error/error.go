package mterror

import (
	"encoding/json"
	"fmt"
)

type APIError struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"-"`

	inner error `json:"-"` // Optional inner error for more context
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *APIError) MarshalJSON() ([]byte, error) {
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

func New(code, message string) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
	}
}

func WithDetails(code, message string, details map[string]any) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

func WithInnerError(code, message string, inner error, details map[string]any) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
		inner:   inner,
		Details: details,
	}
}

func (e *APIError) Unwrap() error {
	if e.inner != nil {
		return e.inner
	}
	return nil
}
