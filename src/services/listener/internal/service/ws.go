package service

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

type WebSocketMessage struct {
	ID      string `json:"id"`
	Payload string `json:"payload"`
}

type WebSocketResponse struct {
	ID       string `json:"id"`
	Response string `json:"response"`
}

func (s *ListenerConnectorService) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	tokenString := r.Header.Get("metorial-listener-token")
	if tokenString == "" {
		http.Error(w, "missing metorial-listener-token header", http.StatusUnauthorized)
		return
	}

	claims, err := s.validateJWT(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid token: %v", err), http.StatusUnauthorized)
		return
	}
	listenerID := claims.ListenerID

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	s.addListener(listenerID, conn)
	go s.handleListenerMessages(listenerID, conn)
}
