package gateway

import (
	"io"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

type clientSide struct {
	reader io.Reader
	writer io.Writer
	flush  func()
	close  func()
}

type relayLimits struct {
	idle     time.Duration
	deadline time.Time
}

type relayCounters struct {
	upstream   func(n int)
	downstream func(n int)
}

// relay copies bytes both ways until the destination stops sending, the connection is
// idle for longer than limits.idle, or limits.deadline passes. When the client finishes
// sending, the upstream write side is half-closed and the response is still relayed.
func relay(upstream net.Conn, client clientSide, limits relayLimits, counters relayCounters) {
	var lastActivity atomic.Int64
	touch := func() { lastActivity.Store(time.Now().UnixNano()) }
	touch()

	var closeOnce sync.Once
	closeAll := func() {
		closeOnce.Do(func() {
			_ = upstream.Close()
			if client.close != nil {
				client.close()
			}
		})
	}

	stop := make(chan struct{})
	defer close(stop)
	go watch(stop, &lastActivity, limits, closeAll)

	go func() {
		copyCounted(upstream, client.reader, nil, touch, counters.upstream)
		if halfCloser, ok := upstream.(interface{ CloseWrite() error }); ok {
			_ = halfCloser.CloseWrite()
		}
	}()

	copyCounted(client.writer, upstream, client.flush, touch, counters.downstream)
	closeAll()
}

func watch(stop <-chan struct{}, lastActivity *atomic.Int64, limits relayLimits, closeAll func()) {
	interval := time.Second
	if limits.idle > 0 && limits.idle/4 < interval {
		interval = max(limits.idle/4, 10*time.Millisecond)
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case now := <-ticker.C:
			idleFor := now.Sub(time.Unix(0, lastActivity.Load()))
			if (limits.idle > 0 && idleFor > limits.idle) || (!limits.deadline.IsZero() && now.After(limits.deadline)) {
				closeAll()
				return
			}
		}
	}
}

func copyCounted(dst io.Writer, src io.Reader, flush func(), touch func(), count func(int)) {
	buf := make([]byte, 32*1024)
	for {
		n, readErr := src.Read(buf)
		if n > 0 {
			if _, err := dst.Write(buf[:n]); err != nil {
				return
			}
			if flush != nil {
				flush()
			}
			touch()
			if count != nil {
				count(n)
			}
		}
		if readErr != nil {
			return
		}
	}
}
