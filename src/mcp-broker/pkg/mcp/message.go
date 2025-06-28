package mcp

import (
	"encoding/json"
	"errors"
	"fmt"
)

type MessageType string

const (
	RequestType      MessageType = "request"
	NotificationType MessageType = "notification"
	ResponseType     MessageType = "response"
	ErrorType        MessageType = "error"
	UnknownType      MessageType = "unknown"
)

type MCPMessage struct {
	Raw     json.RawMessage
	ID      *json.RawMessage
	Method  *string
	MsgType MessageType
}

func (m *MCPMessage) GetStringId() string {
	if m.ID == nil {
		return ""
	}
	return string(*m.ID)
}

func (m *MCPMessage) GetStringPayload() string {
	if m.Raw == nil {
		return ""
	}

	return string(m.Raw)
}

func ParseMCPMessage(stringData string) (*MCPMessage, error) {
	data := []byte(stringData)

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	// Check for JSON-RPC version
	versionRaw, ok := raw["jsonrpc"]
	if !ok || string(versionRaw) != `"2.0"` {
		return nil, errors.New("missing or invalid jsonrpc version")
	}

	msg := &MCPMessage{
		Raw: data,
	}

	// Optional fields
	if idRaw, ok := raw["id"]; ok {
		msg.ID = &idRaw
	}

	if methodRaw, ok := raw["method"]; ok {
		var method string
		if err := json.Unmarshal(methodRaw, &method); err == nil {
			msg.Method = &method
		}
	}

	// Classify message type
	switch {
	case msg.ID != nil && msg.Method != nil:
		msg.MsgType = RequestType
	case msg.ID == nil && msg.Method != nil:
		msg.MsgType = NotificationType
	case raw["result"] != nil:
		msg.MsgType = ResponseType
	case raw["error"] != nil:
		msg.MsgType = ErrorType
	default:
		msg.MsgType = UnknownType
	}

	return msg, nil
}
