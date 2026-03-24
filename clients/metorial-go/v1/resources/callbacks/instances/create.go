package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesCreateOutputTriggers represents the callbacks instances create output triggers type.
type CallbacksInstancesCreateOutputTriggers struct {
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

// CallbacksInstancesCreateOutput represents the callbacks instances create output type.
type CallbacksInstancesCreateOutput struct {
	Object             string                                   `json:"object"`
	Id                 string                                   `json:"id"`
	Status             string                                   `json:"status"`
	RegistrationStatus string                                   `json:"registration_status"`
	Triggers           []CallbacksInstancesCreateOutputTriggers `json:"triggers"`
	CreatedAt          time.Time                                `json:"created_at"`
	UpdatedAt          time.Time                                `json:"updated_at"`
}

// MapCallbacksInstancesCreateOutputFromJSON deserializes JSON data into a CallbacksInstancesCreateOutput.
func MapCallbacksInstancesCreateOutputFromJSON(data []byte) (*CallbacksInstancesCreateOutput, error) {
	var v CallbacksInstancesCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesCreateOutputToJSON serializes a CallbacksInstancesCreateOutput to JSON.
func MapCallbacksInstancesCreateOutputToJSON(v *CallbacksInstancesCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksInstancesCreateBody represents the callbacks instances create body type.
type CallbacksInstancesCreateBody struct {
	ProviderConfigId     string  `json:"provider_config_id"`
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
}

// MapCallbacksInstancesCreateBodyFromJSON deserializes JSON data into a CallbacksInstancesCreateBody.
func MapCallbacksInstancesCreateBodyFromJSON(data []byte) (*CallbacksInstancesCreateBody, error) {
	var v CallbacksInstancesCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesCreateBodyToJSON serializes a CallbacksInstancesCreateBody to JSON.
func MapCallbacksInstancesCreateBodyToJSON(v *CallbacksInstancesCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
