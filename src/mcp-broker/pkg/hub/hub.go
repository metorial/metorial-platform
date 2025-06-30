package hub

type Hub struct {
	clients    map[chan any]bool
	broadcast  chan any
	register   chan chan any
	unregister chan chan any
	bufferSize int
}

func NewHub(bufferSize int) *Hub {
	return &Hub{
		clients:    make(map[chan any]bool),
		broadcast:  make(chan any, bufferSize),
		register:   make(chan chan any),
		unregister: make(chan chan any),
		bufferSize: bufferSize,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client)
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client <- message:
				default:
					delete(h.clients, client)
					close(client)
				}
			}
		}
	}
}

func (h *Hub) Subscribe() chan any {
	client := make(chan any, h.bufferSize)
	h.register <- client
	return client
}

func (h *Hub) Send(msg any) {
	h.broadcast <- msg
}

func (h *Hub) Unsubscribe(client chan any) {
	h.unregister <- client
}

func (h *Hub) Close() {
	close(h.broadcast)
	close(h.register)
	close(h.unregister)

	for client := range h.clients {
		close(client)
		delete(h.clients, client)
	}
}
