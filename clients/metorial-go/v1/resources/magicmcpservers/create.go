package magicmcpservers

import (
	"encoding/json"
	"time"
)

// MagicMcpServersCreateOutputEndpoints represents the magic mcp servers create output endpoints type.
type MagicMcpServersCreateOutputEndpoints struct {
	Id    string `json:"id"`
	Alias string `json:"alias"`
	Url   string `json:"url"`
}

// MagicMcpServersCreateOutput represents the magic mcp servers create output type.
type MagicMcpServersCreateOutput struct {
	Object             string                                 `json:"object"`
	Id                 string                                 `json:"id"`
	Status             string                                 `json:"status"`
	SessionTemplateId  string                                 `json:"session_template_id"`
	ProviderTemplateId *string                                `json:"provider_template_id,omitempty"`
	Endpoints          []MagicMcpServersCreateOutputEndpoints `json:"endpoints"`
	Name               *string                                `json:"name,omitempty"`
	Description        *string                                `json:"description,omitempty"`
	Metadata           map[string]any                         `json:"metadata"`
	CreatedAt          time.Time                              `json:"created_at"`
	UpdatedAt          time.Time                              `json:"updated_at"`
}

// MapMagicMcpServersCreateOutputFromJSON deserializes JSON data into a MagicMcpServersCreateOutput.
func MapMagicMcpServersCreateOutputFromJSON(data []byte) (*MagicMcpServersCreateOutput, error) {
	var v MagicMcpServersCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersCreateOutputToJSON serializes a MagicMcpServersCreateOutput to JSON.
func MapMagicMcpServersCreateOutputToJSON(v *MagicMcpServersCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpServersCreateBody represents the magic mcp servers create body type.
type MagicMcpServersCreateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MapMagicMcpServersCreateBodyFromJSON deserializes JSON data into a MagicMcpServersCreateBody.
func MapMagicMcpServersCreateBodyFromJSON(data []byte) (*MagicMcpServersCreateBody, error) {
	var v MagicMcpServersCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpServersCreateBodyToJSON serializes a MagicMcpServersCreateBody to JSON.
func MapMagicMcpServersCreateBodyToJSON(v *MagicMcpServersCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
