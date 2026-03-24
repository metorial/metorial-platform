package magicmcptokens

import (
	"encoding/json"
	"time"
)

// MagicMcpTokensUpdateOutputGroups represents the magic mcp tokens update output groups type.
type MagicMcpTokensUpdateOutputGroups struct {
	Object      string         `json:"object"`
	Id          string         `json:"id"`
	Status      string         `json:"status"`
	Slug        string         `json:"slug"`
	Name        *string        `json:"name,omitempty"`
	Description *string        `json:"description,omitempty"`
	Metadata    map[string]any `json:"metadata"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// MagicMcpTokensUpdateOutput represents the magic mcp tokens update output type.
type MagicMcpTokensUpdateOutput struct {
	Object      string                             `json:"object"`
	Id          string                             `json:"id"`
	Status      string                             `json:"status"`
	Secret      string                             `json:"secret"`
	Name        *string                            `json:"name,omitempty"`
	Description *string                            `json:"description,omitempty"`
	Groups      []MagicMcpTokensUpdateOutputGroups `json:"groups"`
	Metadata    map[string]any                     `json:"metadata"`
	CreatedAt   time.Time                          `json:"created_at"`
	UpdatedAt   time.Time                          `json:"updated_at"`
}

// MapMagicMcpTokensUpdateOutputFromJSON deserializes JSON data into a MagicMcpTokensUpdateOutput.
func MapMagicMcpTokensUpdateOutputFromJSON(data []byte) (*MagicMcpTokensUpdateOutput, error) {
	var v MagicMcpTokensUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensUpdateOutputToJSON serializes a MagicMcpTokensUpdateOutput to JSON.
func MapMagicMcpTokensUpdateOutputToJSON(v *MagicMcpTokensUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpTokensUpdateBody represents the magic mcp tokens update body type.
type MagicMcpTokensUpdateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MapMagicMcpTokensUpdateBodyFromJSON deserializes JSON data into a MagicMcpTokensUpdateBody.
func MapMagicMcpTokensUpdateBodyFromJSON(data []byte) (*MagicMcpTokensUpdateBody, error) {
	var v MagicMcpTokensUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensUpdateBodyToJSON serializes a MagicMcpTokensUpdateBody to JSON.
func MapMagicMcpTokensUpdateBodyToJSON(v *MagicMcpTokensUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
