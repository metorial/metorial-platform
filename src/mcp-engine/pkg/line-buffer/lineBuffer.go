package worker_mcp_runner

import (
	"sync"
	"time"
)

type LineHandler func(line []string)

type LineBuffer struct {
	Buffer      []string
	SendMaxWait time.Duration
	Handler     LineHandler
	mutex       sync.Mutex
}

func NewLineBuffer(sendMaxWait time.Duration, handler LineHandler) *LineBuffer {
	return &LineBuffer{
		Buffer:      make([]string, 0),
		SendMaxWait: sendMaxWait,
		Handler:     handler,
	}
}

func (lb *LineBuffer) AddLine(line string) {
	lb.mutex.Lock()
	defer lb.mutex.Unlock()

	lb.Buffer = append(lb.Buffer, line)

	if len(lb.Buffer) == 1 {
		go lb.sendLines()
	}
}

func (lb *LineBuffer) Flush() {
	lb.mutex.Lock()

	if len(lb.Buffer) == 0 {
		lb.mutex.Unlock()
		return
	}

	lines := lb.Buffer
	lb.Buffer = make([]string, 0)

	lb.mutex.Unlock()

	lb.Handler(lines)
}

func (lb *LineBuffer) sendLines() {
	time.Sleep(lb.SendMaxWait)

	lb.Flush()
}
