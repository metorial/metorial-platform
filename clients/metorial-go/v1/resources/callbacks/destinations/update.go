package destinations

import (
	"encoding/json"
	"time"
)

// CallbacksDestinationsUpdateOutput represents the callbacks destinations update output type.
type CallbacksDestinationsUpdateOutput struct {
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
	// Name - Updated callback destination name
	Name *string `json:"name,omitempty"`
	// Description - Updated destination description
	Description *string `json:"description,omitempty"`
	// Metadata - Updated destination metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Url - Updated webhook URL for callback deliveries
	Url *string `json:"url,omitempty"`
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
