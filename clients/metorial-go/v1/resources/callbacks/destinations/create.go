package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsCreateOutput represents the callbacks destinations create output type.
type CallbacksDestinationsCreateOutput struct {
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

// MapCallbacksDestinationsCreateOutputFromJSON deserializes JSON data into a CallbacksDestinationsCreateOutput.
func MapCallbacksDestinationsCreateOutputFromJSON(data []byte) (*CallbacksDestinationsCreateOutput, error) {
	var v CallbacksDestinationsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsCreateOutputToJSON serializes a CallbacksDestinationsCreateOutput to JSON.
func MapCallbacksDestinationsCreateOutputToJSON(v *CallbacksDestinationsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksDestinationsCreateBody represents the callbacks destinations create body type.
type CallbacksDestinationsCreateBody struct {
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
	Url         string          `json:"url"`
}

// MapCallbacksDestinationsCreateBodyFromJSON deserializes JSON data into a CallbacksDestinationsCreateBody.
func MapCallbacksDestinationsCreateBodyFromJSON(data []byte) (*CallbacksDestinationsCreateBody, error) {
	var v CallbacksDestinationsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsCreateBodyToJSON serializes a CallbacksDestinationsCreateBody to JSON.
func MapCallbacksDestinationsCreateBodyToJSON(v *CallbacksDestinationsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
