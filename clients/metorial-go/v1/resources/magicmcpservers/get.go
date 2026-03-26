package magicmcpservers

import (
	"encoding/json"
	"time"
)

// MagicMcpServersGetOutputEndpoints represents the magic mcp servers get output endpoints type.
type MagicMcpServersGetOutputEndpoints struct {
	Id    string `json:"id"`
	Alias string `json:"alias"`
	Url   string `json:"url"`
}

// MagicMcpServersGetOutput represents the magic mcp servers get output type.
type MagicMcpServersGetOutput struct {
	Object             string                              `json:"object"`
	Id                 string                              `json:"id"`
	Status             string                              `json:"status"`
	SessionTemplateId  string                              `json:"session_template_id"`
	ProviderTemplateId *string                             `json:"provider_template_id,omitempty"`
	Endpoints          []MagicMcpServersGetOutputEndpoints `json:"endpoints"`
	Name               *string                             `json:"name,omitempty"`
	Description        *string                             `json:"description,omitempty"`
	Metadata           map[string]any                      `json:"metadata"`
	CreatedAt          time.Time                           `json:"created_at"`
	UpdatedAt          time.Time                           `json:"updated_at"`
}

// MapMagicMcpServersGetOutputFromJSON deserializes JSON data into a MagicMcpServersGetOutput.
func MapMagicMcpServersGetOutputFromJSON(data []byte) (*MagicMcpServersGetOutput, error) {
	var v MagicMcpServersGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersGetOutputToJSON serializes a MagicMcpServersGetOutput to JSON.
func MapMagicMcpServersGetOutputToJSON(v *MagicMcpServersGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
