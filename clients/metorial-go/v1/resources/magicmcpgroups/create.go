package magicmcpgroups

import (
	"encoding/json"
	"time"
)

// MagicMcpGroupsCreateOutput represents the magic mcp groups create output type.
type MagicMcpGroupsCreateOutput struct {
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

// MapMagicMcpGroupsCreateOutputFromJSON deserializes JSON data into a MagicMcpGroupsCreateOutput.
func MapMagicMcpGroupsCreateOutputFromJSON(data []byte) (*MagicMcpGroupsCreateOutput, error) {
	var v MagicMcpGroupsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsCreateOutputToJSON serializes a MagicMcpGroupsCreateOutput to JSON.
func MapMagicMcpGroupsCreateOutputToJSON(v *MagicMcpGroupsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// MagicMcpGroupsCreateBody represents the magic mcp groups create body type.
type MagicMcpGroupsCreateBody struct {
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MapMagicMcpGroupsCreateBodyFromJSON deserializes JSON data into a MagicMcpGroupsCreateBody.
func MapMagicMcpGroupsCreateBodyFromJSON(data []byte) (*MagicMcpGroupsCreateBody, error) {
	var v MagicMcpGroupsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsCreateBodyToJSON serializes a MagicMcpGroupsCreateBody to JSON.
func MapMagicMcpGroupsCreateBodyToJSON(v *MagicMcpGroupsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
