package magicmcpgroups

import (
	"encoding/json"
	"time"
)

// MagicMcpGroupsUpdateOutput represents the magic mcp groups update output type.
type MagicMcpGroupsUpdateOutput struct {
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

// MapMagicMcpGroupsUpdateOutputFromJSON deserializes JSON data into a MagicMcpGroupsUpdateOutput.
func MapMagicMcpGroupsUpdateOutputFromJSON(data []byte) (*MagicMcpGroupsUpdateOutput, error) {
	var v MagicMcpGroupsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsUpdateOutputToJSON serializes a MagicMcpGroupsUpdateOutput to JSON.
func MapMagicMcpGroupsUpdateOutputToJSON(v *MagicMcpGroupsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpGroupsUpdateBody represents the magic mcp groups update body type.
type MagicMcpGroupsUpdateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MapMagicMcpGroupsUpdateBodyFromJSON deserializes JSON data into a MagicMcpGroupsUpdateBody.
func MapMagicMcpGroupsUpdateBodyFromJSON(data []byte) (*MagicMcpGroupsUpdateBody, error) {
	var v MagicMcpGroupsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsUpdateBodyToJSON serializes a MagicMcpGroupsUpdateBody to JSON.
func MapMagicMcpGroupsUpdateBodyToJSON(v *MagicMcpGroupsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
