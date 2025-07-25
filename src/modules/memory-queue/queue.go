package memoryQueue

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type JobFunc func() error

type jobRecord struct {
	job      JobFunc
	attempts int
	maxTries int
}

type JobQueue struct {
	queue     chan jobRecord
	wg        sync.WaitGroup
	ctx       context.Context
	cancel    context.CancelFunc
	semaphore chan struct{}
	backoff   func(retry int) time.Duration
}

func NewJobQueue(concurrency int) *JobQueue {
	ctx, cancel := context.WithCancel(context.Background())

	q := &JobQueue{
		queue:     make(chan jobRecord, 1024),
		ctx:       ctx,
		cancel:    cancel,
		semaphore: make(chan struct{}, concurrency),
		backoff:   defaultBackoff,
	}

	go q.dispatcher()

	return q
}

func (q *JobQueue) Add(job JobFunc, maxTries int) {
	if maxTries < 1 {
		maxTries = 1
	}
	select {
	case q.queue <- jobRecord{job: job, attempts: 0, maxTries: maxTries}:
	case <-q.ctx.Done():
	}
}

func (q *JobQueue) dispatcher() {
	for {
		select {
		case <-q.ctx.Done():
			return
		case job := <-q.queue:
			q.semaphore <- struct{}{}
			q.wg.Add(1)
			go q.runJob(job)
		}
	}
}

func (q *JobQueue) runJob(j jobRecord) {
	defer func() {
		<-q.semaphore
		q.wg.Done()
	}()

	for {
		err := runJobWithRecovery(j.job)
		j.attempts++

		if err == nil {
			return
		}

		if j.attempts >= j.maxTries {
			fmt.Printf("Job failed after %d attempts: %v\n", j.attempts, err)
			return
		}

		backoff := q.backoff(j.attempts)

		select {
		case <-time.After(backoff):
		case <-q.ctx.Done():
			return
		}
	}
}

func (q *JobQueue) Wait() {
	q.wg.Wait()
}

func (q *JobQueue) Stop() {
	q.cancel()
}
