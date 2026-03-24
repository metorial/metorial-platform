package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsUpdateOutput represents the callbacks destinations update output type.
type CallbacksDestinationsUpdateOutput struct {
	Object      string          `json:"object"`
	Id          string          `json:"id"`
	Status      string          `json:"status"`
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
	Url         string          `json:"url"`
	Method      string          `json:"method"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// MapCallbacksDestinationsUpdateOutputFromJSON deserializes JSON data into a CallbacksDestinationsUpdateOutput.
func MapCallbacksDestinationsUpdateOutputFromJSON(data []byte) (*CallbacksDestinationsUpdateOutput, error) {
	var v CallbacksDestinationsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsUpdateOutputToJSON serializes a CallbacksDestinationsUpdateOutput to JSON.
func MapCallbacksDestinationsUpdateOutputToJSON(v *CallbacksDestinationsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksDestinationsUpdateBody represents the callbacks destinations update body type.
type CallbacksDestinationsUpdateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
	Url         *string         `json:"url,omitempty"`
}

// MapCallbacksDestinationsUpdateBodyFromJSON deserializes JSON data into a CallbacksDestinationsUpdateBody.
func MapCallbacksDestinationsUpdateBodyFromJSON(data []byte) (*CallbacksDestinationsUpdateBody, error) {
	var v CallbacksDestinationsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsUpdateBodyToJSON serializes a CallbacksDestinationsUpdateBody to JSON.
func MapCallbacksDestinationsUpdateBodyToJSON(v *CallbacksDestinationsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
