package ldrpc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// Validator is implemented by input types that check themselves after decoding. A
// ValidationErrors result becomes a 400 invalid_data response with entity "call_data".
type Validator interface {
	Validate() error
}

// Void is the input of methods that take none and the output of methods that return
// nothing. As an input it accepts any payload; as an output a nil *Void is sent as null.
type Void struct{}

func (*Void) UnmarshalJSON([]byte) error { return nil }

type UnaryOption func(*unaryConfig)

type unaryConfig struct {
	schema *Schema
}

// WithInputSchema validates and normalizes the payload with a @lowerdeck/rpc-spec schema
// before it is decoded, producing the same issues as @lowerdeck/validation.
func WithInputSchema(schema *Schema) UnaryOption {
	return func(c *unaryConfig) { c.schema = schema }
}

// Unary adapts a typed method implementation to a HandlerFunc. The payload is checked
// against the input schema if one is given, decoded into I (unknown fields are ignored, as
// @lowerdeck/validation strips them) and validated when *I implements Validator. A nil *O
// is sent as null.
func Unary[I, O any](fn func(ctx context.Context, in *I) (*O, error), opts ...UnaryOption) HandlerFunc {
	var cfg unaryConfig
	for _, opt := range opts {
		opt(&cfg)
	}

	return func(ctx context.Context, payload json.RawMessage) (any, error) {
		in := new(I)

		if cfg.schema != nil {
			normalized, err := cfg.schema.Validate(payload)
			if err != nil {
				return nil, err
			}
			payload = normalized
		}

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
