package pubsub

import (
	"sync"
	"testing"
	"time"
)

func TestBroadcaster_SubscribeAndPublish(t *testing.T) {
	b := NewBroadcaster[string]()
	ch := b.Subscribe()
	defer b.Unsubscribe(ch)

	msg := "hello"
	b.Publish(msg)

	select {
	case got := <-ch:
		if got != msg {
			t.Errorf("expected %q, got %q", msg, got)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for message")
	}
}

func TestBroadcaster_MultipleSubscribers(t *testing.T) {
	b := NewBroadcaster[int]()
	ch1 := b.Subscribe()
	ch2 := b.Subscribe()
	defer b.Unsubscribe(ch1)
	defer b.Unsubscribe(ch2)

	b.Publish(42)

	for _, ch := range []chan int{ch1, ch2} {
		select {
		case got := <-ch:
			if got != 42 {
				t.Errorf("expected 42, got %d", got)
			}
		case <-time.After(time.Second):
			t.Fatal("timeout waiting for message")
		}
	}
}

func TestBroadcaster_Unsubscribe(t *testing.T) {
	b := NewBroadcaster[string]()
	ch := b.Subscribe()
	b.Unsubscribe(ch)

	// After unsubscribe, channel should be closed
	_, ok := <-ch
	if ok {
		t.Error("expected channel to be closed after unsubscribe")
	}

	// Publishing should not panic or send to unsubscribed channel
	b.Publish("test")
}

func TestBroadcaster_PublishDropsIfSlowSubscriber(t *testing.T) {
	b := NewBroadcaster[int]()
	ch := b.Subscribe()
	defer b.Unsubscribe(ch)

	// Fill the buffer
	for i := 0; i < 10; i++ {
		b.Publish(i)
	}

	// This message should be dropped (buffer full)
	b.Publish(999)

	received := make([]int, 0, 10)
	for i := 0; i < 10; i++ {
		received = append(received, <-ch)
	}

	for i, v := range received {
		if v != i {
			t.Errorf("expected %d, got %d", i, v)
		}
	}
	// There should be no 999 in the buffer
	select {
	case v := <-ch:
		t.Errorf("unexpected message %d in channel", v)
	default:
	}
}

func TestBroadcaster_Close(t *testing.T) {
	b := NewBroadcaster[string]()
	ch1 := b.Subscribe()
	ch2 := b.Subscribe()

	b.Close()

	// Both channels should be closed
	for _, ch := range []chan string{ch1, ch2} {
		_, ok := <-ch
		if ok {
			t.Error("expected channel to be closed after broadcaster.Close()")
		}
	}
}

func TestBroadcaster_ConcurrentSubscribePublish(t *testing.T) {
	b := NewBroadcaster[int]()
	var wg sync.WaitGroup

	// Start subscribers
	subs := make([]chan int, 5)
	for i := range subs {
		subs[i] = b.Subscribe()
		defer b.Unsubscribe(subs[i])
	}

	// Publish concurrently
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			b.Publish(i)
		}
	}()

	// Read from subscribers
	for _, ch := range subs {
		wg.Add(1)
		go func(ch chan int) {
			defer wg.Done()
			count := 0
			for range ch {
				count++
				if count >= 100 {
					return
				}
			}
		}(ch)
	}

	b.Close()
	wg.Wait()
}
