package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesListOutputItemsTriggers represents the callbacks instances list output items triggers type.
type CallbacksInstancesListOutputItemsTriggers struct {
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

// CallbacksInstancesListOutputItems represents the callbacks instances list output items type.
type CallbacksInstancesListOutputItems struct {
	Object             string                                      `json:"object"`
	Id                 string                                      `json:"id"`
	Status             string                                      `json:"status"`
	RegistrationStatus string                                      `json:"registration_status"`
	Triggers           []CallbacksInstancesListOutputItemsTriggers `json:"triggers"`
	CreatedAt          time.Time                                   `json:"created_at"`
	UpdatedAt          time.Time                                   `json:"updated_at"`
}

// CallbacksInstancesListOutputPagination represents the callbacks instances list output pagination type.
type CallbacksInstancesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CallbacksInstancesListOutput represents the callbacks instances list output type.
type CallbacksInstancesListOutput struct {
	Items      []CallbacksInstancesListOutputItems    `json:"items"`
	Pagination CallbacksInstancesListOutputPagination `json:"pagination"`
}

// MapCallbacksInstancesListOutputFromJSON deserializes JSON data into a CallbacksInstancesListOutput.
func MapCallbacksInstancesListOutputFromJSON(data []byte) (*CallbacksInstancesListOutput, error) {
	var v CallbacksInstancesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesListOutputToJSON serializes a CallbacksInstancesListOutput to JSON.
func MapCallbacksInstancesListOutputToJSON(v *CallbacksInstancesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksInstancesListQuery represents the callbacks instances list query type.
type CallbacksInstancesListQuery struct {
	Limit                *float64 `json:"limit,omitempty"`
	After                *string  `json:"after,omitempty"`
	Before               *string  `json:"before,omitempty"`
	Cursor               *string  `json:"cursor,omitempty"`
	Order                *string  `json:"order,omitempty"`
	Id                   *any     `json:"id,omitempty"`
	Status               *any     `json:"status,omitempty"`
	ProviderConfigId     *any     `json:"provider_config_id,omitempty"`
	ProviderAuthConfigId *any     `json:"provider_auth_config_id,omitempty"`
}

// MapCallbacksInstancesListQueryFromJSON deserializes JSON data into a CallbacksInstancesListQuery.
func MapCallbacksInstancesListQueryFromJSON(data []byte) (*CallbacksInstancesListQuery, error) {
	var v CallbacksInstancesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesListQueryToJSON serializes a CallbacksInstancesListQuery to JSON.
func MapCallbacksInstancesListQueryToJSON(v *CallbacksInstancesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
