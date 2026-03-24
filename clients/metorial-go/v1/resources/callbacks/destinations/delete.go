package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsDeleteOutput represents the callbacks destinations delete output type.
type CallbacksDestinationsDeleteOutput struct {
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

// MapCallbacksDestinationsDeleteOutputFromJSON deserializes JSON data into a CallbacksDestinationsDeleteOutput.
func MapCallbacksDestinationsDeleteOutputFromJSON(data []byte) (*CallbacksDestinationsDeleteOutput, error) {
	var v CallbacksDestinationsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsDeleteOutputToJSON serializes a CallbacksDestinationsDeleteOutput to JSON.
func MapCallbacksDestinationsDeleteOutputToJSON(v *CallbacksDestinationsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
