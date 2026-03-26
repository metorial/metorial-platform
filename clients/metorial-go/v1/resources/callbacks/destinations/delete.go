package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsDeleteOutput represents the callbacks destinations delete output type.
type CallbacksDestinationsDeleteOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback destination identifier
	Id string `json:"id"`
	// Status - Callback destination lifecycle status
	Status string `json:"status"`
	// Name - Display name for the callback destination
	Name string `json:"name"`
	// Description - Optional destination description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional destination metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Url - Webhook URL that receives callback deliveries
	Url string `json:"url"`
	// Method - HTTP method used for webhook delivery
	Method string `json:"method"`
	// CreatedAt - Timestamp when the callback destination was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback destination was last updated
	UpdatedAt time.Time `json:"updated_at"`
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
