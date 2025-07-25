package entries

import (
	"encoding/json"
	"fmt"
)

type apiRequestEntryType struct {
	EntryType
}

type apiRequestEntryTypeInstance struct {
	payload *HTTPLogPayload
}

var ApiRequestEntryType = &apiRequestEntryType{}

type HTTPLogPayload struct {
	Request  HTTPRequest  `json:"request"`
	Response HTTPResponse `json:"response"`
	Duration int64        `json:"duration_ms"`
}

type HTTPRequest struct {
	Method     string `json:"method"`
	Path       string `json:"path"`
	ApiVersion string `json:"api_version"`

	QueryString string            `json:"query,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        string            `json:"body,omitempty"`

	Client          map[string]string `json:"client,omitempty"`
	ClientIP        string            `json:"client_ip,omitempty"`
	ApiKeyId        string            `json:"api_key_id,omitempty"`
	DashboardUserId string            `json:"dashboard_user_id,omitempty"`

	Origin    string `json:"origin,omitempty"`
	UserAgent string `json:"user_agent,omitempty"`
}

type HTTPResponse struct {
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`

	ErrorCode   string `json:"error_code,omitempty"`
	ErrorReason string `json:"error_reason,omitempty"`
	ErrorHash   string `json:"error_hash,omitempty"`
}

func (h *apiRequestEntryType) GetTypeName() string {
	return "api_request"
}

func (h *apiRequestEntryType) ParsePayload(payloadJSON string) (EntryTypeInstance, error) {
	var payload HTTPLogPayload
	if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
		return nil, fmt.Errorf("failed to parse HTTP log payload: %w", err)
	}

	if payload.Request.Method == "" ||
		payload.Request.Path == "" ||
		payload.Response.Status == 0 ||
		payload.Request.ApiVersion == "" {
		return nil, fmt.Errorf("invalid HTTP log payload: missing required fields")
	}

	return &apiRequestEntryTypeInstance{
		payload: &payload,
	}, nil
}

func (h *apiRequestEntryTypeInstance) ExtractLightRecord() (map[string]any, error) {
	payload := h.payload

	lightRecord := map[string]any{
		"request_method":  payload.Request.Method,
		"request_path":    payload.Request.Path,
		"api_version":     payload.Request.ApiVersion,
		"response_status": payload.Response.Status,
		"duration_ms":     payload.Duration,
	}

	if payload.Request.ApiKeyId != "" {
		lightRecord["api_key_id"] = payload.Request.ApiKeyId
	}

	if payload.Request.DashboardUserId != "" {
		lightRecord["dashboard_user_id"] = payload.Request.DashboardUserId
	}

	if payload.Request.ClientIP != "" {
		lightRecord["client_ip"] = payload.Request.ClientIP
	}

	if payload.Request.UserAgent != "" {
		lightRecord["user_agent"] = payload.Request.UserAgent
	}

	if payload.Request.Origin != "" {
		lightRecord["origin"] = payload.Request.Origin
	}

	if payload.Response.ErrorCode != "" {
		lightRecord["error_code"] = payload.Response.ErrorCode
	}

	if payload.Response.ErrorReason != "" {
		lightRecord["error_reason"] = payload.Response.ErrorReason
	}

	if payload.Response.ErrorHash != "" {
		lightRecord["error_hash"] = payload.Response.ErrorHash
	}

	return lightRecord, nil
}

func (h *apiRequestEntryType) GetFilterFields() []FilterField {
	return []FilterField{
		{Name: "request_method"},
		{Name: "request_path"},
		{Name: "api_version"},
		{Name: "response_status"},
		{Name: "api_key_id"},
		{Name: "client_ip"},
		{Name: "error_hash"},
	}
}
