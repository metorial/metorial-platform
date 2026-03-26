package notifications

import (
	"encoding/json"
	"time"
)

// CallbacksNotificationsListOutputItemsError - Last known delivery error payload, if any
type CallbacksNotificationsListOutputItemsError struct {
	// Code - Machine-readable error code
	Code string `json:"code"`
	// Message - Human-readable error message
	Message string `json:"message"`
}

// CallbacksNotificationsListOutputItemsEventRequestHeaders represents the callbacks notifications list output items event request headers type.
type CallbacksNotificationsListOutputItemsEventRequestHeaders struct {
	// Key - Header key
	Key string `json:"key"`
	// Value - Header value
	Value string `json:"value"`
}

// CallbacksNotificationsListOutputItemsEventRequest - Serialized request payload generated for the event
type CallbacksNotificationsListOutputItemsEventRequest struct {
	// Body - Serialized request body generated for the event
	Body string `json:"body"`
	// Headers - Serialized request headers generated for the event
	Headers *[]CallbacksNotificationsListOutputItemsEventRequestHeaders `json:"headers,omitempty"`
}

// CallbacksNotificationsListOutputItemsEvent represents the callbacks notifications list output items event type.
type CallbacksNotificationsListOutputItemsEvent struct {
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
	DestinationCount *float64 `json:"destination_count,omitempty"`
	// SuccessCount - Number of successful deliveries for the event
	SuccessCount float64 `json:"success_count"`
	// FailureCount - Number of failed deliveries for the event
	FailureCount float64 `json:"failure_count"`
	// Request - Serialized request payload generated for the event
	Request *CallbacksNotificationsListOutputItemsEventRequest `json:"request,omitempty"`
	// CreatedAt - Timestamp when the event was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the event was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksNotificationsListOutputItemsDestinationRetry - Retry configuration applied to this destination
type CallbacksNotificationsListOutputItemsDestinationRetry struct {
	// Type - Retry strategy type
	Type string `json:"type"`
	// MaxAttempts - Maximum number of delivery attempts
	MaxAttempts float64 `json:"maxAttempts"`
	// DelaySeconds - Delay between delivery attempts in seconds
	DelaySeconds float64 `json:"delaySeconds"`
}

// CallbacksNotificationsListOutputItemsDestinationWebhook - Webhook destination details
type CallbacksNotificationsListOutputItemsDestinationWebhook struct {
	// Id - Webhook identifier
	Id string `json:"id"`
	// Url - Webhook URL used for the notification
	Url string `json:"url"`
	// Method - HTTP method used for delivery
	Method string `json:"method"`
	// CreatedAt - Timestamp when the webhook destination was created
	CreatedAt time.Time `json:"created_at"`
}

// CallbacksNotificationsListOutputItemsDestination represents the callbacks notifications list output items destination type.
type CallbacksNotificationsListOutputItemsDestination struct {
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
	EventTypes *[]string `json:"event_types,omitempty"`
	// Retry - Retry configuration applied to this destination
	Retry CallbacksNotificationsListOutputItemsDestinationRetry `json:"retry"`
	// Webhook - Webhook destination details
	Webhook *CallbacksNotificationsListOutputItemsDestinationWebhook `json:"webhook,omitempty"`
	// CreatedAt - Timestamp when the destination was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the destination was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksNotificationsListOutputItems represents the callbacks notifications list output items type.
type CallbacksNotificationsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback notification identifier. This delivery intent ID should be used to fetch notification details.
	Id string `json:"id"`
	// Status - Current notification delivery status
	Status string `json:"status"`
	// Error - Last known delivery error payload, if any
	Error *CallbacksNotificationsListOutputItemsError `json:"error,omitempty"`
	// AttemptCount - Number of delivery attempts made for this notification
	AttemptCount float64                                          `json:"attempt_count"`
	Event        CallbacksNotificationsListOutputItemsEvent       `json:"event"`
	Destination  CallbacksNotificationsListOutputItemsDestination `json:"destination"`
	// CreatedAt - Timestamp when the notification was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the notification was last updated
	UpdatedAt time.Time `json:"updated_at"`
	// LastAttemptAt - Timestamp of the most recent delivery attempt
	LastAttemptAt *time.Time `json:"last_attempt_at,omitempty"`
	// NextAttemptAt - Timestamp of the next scheduled retry attempt, if any
	NextAttemptAt *time.Time `json:"next_attempt_at,omitempty"`
}

// CallbacksNotificationsListOutputPagination represents the callbacks notifications list output pagination type.
type CallbacksNotificationsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CallbacksNotificationsListOutput represents the callbacks notifications list output type.
type CallbacksNotificationsListOutput struct {
	Items      []CallbacksNotificationsListOutputItems    `json:"items"`
	Pagination CallbacksNotificationsListOutputPagination `json:"pagination"`
}

// MapCallbacksNotificationsListOutputFromJSON deserializes JSON data into a CallbacksNotificationsListOutput.
func MapCallbacksNotificationsListOutputFromJSON(data []byte) (*CallbacksNotificationsListOutput, error) {
	var v CallbacksNotificationsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksNotificationsListOutputToJSON serializes a CallbacksNotificationsListOutput to JSON.
func MapCallbacksNotificationsListOutputToJSON(v *CallbacksNotificationsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksNotificationsListQuery represents the callbacks notifications list query type.
type CallbacksNotificationsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// DestinationId - Filter by callback destination ID(s)
	DestinationId *any `json:"destination_id,omitempty"`
	// Status - Filter by callback notification delivery status
	Status *any `json:"status,omitempty"`
}

// MapCallbacksNotificationsListQueryFromJSON deserializes JSON data into a CallbacksNotificationsListQuery.
func MapCallbacksNotificationsListQueryFromJSON(data []byte) (*CallbacksNotificationsListQuery, error) {
	var v CallbacksNotificationsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksNotificationsListQueryToJSON serializes a CallbacksNotificationsListQuery to JSON.
func MapCallbacksNotificationsListQueryToJSON(v *CallbacksNotificationsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
