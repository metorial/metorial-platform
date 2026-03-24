package notifications

import (
	"encoding/json"
	"time"
)

// CallbacksNotificationsGetOutputEvent represents the callbacks notifications get output event type.
type CallbacksNotificationsGetOutputEvent struct {
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

// CallbacksNotificationsGetOutputDestinationWebhook represents the callbacks notifications get output destination webhook type.
type CallbacksNotificationsGetOutputDestinationWebhook struct {
	Id        string    `json:"id"`
	Url       string    `json:"url"`
	Method    string    `json:"method"`
	CreatedAt time.Time `json:"created_at"`
}

// CallbacksNotificationsGetOutputDestination represents the callbacks notifications get output destination type.
type CallbacksNotificationsGetOutputDestination struct {
	Object      string                                             `json:"object"`
	Id          string                                             `json:"id"`
	Name        string                                             `json:"name"`
	Description *string                                            `json:"description,omitempty"`
	Type        string                                             `json:"type"`
	EventTypes  []string                                           `json:"event_types"`
	Retry       any                                                `json:"retry"`
	Webhook     *CallbacksNotificationsGetOutputDestinationWebhook `json:"webhook,omitempty"`
	CreatedAt   time.Time                                          `json:"created_at"`
	UpdatedAt   time.Time                                          `json:"updated_at"`
}

// CallbacksNotificationsGetOutput represents the callbacks notifications get output type.
type CallbacksNotificationsGetOutput struct {
	Object        string                                     `json:"object"`
	Id            string                                     `json:"id"`
	Status        string                                     `json:"status"`
	Error         *any                                       `json:"error,omitempty"`
	AttemptCount  float64                                    `json:"attempt_count"`
	Event         CallbacksNotificationsGetOutputEvent       `json:"event"`
	Destination   CallbacksNotificationsGetOutputDestination `json:"destination"`
	CreatedAt     time.Time                                  `json:"created_at"`
	UpdatedAt     time.Time                                  `json:"updated_at"`
	LastAttemptAt *time.Time                                 `json:"last_attempt_at,omitempty"`
	NextAttemptAt *time.Time                                 `json:"next_attempt_at,omitempty"`
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
