package ldrpc

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"strings"
)

// Error is the wire representation of a failed call, identical to a @lowerdeck/error
// ServiceError response: {"object":"error","ok":false,"status":404,"code":"not_found",...}.
// Fields the protocol doesn't name (entity, id, errors, ...) round-trip through Extra.
type Error struct {
	Status      int
	Code        string
	Message     string
	Hint        string
	Description string
	Reason      string
	Extra       map[string]any

	cause error
}

var reservedErrorKeys = map[string]bool{
	"object": true, "ok": true, "status": true, "code": true, "message": true,
	"hint": true, "description": true, "reason": true,
}

func NewError(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

func (e *Error) Error() string {
	return fmt.Sprintf("ldrpc: %s (%d %s)", e.Message, e.Status, e.Code)
}

func (e *Error) Unwrap() error {
	return e.cause
}

// WithCause attaches an underlying error for errors.Is/As. The cause never goes on the wire.
func (e *Error) WithCause(cause error) *Error {
	c := e.clone()
	c.cause = cause
	return c
}

func (e *Error) withStatus(status int) *Error {
	c := e.clone()
	c.Status = status
	return c
}

func (e *Error) clone() *Error {
	c := *e
	c.Extra = maps.Clone(e.Extra)
	return &c
}

func (e *Error) WithMessage(message string) *Error {
	c := e.clone()
	c.Message = message
	return c
}

func (e *Error) WithHint(hint string) *Error {
	c := e.clone()
	c.Hint = hint
	return c
}

func (e *Error) WithDescription(description string) *Error {
	c := e.clone()
	c.Description = description
	return c
}

func (e *Error) WithReason(reason string) *Error {
	c := e.clone()
	c.Reason = reason
	return c
}

// With attaches an additional top-level field to the error body. Reserved keys are ignored.
func (e *Error) With(key string, value any) *Error {
	if reservedErrorKeys[key] {
		return e
	}

	c := e.clone()
	if c.Extra == nil {
		c.Extra = map[string]any{}
	}
	c.Extra[key] = value
	return c
}

func (e *Error) MarshalJSON() ([]byte, error) {
	body := make(map[string]any, len(e.Extra)+8)
	for k, v := range e.Extra {
		if !reservedErrorKeys[k] {
			body[k] = v
		}
	}

	body["object"] = "error"
	body["ok"] = false
	body["status"] = e.Status
	body["code"] = e.Code
	body["message"] = e.Message
	if e.Hint != "" {
		body["hint"] = e.Hint
	}
	if e.Description != "" {
		body["description"] = e.Description
	}
	if e.Reason != "" {
		body["reason"] = e.Reason
	}

	return json.Marshal(body)
}

func (e *Error) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	*e = Error{}
	readString := func(key string) string {
		var s string
		if v, ok := raw[key]; ok {
			_ = json.Unmarshal(v, &s)
		}
		return s
	}

	if v, ok := raw["status"]; ok {
		_ = json.Unmarshal(v, &e.Status)
	}
	e.Code = readString("code")
	e.Message = readString("message")
	e.Hint = readString("hint")
	e.Description = readString("description")
	e.Reason = readString("reason")

	for k, v := range raw {
		if reservedErrorKeys[k] {
			continue
		}
		var value any
		if err := json.Unmarshal(v, &value); err != nil {
			return err
		}
		if e.Extra == nil {
			e.Extra = map[string]any{}
		}
		e.Extra[k] = value
	}

	return nil
}

// AsError unwraps err into an *Error, if it is (or wraps) one.
func AsError(err error) (*Error, bool) {
	var e *Error
	if errors.As(err, &e) {
		return e, true
	}
	return nil, false
}

// IsCode reports whether err is (or wraps) an *Error with the given code, e.g. one of the
// Code* constants of a generated package.
func IsCode(err error, code string) bool {
	e, ok := AsError(err)
	return ok && e.Code == code
}

// isErrorBody reports whether a decoded JSON object is a top-level error response, using
// the same test as @lowerdeck/rpc-client.
func isErrorBody(raw map[string]json.RawMessage) bool {
	var typename, object string
	var ok *bool
	if v, has := raw["__typename"]; has {
		_ = json.Unmarshal(v, &typename)
	}
	if v, has := raw["object"]; has {
		_ = json.Unmarshal(v, &object)
	}
	if v, has := raw["ok"]; has {
		_ = json.Unmarshal(v, &ok)
	}
	return typename == "error" || (object == "error" && ok != nil && !*ok)
}

// ValidationIssue mirrors @lowerdeck/validation's ValidationError.
type ValidationIssue struct {
	Code     string   `json:"code"`
	Message  string   `json:"message"`
	Path     []string `json:"path,omitempty"`
	Expected any      `json:"expected,omitempty"`
	Received any      `json:"received,omitempty"`
	Min      *float64 `json:"min,omitempty"`
	Max      *float64 `json:"max,omitempty"`
}

// ValidationErrors is returned by generated Validate() methods. The server turns it into a
// 400 invalid_data error with entity "call_data", matching TypeScript handlers.
type ValidationErrors []ValidationIssue

func (v ValidationErrors) Error() string {
	parts := make([]string, len(v))
	for i, issue := range v {
		parts[i] = strings.TrimSpace(strings.Join(issue.Path, ".") + " " + issue.Message)
	}
	return "ldrpc: invalid data: " + strings.Join(parts, "; ")
}

func ValidationError(entity string, issues ValidationErrors) *Error {
	return NewError(400, "invalid_data", "The provided data is invalid.").
		WithHint("Make sure the data you are sending follows the specification outlined in the documentation.").
		With("entity", entity).
		With("errors", []ValidationIssue(issues))
}

func InternalServerError() *Error {
	return NewError(500, "internal_server_error", "An internal server error occurred.")
}

func BadRequestError() *Error {
	return NewError(400, "bad_request", "The request is invalid.")
}

func NotFoundError(entity, id string) *Error {
	e := NewError(404, "not_found", fmt.Sprintf("The requested %s could not be found.", kebabCase(entity))).
		WithHint("Make sure the resource you are trying to access exists, that you have access to it and that it has not been deleted.").
		With("entity", entity)
	if id != "" {
		e = e.With("id", id)
	}
	return e
}

func UnauthorizedError() *Error {
	return NewError(401, "unauthorized", "You are not authorized to access this resource.").
		WithHint("Make sure you are logged in and have the correct permissions to access this resource.")
}

func ForbiddenError() *Error {
	return NewError(403, "forbidden", "You do not have permission to access this resource.")
}

func ConflictError() *Error {
	return NewError(409, "conflict", "A similar resource already exists.")
}

func GoneError() *Error {
	return NewError(410, "gone", "The requested resource is no longer available.")
}

func PaymentRequiredError() *Error {
	return NewError(402, "payment_required", "Payment is required to access this resource.")
}

func PreconditionFailedError() *Error {
	return NewError(412, "precondition_failed", "The precondition of the request failed.")
}

func NotAcceptableError() *Error {
	return NewError(406, "not_acceptable", "The requested resource is not acceptable.")
}

func NotImplementedError() *Error {
	return NewError(501, "not_implemented", "The requested resource is not implemented.")
}

func TooManyRequestsError() *Error {
	return NewError(429, "too_many_requests", "You have made too many requests in a short period of time.").
		WithHint("Please wait a moment and try again.")
}

func TimeoutError() *Error {
	return NewError(504, "timeout", "The request timed out.")
}

func MethodNotAllowedError() *Error {
	return NewError(405, "method_not_allowed", "The requested method is not allowed for this resource.")
}

func kebabCase(s string) string {
	var b strings.Builder
	for i, r := range s {
		switch {
		case r >= 'A' && r <= 'Z':
			if i > 0 {
				b.WriteByte('-')
			}
			b.WriteRune(r + ('a' - 'A'))
		case r == '_' || r == ' ':
			b.WriteByte('-')
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}
