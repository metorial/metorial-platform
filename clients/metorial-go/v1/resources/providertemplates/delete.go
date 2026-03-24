package providertemplates

import (
	"encoding/json"
	"time"
)

// ProviderTemplatesDeleteOutput represents the provider templates delete output type.
type ProviderTemplatesDeleteOutput struct {
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

// MapProviderTemplatesDeleteOutputFromJSON deserializes JSON data into a ProviderTemplatesDeleteOutput.
func MapProviderTemplatesDeleteOutputFromJSON(data []byte) (*ProviderTemplatesDeleteOutput, error) {
	var v ProviderTemplatesDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderTemplatesDeleteOutputToJSON serializes a ProviderTemplatesDeleteOutput to JSON.
func MapProviderTemplatesDeleteOutputToJSON(v *ProviderTemplatesDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
