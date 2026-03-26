package magicmcpgroups

import (
	"encoding/json"
	"time"
)

// MagicMcpGroupsDeleteOutput represents the magic mcp groups delete output type.
type MagicMcpGroupsDeleteOutput struct {
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

// MapMagicMcpGroupsDeleteOutputFromJSON deserializes JSON data into a MagicMcpGroupsDeleteOutput.
func MapMagicMcpGroupsDeleteOutputFromJSON(data []byte) (*MagicMcpGroupsDeleteOutput, error) {
	var v MagicMcpGroupsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpGroupsDeleteOutputToJSON serializes a MagicMcpGroupsDeleteOutput to JSON.
func MapMagicMcpGroupsDeleteOutputToJSON(v *MagicMcpGroupsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
