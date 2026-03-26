package magicmcpservers

import (
	"encoding/json"
	"time"
)

// MagicMcpServersUpdateOutputEndpoints represents the magic mcp servers update output endpoints type.
type MagicMcpServersUpdateOutputEndpoints struct {
	Id    string `json:"id"`
	Alias string `json:"alias"`
	Url   string `json:"url"`
}

// MagicMcpServersUpdateOutput represents the magic mcp servers update output type.
type MagicMcpServersUpdateOutput struct {
	Object             string                                 `json:"object"`
	Id                 string                                 `json:"id"`
	Status             string                                 `json:"status"`
	SessionTemplateId  string                                 `json:"session_template_id"`
	ProviderTemplateId *string                                `json:"provider_template_id,omitempty"`
	Endpoints          []MagicMcpServersUpdateOutputEndpoints `json:"endpoints"`
	Name               *string                                `json:"name,omitempty"`
	Description        *string                                `json:"description,omitempty"`
	Metadata           map[string]any                         `json:"metadata"`
	CreatedAt          time.Time                              `json:"created_at"`
	UpdatedAt          time.Time                              `json:"updated_at"`
}

// MapMagicMcpServersUpdateOutputFromJSON deserializes JSON data into a MagicMcpServersUpdateOutput.
func MapMagicMcpServersUpdateOutputFromJSON(data []byte) (*MagicMcpServersUpdateOutput, error) {
	var v MagicMcpServersUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersUpdateOutputToJSON serializes a MagicMcpServersUpdateOutput to JSON.
func MapMagicMcpServersUpdateOutputToJSON(v *MagicMcpServersUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpServersUpdateBody represents the magic mcp servers update body type.
type MagicMcpServersUpdateBody struct {
	Name              *string         `json:"name,omitempty"`
	Description       *string         `json:"description,omitempty"`
	Metadata          *map[string]any `json:"metadata,omitempty"`
	Aliases           *[]string       `json:"aliases,omitempty"`
	SessionTemplateId *string         `json:"session_template_id,omitempty"`
}

// MapMagicMcpServersUpdateBodyFromJSON deserializes JSON data into a MagicMcpServersUpdateBody.
func MapMagicMcpServersUpdateBodyFromJSON(data []byte) (*MagicMcpServersUpdateBody, error) {
	var v MagicMcpServersUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersUpdateBodyToJSON serializes a MagicMcpServersUpdateBody to JSON.
func MapMagicMcpServersUpdateBodyToJSON(v *MagicMcpServersUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
