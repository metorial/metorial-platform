package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

type InternalMessage struct {
	MessageID          string    `json:"message_id"`
	ListenerIdentifier string    `json:"listener_identifier"`
	Payload            string    `json:"payload"`
	SourceInstanceID   string    `json:"source_instance_id"`
	Timestamp          time.Time `json:"timestamp"`
}

type InternalResponse struct {
	MessageID        string `json:"message_id"`
	Response         string `json:"response"`
	SourceInstanceID string `json:"source_instance_id"`
	Success          bool   `json:"success"`
	Error            string `json:"error,omitempty"`
}

func (s *ListenerConnectorService) setupRedisSubscriptions() {
	s.pubsub = s.redisClient.Subscribe(context.Background(),
		"listener_messages",  // Messages to be sent to listeners
		"listener_responses", // Responses from listeners
		"listener_registry",  // Listener connection/disconnection events
	)

	go s.handleRedisMessages()
}

func (s *ListenerConnectorService) handleRedisMessages() {
	ctx := context.Background()
	ch := s.pubsub.Channel()

	for msg := range ch {
		switch msg.Channel {
		case "listener_messages":
			s.handleInternalMessage(ctx, msg.Payload)
		case "listener_responses":
			s.handleInternalResponse(ctx, msg.Payload)
		case "listener_registry":
			s.handleListenerRegistryEvent(ctx, msg.Payload)
		}
	}
}

func (s *ListenerConnectorService) handleInternalMessage(ctx context.Context, payload string) {
	var internalMsg InternalMessage
	if err := json.Unmarshal([]byte(payload), &internalMsg); err != nil {
		log.Printf("Failed to unmarshal internal message: %v", err)
		return
	}

	if internalMsg.SourceInstanceID == s.config.InstanceID {
		return
	}

	// Check if we have the target listener
	s.listenersMu.RLock()
	listener, exists := s.listeners[internalMsg.ListenerIdentifier]
	s.listenersMu.RUnlock()

	if !exists {
		return // This instance doesn't have the target listener
	}

	wsMsg := WebSocketMessage{
		ID:      internalMsg.MessageID,
		Payload: internalMsg.Payload,
	}

	msgBytes, err := json.Marshal(wsMsg)
	if err != nil {
		log.Printf("Failed to marshal WebSocket message: %v", err)
		return
	}

	listener.mu.Lock()
	err = listener.Conn.WriteMessage(websocket.TextMessage, msgBytes)
	listener.mu.Unlock()

	if err != nil {
		// Listener disconnected, send error response
		s.sendErrorResponse(internalMsg.MessageID, fmt.Sprintf("failed to send to listener: %v", err))
		s.removeListener(internalMsg.ListenerIdentifier)
	}
}

func (s *ListenerConnectorService) handleListenerRegistryEvent(ctx context.Context, payload string) {
	var event map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &event); err != nil {
		log.Printf("Failed to unmarshal registry event: %v", err)
		return
	}

	// Unused for now
}

func (s *ListenerConnectorService) handleListenerMessages(listenerID string, conn *websocket.Conn) {
	defer s.removeListener(listenerID)

	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for listener %s: %v", listenerID, err)
			}
			break
		}

		var wsResponse WebSocketResponse
		err = json.Unmarshal(messageBytes, &wsResponse)
		if err != nil {
			log.Printf("Failed to unmarshal response from listener %s: %v", listenerID, err)
			continue
		}

		// Send response via Redis and to local pending messages
		response := InternalResponse{
			MessageID:        wsResponse.ID,
			Response:         wsResponse.Response,
			Success:          true,
			SourceInstanceID: s.config.InstanceID,
		}

		// Send to local pending messages
		s.pendingMu.RLock()
		if listener, exists := s.listeners[listenerID]; exists {
			select {
			case listener.ResponseCh <- response:
			default:
			}
		}
		s.pendingMu.RUnlock()

		// Send via Redis for cross-instance coordination
		responseBytes, err := json.Marshal(response)
		if err != nil {
			log.Printf("Failed to marshal response: %v", err)
			continue
		}

		ctx := context.Background()
		s.redisClient.Publish(ctx, "listener_responses", responseBytes)
	}
}

// findListenerInstance finds which instance has the specified listener
func (s *ListenerConnectorService) findListenerInstance(ctx context.Context, listenerID string) (string, error) {
	listenerKey := fmt.Sprintf("listeners:%s", listenerID)
	instanceID, err := s.redisClient.Get(ctx, listenerKey).Result()
	if err != nil || instanceID == "" {
		return "", err
	}

	instanceExists, err := s.redisClient.Exists(ctx, fmt.Sprintf("instances:%s", instanceID)).Result()
	if err != nil || instanceExists == 0 {
		return "", fmt.Errorf("instance %s not found", instanceID)
	}

	return instanceID, nil
}

func (s *ListenerConnectorService) registerListener(listenerID string) {
	ctx := context.Background()
	listenerKey := fmt.Sprintf("listeners:%s", listenerID)

	// Set listener -> instance mapping with expiration
	s.redisClient.Set(ctx, listenerKey, s.config.InstanceID, 5*time.Minute)

	// Publish listener connection event
	event := map[string]interface{}{
		"action":      "connect",
		"listener_id": listenerID,
		"instance_id": s.config.InstanceID,
		"timestamp":   time.Now(),
	}
	eventBytes, _ := json.Marshal(event)
	s.redisClient.Publish(ctx, "listener_registry", eventBytes)
}

func (s *ListenerConnectorService) unregisterListener(listenerID string) {
	ctx := context.Background()
	listenerKey := fmt.Sprintf("listeners:%s", listenerID)
	s.redisClient.Del(ctx, listenerKey)

	// Publish listener disconnection event
	event := map[string]interface{}{
		"action":      "disconnect",
		"listener_id": listenerID,
		"instance_id": s.config.InstanceID,
		"timestamp":   time.Now(),
	}
	eventBytes, _ := json.Marshal(event)
	s.redisClient.Publish(ctx, "listener_registry", eventBytes)
}

func (s *ListenerConnectorService) registerInstance() {
	ctx := context.Background()
	instanceKey := fmt.Sprintf("instances:%s", s.config.InstanceID)

	s.redisClient.Set(ctx, instanceKey, "active", 30*time.Second)

	go s.heartbeat()
}

func (s *ListenerConnectorService) heartbeat() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		instanceKey := fmt.Sprintf("instances:%s", s.config.InstanceID)
		s.redisClient.Set(ctx, instanceKey, "active", 30*time.Second)
	}
}
