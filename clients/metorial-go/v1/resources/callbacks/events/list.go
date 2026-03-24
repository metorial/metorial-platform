package events

import (
	"encoding/json"
	"time"
)

// CallbacksEventsListOutputItems represents the callbacks events list output items type.
type CallbacksEventsListOutputItems struct {
	Object                         string         `json:"object"`
	Id                             string         `json:"id"`
	Type                           string         `json:"type"`
	SourceId                       string         `json:"source_id"`
	TriggerKey                     string         `json:"trigger_key"`
	Input                          map[string]any `json:"input"`
	Output                         map[string]any `json:"output"`
	DeliveryStatus                 string         `json:"delivery_status"`
	CallbackId                     string         `json:"callback_id"`
	ProviderDeploymentConfigPairId *string        `json:"provider_deployment_config_pair_id,omitempty"`
	CallbackInstanceId             *string        `json:"callback_instance_id,omitempty"`
	CreatedAt                      time.Time      `json:"created_at"`
}

// CallbacksEventsListOutputPagination represents the callbacks events list output pagination type.
type CallbacksEventsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CallbacksEventsListOutput represents the callbacks events list output type.
type CallbacksEventsListOutput struct {
	Items      []CallbacksEventsListOutputItems    `json:"items"`
	Pagination CallbacksEventsListOutputPagination `json:"pagination"`
}

// MapCallbacksEventsListOutputFromJSON deserializes JSON data into a CallbacksEventsListOutput.
func MapCallbacksEventsListOutputFromJSON(data []byte) (*CallbacksEventsListOutput, error) {
	var v CallbacksEventsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksEventsListOutputToJSON serializes a CallbacksEventsListOutput to JSON.
func MapCallbacksEventsListOutputToJSON(v *CallbacksEventsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksEventsListQuery represents the callbacks events list query type.
type CallbacksEventsListQuery struct {
	Limit    *float64 `json:"limit,omitempty"`
	After    *string  `json:"after,omitempty"`
	Before   *string  `json:"before,omitempty"`
	Cursor   *string  `json:"cursor,omitempty"`
	Order    *string  `json:"order,omitempty"`
	Id       *any     `json:"id,omitempty"`
	Type     *any     `json:"type,omitempty"`
	SourceId *any     `json:"source_id,omitempty"`
}

// MapCallbacksEventsListQueryFromJSON deserializes JSON data into a CallbacksEventsListQuery.
func MapCallbacksEventsListQueryFromJSON(data []byte) (*CallbacksEventsListQuery, error) {
	var v CallbacksEventsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksEventsListQueryToJSON serializes a CallbacksEventsListQuery to JSON.
func MapCallbacksEventsListQueryToJSON(v *CallbacksEventsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
