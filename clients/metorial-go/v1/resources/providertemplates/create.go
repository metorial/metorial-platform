package providertemplates

import (
	"encoding/json"
	"time"
)

// ProviderTemplatesCreateOutput represents the provider templates create output type.
type ProviderTemplatesCreateOutput struct {
	Object               string         `json:"object"`
	Id                   string         `json:"id"`
	Status               string         `json:"status"`
	Name                 string         `json:"name"`
	Description          *string        `json:"description,omitempty"`
	Metadata             map[string]any `json:"metadata"`
	ProviderDeploymentId string         `json:"provider_deployment_id"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
}

// MapProviderTemplatesCreateOutputFromJSON deserializes JSON data into a ProviderTemplatesCreateOutput.
func MapProviderTemplatesCreateOutputFromJSON(data []byte) (*ProviderTemplatesCreateOutput, error) {
	var v ProviderTemplatesCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderTemplatesCreateOutputToJSON serializes a ProviderTemplatesCreateOutput to JSON.
func MapProviderTemplatesCreateOutputToJSON(v *ProviderTemplatesCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderTemplatesCreateBodyProviderDeployment represents the provider templates create body provider deployment type.
type ProviderTemplatesCreateBodyProviderDeployment struct {
	ProviderId              string          `json:"provider_id"`
	Name                    *string         `json:"name,omitempty"`
	Description             *string         `json:"description,omitempty"`
	Metadata                *map[string]any `json:"metadata,omitempty"`
	LockedProviderVersionId *string         `json:"locked_provider_version_id,omitempty"`
}

// ProviderTemplatesCreateBody represents the provider templates create body type.
type ProviderTemplatesCreateBody struct {
	Name                 string                                         `json:"name"`
	Description          *string                                        `json:"description,omitempty"`
	Metadata             *map[string]any                                `json:"metadata,omitempty"`
	ProviderDeploymentId *string                                        `json:"provider_deployment_id,omitempty"`
	ProviderDeployment   *ProviderTemplatesCreateBodyProviderDeployment `json:"provider_deployment,omitempty"`
}

// MapProviderTemplatesCreateBodyFromJSON deserializes JSON data into a ProviderTemplatesCreateBody.
func MapProviderTemplatesCreateBodyFromJSON(data []byte) (*ProviderTemplatesCreateBody, error) {
	var v ProviderTemplatesCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderTemplatesCreateBodyToJSON serializes a ProviderTemplatesCreateBody to JSON.
func MapProviderTemplatesCreateBodyToJSON(v *ProviderTemplatesCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
