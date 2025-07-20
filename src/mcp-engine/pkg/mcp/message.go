package mcp

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"sync"

	"github.com/google/uuid"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/modules/util"
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

	internalUuid string // Internal UUID for tracking

	mutex sync.Mutex

	// payload map[string]any
}

func ParseMCPMessage(uuid string, stringData string) (*MCPMessage, error) {
	return ParseMCPMessageFromBytes(uuid, []byte(stringData))
}

func ParseMCPMessageFromBytes(uuid string, data []byte) (*MCPMessage, error) {
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
		raw:          data,
		internalUuid: uuid,
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

func FromPbRawMessage(pbMessage *mcpPb.McpMessageRaw) (*MCPMessage, error) {
	if pbMessage == nil {
		return nil, fmt.Errorf("nil MCP message")
	}

	if pbMessage.Message == "" {
		return nil, fmt.Errorf("empty MCP message")
	}

	msg, err := ParseMCPMessage(pbMessage.Uuid, pbMessage.Message)
	if err != nil {
		return nil, fmt.Errorf("failed to parse MCP message: %w", err)
	}

	return msg, nil
}

func FromPbMessage(pbMessage *mcpPb.McpMessage) (*MCPMessage, error) {
	if pbMessage == nil {
		return nil, fmt.Errorf("nil MCP message")
	}

	return FromPbRawMessage(pbMessage.McpMessage)
}

func (m *MCPMessage) ToPbRawMessage() *mcpPb.McpMessageRaw {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.internalUuid == "" {
		m.internalUuid = util.Must(uuid.NewV7()).String()
	}

	return &mcpPb.McpMessageRaw{
		Message: string(m.raw),
		Uuid:    m.internalUuid,
	}
}

func (m *MCPMessage) ToPbMessage() *mcpPb.McpMessage {
	rawMessage := m.ToPbRawMessage()

	msg := &mcpPb.McpMessage{
		McpMessage:  rawMessage,
		MessageType: messageTypeToPbMessageType(m.MsgType),
	}

	if m.stringId != "" {
		msg.IdString = m.GetStringId()
	}

	if m.rawId != nil {
		msg.IdJson = string(*m.rawId)
	}

	if m.Method != nil && *m.Method != "" {
		msg.Method = *m.Method
	}

	return msg
}

func (m *MCPMessage) GetPbMessageType() mcpPb.McpMessageType {
	return messageTypeToPbMessageType(m.MsgType)
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

func NewMCPResponseMessage(inResponseTo *MCPMessage, result map[string]any) (*MCPMessage, error) {
	rawMessage := map[string]any{
		"jsonrpc": "2.0",
		"id":      inResponseTo.rawId,
		"result":  result,
	}

	rawData, err := json.Marshal(rawMessage)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal MCP message: %w", err)
	}

	return &MCPMessage{
		rawId:    inResponseTo.rawId,
		stringId: inResponseTo.stringId,
		MsgType:  ResponseType,
		raw:      rawData,
		// payload:  params,
	}, nil
}

func (m *MCPMessage) GetStringId() string {
	if m.rawId != nil {
		str, err := strconv.Unquote(string(*m.rawId))
		if err != nil {
			return string(*m.rawId) // Return raw if unquoting fails
		}
		return str
	}

	if m.stringId != "" {
		str, err := strconv.Unquote(m.stringId)
		if err == nil {
			return str
		}

		return m.stringId // Return raw if unquoting fails
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

func (m *MCPMessage) GetJsonId() string {
	if m.rawId != nil {
		return string(*m.rawId)
	}

	if m.stringId != "" {
		return fmt.Sprintf(`"%s"`, m.stringId)
	}

	return ""
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

func (m *MCPMessage) GetMethod() string {
	if m.Method != nil {
		return *m.Method
	}
	return ""
}

func (m *MCPMessage) GetUuid() string {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.internalUuid == "" {
		m.internalUuid = util.Must(uuid.NewV7()).String()
	}

	return m.internalUuid
}

func messageTypeToPbMessageType(inType MessageType) mcpPb.McpMessageType {
	var messageType mcpPb.McpMessageType
	switch inType {
	case RequestType:
		messageType = mcpPb.McpMessageType_request
	case NotificationType:
		messageType = mcpPb.McpMessageType_notification
	case ResponseType:
		messageType = mcpPb.McpMessageType_response
	case ErrorType:
		messageType = mcpPb.McpMessageType_error
	default:
		messageType = mcpPb.McpMessageType_unknown
	}

	return messageType
}

// func pbMessageTypeToMessageType(inType mcpPb.McpMessageType) MessageType {
// 	switch inType {
// 	case mcpPb.McpMessageType_request:
// 		return RequestType
// 	case mcpPb.McpMessageType_notification:
// 		return NotificationType
// 	case mcpPb.McpMessageType_response:
// 		return ResponseType
// 	case mcpPb.McpMessageType_error:
// 		return ErrorType
// 	default:
// 		return UnknownType
// 	}
// }

// func (m *MCPMessage) GetPayload() map[string]any {
// 	if m.payload == nil {
// 		return make(map[string]any)
// 	}
// 	return m.payload
// }
