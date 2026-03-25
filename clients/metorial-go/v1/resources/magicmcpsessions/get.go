package magicmcpsessions

import (
	"encoding/json"
	"time"
)

// MagicMcpSessionsGetOutputMagicMcpServerEndpoints represents the magic mcp sessions get output magic mcp server endpoints type.
type MagicMcpSessionsGetOutputMagicMcpServerEndpoints struct {
	Id    string `json:"id"`
	Alias string `json:"alias"`
	Url   string `json:"url"`
}

// MagicMcpSessionsGetOutputMagicMcpServer represents the magic mcp sessions get output magic mcp server type.
type MagicMcpSessionsGetOutputMagicMcpServer struct {
	Object             string                                             `json:"object"`
	Id                 string                                             `json:"id"`
	Status             string                                             `json:"status"`
	SessionTemplateId  string                                             `json:"session_template_id"`
	ProviderTemplateId *string                                            `json:"provider_template_id,omitempty"`
	Endpoints          []MagicMcpSessionsGetOutputMagicMcpServerEndpoints `json:"endpoints"`
	Name               *string                                            `json:"name,omitempty"`
	Description        *string                                            `json:"description,omitempty"`
	Metadata           map[string]any                                     `json:"metadata"`
	CreatedAt          time.Time                                          `json:"created_at"`
	UpdatedAt          time.Time                                          `json:"updated_at"`
}

// MagicMcpSessionsGetOutput represents the magic mcp sessions get output type.
type MagicMcpSessionsGetOutput struct {
	Object                    string                                  `json:"object"`
	Id                        string                                  `json:"id"`
	SubspaceSessionId         string                                  `json:"subspace_session_id"`
	SubspaceSessionTemplateId string                                  `json:"subspace_session_template_id"`
	MagicMcpServer            MagicMcpSessionsGetOutputMagicMcpServer `json:"magic_mcp_server"`
	CreatedAt                 time.Time                               `json:"created_at"`
	UpdatedAt                 time.Time                               `json:"updated_at"`
}

// MapMagicMcpSessionsGetOutputFromJSON deserializes JSON data into a MagicMcpSessionsGetOutput.
func MapMagicMcpSessionsGetOutputFromJSON(data []byte) (*MagicMcpSessionsGetOutput, error) {
	var v MagicMcpSessionsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapMagicMcpSessionsGetOutputToJSON serializes a MagicMcpSessionsGetOutput to JSON.
func MapMagicMcpSessionsGetOutputToJSON(v *MagicMcpSessionsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
