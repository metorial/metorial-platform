package pubsub

import (
	"sync"
)

type BroadcasterReader[T any] interface {
	Subscribe() chan T
	Unsubscribe(ch chan T)
}

type Broadcaster[T any] struct {
	mu          sync.RWMutex
	subscribers map[chan T]struct{}
}

func NewBroadcaster[T any]() *Broadcaster[T] {
	return &Broadcaster[T]{
		subscribers: make(map[chan T]struct{}),
	}
}

func (b *Broadcaster[T]) Subscribe() chan T {
	ch := make(chan T, 16) // buffered to avoid blocking
	b.mu.Lock()
	b.subscribers[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *Broadcaster[T]) Unsubscribe(ch chan T) {
	b.mu.Lock()
	defer b.mu.Unlock()

	_, exists := b.subscribers[ch]
	if !exists {
		return // channel not subscribed
	}

	delete(b.subscribers, ch)
	close(ch)
}

func (b *Broadcaster[T]) Publish(msg T) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.subscribers {
		select {
		case ch <- msg:
		default:
			// drop message if subscriber is slow
		}
	}
}

func (b *Broadcaster[T]) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	for ch := range b.subscribers {
		close(ch)
		delete(b.subscribers, ch)
	}
}
