package events

import (
	"encoding/json"
	"time"
)

// CallbacksEventsGetOutput represents the callbacks events get output type.
type CallbacksEventsGetOutput struct {
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
