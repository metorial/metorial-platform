package events

import (
	"encoding/json"
	"time"
)

// CallbacksEventsGetOutput represents the callbacks events get output type.
type CallbacksEventsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback event identifier
	Id string `json:"id"`
	// Type - Provider event type received by the callback
	Type string `json:"type"`
	// SourceId - Provider-specific source identifier for the event
	SourceId string `json:"source_id"`
	// TriggerKey - Trigger key that produced this event
	TriggerKey string `json:"trigger_key"`
	// Input - Original trigger input payload captured for the event
	Input map[string]any `json:"input"`
	// Output - Trigger output payload resolved for the event
	Output map[string]any `json:"output"`
	// DeliveryStatus - Aggregate delivery status for this callback event
	DeliveryStatus string `json:"delivery_status"`
	// CallbackId - Parent callback identifier
	CallbackId string `json:"callback_id"`
	// CallbackInstanceId - Callback instance that received the event, when applicable
	CallbackInstanceId *string `json:"callback_instance_id,omitempty"`
	// CreatedAt - Timestamp when the callback event was created
	CreatedAt time.Time `json:"created_at"`
}

// MapCallbacksEventsGetOutputFromJSON deserializes JSON data into a CallbacksEventsGetOutput.
func MapCallbacksEventsGetOutputFromJSON(data []byte) (*CallbacksEventsGetOutput, error) {
	var v CallbacksEventsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksEventsGetOutputToJSON serializes a CallbacksEventsGetOutput to JSON.
func MapCallbacksEventsGetOutputToJSON(v *CallbacksEventsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
