package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesDeleteOutputTriggers represents the callbacks instances delete output triggers type.
type CallbacksInstancesDeleteOutputTriggers struct {
	Object              string     `json:"object"`
	Id                  string     `json:"id"`
	Source              string     `json:"source"`
	PollIntervalSeconds *float64   `json:"poll_interval_seconds,omitempty"`
	NextPollAt          *time.Time `json:"next_poll_at,omitempty"`
	LastPolledAt        *time.Time `json:"last_polled_at,omitempty"`
	WebhookUrl          *string    `json:"webhook_url,omitempty"`
	IsWebhookRegistered bool       `json:"is_webhook_registered"`
	ProviderTrigger     *any       `json:"provider_trigger,omitempty"`
}

// CallbacksInstancesDeleteOutput represents the callbacks instances delete output type.
type CallbacksInstancesDeleteOutput struct {
	Object             string                                   `json:"object"`
	Id                 string                                   `json:"id"`
	Status             string                                   `json:"status"`
	RegistrationStatus string                                   `json:"registration_status"`
	Triggers           []CallbacksInstancesDeleteOutputTriggers `json:"triggers"`
	CreatedAt          time.Time                                `json:"created_at"`
	UpdatedAt          time.Time                                `json:"updated_at"`
}

// MapCallbacksInstancesDeleteOutputFromJSON deserializes JSON data into a CallbacksInstancesDeleteOutput.
func MapCallbacksInstancesDeleteOutputFromJSON(data []byte) (*CallbacksInstancesDeleteOutput, error) {
	var v CallbacksInstancesDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesDeleteOutputToJSON serializes a CallbacksInstancesDeleteOutput to JSON.
func MapCallbacksInstancesDeleteOutputToJSON(v *CallbacksInstancesDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
