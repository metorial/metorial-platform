package ldrpc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// Validator is implemented by generated input types. A ValidationErrors result becomes a
// 400 invalid_data response with entity "call_data".
type Validator interface {
	Validate() error
}

// Unary adapts a typed method implementation to a HandlerFunc. The payload is decoded into
// I (unknown fields are ignored, as @lowerdeck/validation strips them) and validated when *I
// implements Validator. A nil *O is sent as null.
func Unary[I, O any](fn func(ctx context.Context, in *I) (*O, error)) HandlerFunc {
	return func(ctx context.Context, payload json.RawMessage) (any, error) {
		in := new(I)

		if err := json.Unmarshal(payload, in); err != nil {
			return nil, decodeError(err)
		}

		if v, ok := any(in).(Validator); ok {
			if err := v.Validate(); err != nil {
				return nil, err
			}
		}

		out, err := fn(ctx, in)
		if err != nil {
			return nil, err
		}
		if out == nil {
			return nil, nil
		}
		return out, nil
	}
}

func decodeError(err error) error {
	var typeErr *json.UnmarshalTypeError
	if errors.As(err, &typeErr) {
		issue := ValidationIssue{
			Code:     "invalid_type",
			Message:  fmt.Sprintf("Invalid input, expected %s, received %s", typeErr.Type, typeErr.Value),
			Expected: typeErr.Type.String(),
			Received: typeErr.Value,
		}
		if typeErr.Field != "" {
			issue.Path = strings.Split(typeErr.Field, ".")
		}
		return ValidationErrors{issue}
	}

	var issues ValidationErrors
	if errors.As(err, &issues) {
		return issues
	}

	return ValidationErrors{{Code: "invalid_type", Message: err.Error()}}
}
