package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsGetOutput represents the callbacks destinations get output type.
type CallbacksDestinationsGetOutput struct {
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

// MapCallbacksDestinationsGetOutputFromJSON deserializes JSON data into a CallbacksDestinationsGetOutput.
func MapCallbacksDestinationsGetOutputFromJSON(data []byte) (*CallbacksDestinationsGetOutput, error) {
	var v CallbacksDestinationsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDestinationsGetOutputToJSON serializes a CallbacksDestinationsGetOutput to JSON.
func MapCallbacksDestinationsGetOutputToJSON(v *CallbacksDestinationsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
