package notifications

import (
	"encoding/json"
	"time"
)

// CallbacksNotificationsGetOutputEvent represents the callbacks notifications get output event type.
type CallbacksNotificationsGetOutputEvent struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Underlying event identifier for this notification
	Id string `json:"id"`
	// Type - Event type delivered to the destination
	Type string `json:"type"`
	// Topics - Topics associated with the event
	Topics []string `json:"topics"`
	// Status - Aggregate delivery status for the underlying event
	Status string `json:"status"`
	// DestinationCount - Total number of destinations targeted by the event
	DestinationCount float64 `json:"destination_count"`
	// SuccessCount - Number of successful deliveries for the event
	SuccessCount float64 `json:"success_count"`
	// FailureCount - Number of failed deliveries for the event
	FailureCount float64 `json:"failure_count"`
	// Request - Serialized request payload generated for the event
	Request any `json:"request"`
	// CreatedAt - Timestamp when the event was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the event was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksNotificationsGetOutputDestinationWebhook - Webhook destination details
type CallbacksNotificationsGetOutputDestinationWebhook struct {
	// Id - Webhook identifier
	Id string `json:"id"`
	// Url - Webhook URL used for the notification
	Url string `json:"url"`
	// Method - HTTP method used for delivery
	Method string `json:"method"`
	// CreatedAt - Timestamp when the webhook destination was created
	CreatedAt time.Time `json:"created_at"`
}

// CallbacksNotificationsGetOutputDestination represents the callbacks notifications get output destination type.
type CallbacksNotificationsGetOutputDestination struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Destination identifier used for this callback notification
	Id string `json:"id"`
	// Name - Destination display name
	Name string `json:"name"`
	// Description - Optional destination description
	Description *string `json:"description,omitempty"`
	// Type - Delivery destination type
	Type string `json:"type"`
	// EventTypes - Event types this destination accepted for the notification
	EventTypes []string `json:"event_types"`
	// Retry - Retry configuration applied to this destination
	Retry any `json:"retry"`
	// Webhook - Webhook destination details
	Webhook *CallbacksNotificationsGetOutputDestinationWebhook `json:"webhook,omitempty"`
	// CreatedAt - Timestamp when the destination was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the destination was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksNotificationsGetOutput represents the callbacks notifications get output type.
type CallbacksNotificationsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback notification identifier. This delivery intent ID should be used to fetch notification details.
	Id string `json:"id"`
	// Status - Current notification delivery status
	Status string `json:"status"`
	// Error - Last known delivery error payload, if any
	Error *any `json:"error,omitempty"`
	// AttemptCount - Number of delivery attempts made for this notification
	AttemptCount float64                                    `json:"attempt_count"`
	Event        CallbacksNotificationsGetOutputEvent       `json:"event"`
	Destination  CallbacksNotificationsGetOutputDestination `json:"destination"`
	// CreatedAt - Timestamp when the notification was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the notification was last updated
	UpdatedAt time.Time `json:"updated_at"`
	// LastAttemptAt - Timestamp of the most recent delivery attempt
	LastAttemptAt *time.Time `json:"last_attempt_at,omitempty"`
	// NextAttemptAt - Timestamp of the next scheduled retry attempt, if any
	NextAttemptAt *time.Time `json:"next_attempt_at,omitempty"`
}

// MapCallbacksNotificationsGetOutputFromJSON deserializes JSON data into a CallbacksNotificationsGetOutput.
func MapCallbacksNotificationsGetOutputFromJSON(data []byte) (*CallbacksNotificationsGetOutput, error) {
	var v CallbacksNotificationsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksNotificationsGetOutputToJSON serializes a CallbacksNotificationsGetOutput to JSON.
func MapCallbacksNotificationsGetOutputToJSON(v *CallbacksNotificationsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
