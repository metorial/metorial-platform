package mcp

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
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
	Method  *string
	MsgType MessageType

	rawId    *json.RawMessage
	stringId string

	raw []byte
	// payload map[string]any
}

func ParseMCPMessage(stringData string) (*MCPMessage, error) {
	return ParseMCPMessageFromBytes([]byte(stringData))
}

func ParseMCPMessageFromBytes(data []byte) (*MCPMessage, error) {
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
		raw: data,
	}

	// Optional fields
	if idRaw, ok := raw["id"]; ok {
		msg.rawId = &idRaw
		msg.stringId = string(idRaw)
	}

	if methodRaw, ok := raw["method"]; ok {
		var method string
		if err := json.Unmarshal(methodRaw, &method); err == nil {
			msg.Method = &method
		}
	}

	// if raw["params"] != nil {
	// 	var params map[string]any
	// 	if err := json.Unmarshal(raw["params"], &params); err != nil {
	// 		return nil, fmt.Errorf("invalid params: %w", err)
	// 	}
	// 	msg.payload = params
	// } else if raw["result"] != nil {
	// 	var result map[string]any
	// 	if err := json.Unmarshal(raw["result"], &result); err != nil {
	// 		return nil, fmt.Errorf("invalid result: %w", err)
	// 	}
	// 	msg.payload = result
	// } else if raw["error"] != nil {
	// 	var errorData map[string]any
	// 	if err := json.Unmarshal(raw["error"], &errorData); err != nil {
	// 		return nil, fmt.Errorf("invalid error: %w", err)
	// 	}
	// 	msg.payload = errorData
	// } else {
	// 	msg.payload = make(map[string]any)
	// }

	// Classify message type
	switch {
	case msg.rawId != nil && msg.Method != nil:
		msg.MsgType = RequestType
	case msg.rawId == nil && msg.Method != nil:
		msg.MsgType = NotificationType
	case msg.rawId != nil && raw["result"] != nil:
		msg.MsgType = ResponseType
	case msg.rawId != nil && raw["error"] != nil:
		msg.MsgType = ErrorType
	default:
		msg.MsgType = UnknownType
	}

	return msg, nil
}

func NewMCPRequestMessage(id string, method string, params map[string]any) (*MCPMessage, error) {
	rawMessage := map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
		"params":  params,
	}

	rawData, err := json.Marshal(rawMessage)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal MCP message: %w", err)
	}

	return &MCPMessage{
		stringId: id,
		Method:   &method,
		MsgType:  RequestType,
		raw:      rawData,
		// payload:  params,
	}, nil
}

func (m *MCPMessage) GetStringId() string {
	if m.stringId != "" {
		return m.stringId
	}

	if m.rawId != nil {
		str, err := strconv.Unquote(string(*m.rawId))
		if err != nil {
			return string(*m.rawId) // Return raw if unquoting fails
		}
		return str
	}

	return ""
}

func (m *MCPMessage) GetRawId() *json.RawMessage {
	if m.rawId != nil {
		return m.rawId
	}
	if m.stringId != "" {
		raw := json.RawMessage(fmt.Sprintf(`"%s"`, m.stringId))
		return &raw
	}
	return nil
}

func (m *MCPMessage) GetStringPayload() string {
	if m.raw == nil {
		return ""
	}
	return string(m.raw)
}

func (m *MCPMessage) GetRawPayload() []byte {
	if m.raw == nil {
		return nil
	}
	return m.raw
}

// func (m *MCPMessage) GetPayload() map[string]any {
// 	if m.payload == nil {
// 		return make(map[string]any)
// 	}
// 	return m.payload
// }
