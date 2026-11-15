package ldrpc

import (
	"encoding/json"
	"fmt"
)

// UnionValue is implemented by generated discriminated-union wrappers. Marshal encodes the
// variant as an object with the discriminator added, keeping Date annotations inside it
// (a MarshalJSON method alone would make the variant opaque to the annotator).
type UnionValue interface {
	UnionVariant() (discriminator, tag string, value any)
}

// MarshalUnion is the encoding/json form of a union: the variant's object plus the
// discriminator.
func MarshalUnion(u UnionValue) ([]byte, error) {
	discriminator, tag, value := u.UnionVariant()
	if value == nil {
		return []byte("null"), nil
	}

	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, fmt.Errorf("ldrpc: union variant must encode as an object: %w", err)
	}
	if fields == nil {
		fields = map[string]json.RawMessage{}
	}

	fields[discriminator], _ = json.Marshal(tag)
	return json.Marshal(fields)
}

// UnionTag reads the discriminator of an encoded union variant.
func UnionTag(data []byte, discriminator string) (string, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return "", err
	}

	var tag string
	if err := json.Unmarshal(fields[discriminator], &tag); err != nil || tag == "" {
		return "", fmt.Errorf("ldrpc: missing or invalid union discriminator %q", discriminator)
	}
	return tag, nil
}
