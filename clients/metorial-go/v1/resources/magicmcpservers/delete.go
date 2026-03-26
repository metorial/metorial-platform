package magicmcpservers

import (
	"encoding/json"
	"time"
)

// MagicMcpServersDeleteOutputEndpoints represents the magic mcp servers delete output endpoints type.
type MagicMcpServersDeleteOutputEndpoints struct {
	Id    string `json:"id"`
	Alias string `json:"alias"`
	Url   string `json:"url"`
}

// MagicMcpServersDeleteOutput represents the magic mcp servers delete output type.
type MagicMcpServersDeleteOutput struct {
	Object             string                                 `json:"object"`
	Id                 string                                 `json:"id"`
	Status             string                                 `json:"status"`
	SessionTemplateId  string                                 `json:"session_template_id"`
	ProviderTemplateId *string                                `json:"provider_template_id,omitempty"`
	Endpoints          []MagicMcpServersDeleteOutputEndpoints `json:"endpoints"`
	Name               *string                                `json:"name,omitempty"`
	Description        *string                                `json:"description,omitempty"`
	Metadata           map[string]any                         `json:"metadata"`
	CreatedAt          time.Time                              `json:"created_at"`
	UpdatedAt          time.Time                              `json:"updated_at"`
}

// MapMagicMcpServersDeleteOutputFromJSON deserializes JSON data into a MagicMcpServersDeleteOutput.
func MapMagicMcpServersDeleteOutputFromJSON(data []byte) (*MagicMcpServersDeleteOutput, error) {
	var v MagicMcpServersDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersDeleteOutputToJSON serializes a MagicMcpServersDeleteOutput to JSON.
func MapMagicMcpServersDeleteOutputToJSON(v *MagicMcpServersDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
