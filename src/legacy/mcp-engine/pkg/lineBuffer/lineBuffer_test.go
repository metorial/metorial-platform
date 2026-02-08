package worker_mcp_runner

import (
	"strings"
	"sync"
	"testing"
	"time"
)

func TestLineBuffer_AddLine_And_Flush(t *testing.T) {
	var (
		mu      sync.Mutex
		handled [][]string
	)
	handler := func(lines []string) {
		mu.Lock()
		defer mu.Unlock()
		handled = append(handled, lines)
	}

	lb := NewLineBuffer(50*time.Millisecond, handler)

	// Add a line and flush manually
	lb.AddLine("foo")
	time.Sleep(10 * time.Millisecond) // ensure goroutine starts
	lb.Flush()

	mu.Lock()
	if len(handled) == 0 {
		t.Fatal("expected handler to be called")
	}
	if len(handled[0]) != 1 || handled[0][0] != "foo" {
		t.Errorf("unexpected handler lines: %v", handled[0])
	}
	mu.Unlock()
}

func TestLineBuffer_SendLines_AutoFlush(t *testing.T) {
	var (
		mu      sync.Mutex
		handled [][]string
	)
	handler := func(lines []string) {
		mu.Lock()
		defer mu.Unlock()
		handled = append(handled, lines)
	}

	lb := NewLineBuffer(30*time.Millisecond, handler)

	lb.AddLine("a")
	lb.AddLine("b")
	time.Sleep(50 * time.Millisecond) // Wait for auto flush

	mu.Lock()
	defer mu.Unlock()
	if len(handled) != 1 {
		t.Fatalf("expected 1 handler call, got %d", len(handled))
	}
	if len(handled[0]) != 2 || handled[0][0] != "a" || handled[0][1] != "b" {
		t.Errorf("unexpected handler lines: %v", handled[0])
	}
}

func TestLineBuffer_Flush_EmptyBuffer(t *testing.T) {
	handlerCalled := false
	handler := func(lines []string) {
		handlerCalled = true
	}

	lb := NewLineBuffer(10*time.Millisecond, handler)
	lb.Flush()
	if handlerCalled {
		t.Error("handler should not be called on empty buffer")
	}
}

func TestLineBuffer_ConcurrentAddLine(t *testing.T) {
	var (
		mu      sync.Mutex
		handled [][]string
	)
	handler := func(lines []string) {
		mu.Lock()
		defer mu.Unlock()
		handled = append(handled, lines)
	}

	lb := NewLineBuffer(20*time.Millisecond, handler)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			lb.AddLine(strings.Repeat("line", i))
		}(i)
	}
	wg.Wait()
	time.Sleep(30 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()
	total := 0
	for _, batch := range handled {
		total += len(batch)
	}
	if total != 10 {
		t.Errorf("expected 10 lines handled, got %d", total)
	}
}
