package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsGetOutput represents the callbacks destinations get output type.
type CallbacksDestinationsGetOutput struct {
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
