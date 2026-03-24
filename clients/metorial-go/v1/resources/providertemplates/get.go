package providertemplates

import (
	"encoding/json"
	"time"
)

// ProviderTemplatesGetOutput represents the provider templates get output type.
type ProviderTemplatesGetOutput struct {
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

// MapProviderTemplatesGetOutputFromJSON deserializes JSON data into a ProviderTemplatesGetOutput.
func MapProviderTemplatesGetOutputFromJSON(data []byte) (*ProviderTemplatesGetOutput, error) {
	var v ProviderTemplatesGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderTemplatesGetOutputToJSON serializes a ProviderTemplatesGetOutput to JSON.
func MapProviderTemplatesGetOutputToJSON(v *ProviderTemplatesGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
