package magicmcptokens

import (
	"encoding/json"
	"time"
)

// MagicMcpTokensCreateOutputGroups represents the magic mcp tokens create output groups type.
type MagicMcpTokensCreateOutputGroups struct {
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

// MagicMcpTokensCreateOutput represents the magic mcp tokens create output type.
type MagicMcpTokensCreateOutput struct {
	Object      string                             `json:"object"`
	Id          string                             `json:"id"`
	Status      string                             `json:"status"`
	Secret      string                             `json:"secret"`
	Name        *string                            `json:"name,omitempty"`
	Description *string                            `json:"description,omitempty"`
	Groups      []MagicMcpTokensCreateOutputGroups `json:"groups"`
	Metadata    map[string]any                     `json:"metadata"`
	CreatedAt   time.Time                          `json:"created_at"`
	UpdatedAt   time.Time                          `json:"updated_at"`
}

// MapMagicMcpTokensCreateOutputFromJSON deserializes JSON data into a MagicMcpTokensCreateOutput.
func MapMagicMcpTokensCreateOutputFromJSON(data []byte) (*MagicMcpTokensCreateOutput, error) {
	var v MagicMcpTokensCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensCreateOutputToJSON serializes a MagicMcpTokensCreateOutput to JSON.
func MapMagicMcpTokensCreateOutputToJSON(v *MagicMcpTokensCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpTokensCreateBody represents the magic mcp tokens create body type.
type MagicMcpTokensCreateBody struct {
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
	GroupIds    *[]string       `json:"group_ids,omitempty"`
}

// MapMagicMcpTokensCreateBodyFromJSON deserializes JSON data into a MagicMcpTokensCreateBody.
func MapMagicMcpTokensCreateBodyFromJSON(data []byte) (*MagicMcpTokensCreateBody, error) {
	var v MagicMcpTokensCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpTokensCreateBodyToJSON serializes a MagicMcpTokensCreateBody to JSON.
func MapMagicMcpTokensCreateBodyToJSON(v *MagicMcpTokensCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
