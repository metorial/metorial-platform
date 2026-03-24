package notifications

import (
	"encoding/json"
	"time"
)

// CallbacksNotificationsListOutputItemsEvent represents the callbacks notifications list output items event type.
type CallbacksNotificationsListOutputItemsEvent struct {
	Object           string    `json:"object"`
	Id               string    `json:"id"`
	Type             string    `json:"type"`
	Topics           []string  `json:"topics"`
	Status           string    `json:"status"`
	DestinationCount float64   `json:"destination_count"`
	SuccessCount     float64   `json:"success_count"`
	FailureCount     float64   `json:"failure_count"`
	Request          any       `json:"request"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// CallbacksNotificationsListOutputItemsDestinationWebhook represents the callbacks notifications list output items destination webhook type.
type CallbacksNotificationsListOutputItemsDestinationWebhook struct {
	Id        string    `json:"id"`
	Url       string    `json:"url"`
	Method    string    `json:"method"`
	CreatedAt time.Time `json:"created_at"`
}

// CallbacksNotificationsListOutputItemsDestination represents the callbacks notifications list output items destination type.
type CallbacksNotificationsListOutputItemsDestination struct {
	Object      string                                                   `json:"object"`
	Id          string                                                   `json:"id"`
	Name        string                                                   `json:"name"`
	Description *string                                                  `json:"description,omitempty"`
	Type        string                                                   `json:"type"`
	EventTypes  []string                                                 `json:"event_types"`
	Retry       any                                                      `json:"retry"`
	Webhook     *CallbacksNotificationsListOutputItemsDestinationWebhook `json:"webhook,omitempty"`
	CreatedAt   time.Time                                                `json:"created_at"`
	UpdatedAt   time.Time                                                `json:"updated_at"`
}

// CallbacksNotificationsListOutputItems represents the callbacks notifications list output items type.
type CallbacksNotificationsListOutputItems struct {
	Object        string                                           `json:"object"`
	Id            string                                           `json:"id"`
	Status        string                                           `json:"status"`
	Error         *any                                             `json:"error,omitempty"`
	AttemptCount  float64                                          `json:"attempt_count"`
	Event         CallbacksNotificationsListOutputItemsEvent       `json:"event"`
	Destination   CallbacksNotificationsListOutputItemsDestination `json:"destination"`
	CreatedAt     time.Time                                        `json:"created_at"`
	UpdatedAt     time.Time                                        `json:"updated_at"`
	LastAttemptAt *time.Time                                       `json:"last_attempt_at,omitempty"`
	NextAttemptAt *time.Time                                       `json:"next_attempt_at,omitempty"`
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
	Limit         *float64 `json:"limit,omitempty"`
	After         *string  `json:"after,omitempty"`
	Before        *string  `json:"before,omitempty"`
	Cursor        *string  `json:"cursor,omitempty"`
	Order         *string  `json:"order,omitempty"`
	DestinationId *any     `json:"destination_id,omitempty"`
	Status        *any     `json:"status,omitempty"`
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
