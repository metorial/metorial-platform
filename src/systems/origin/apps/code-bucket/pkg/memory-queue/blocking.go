package memoryQueue

import (
	"context"
	"log"
	"sync"
)

type BlockingJobQueue struct {
	jobs       chan func() error
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
	concurrent int
	err        error
}

func NewBlockingJobQueue(concurrency int) *BlockingJobQueue {
	ctx, cancel := context.WithCancel(context.Background())
	q := &BlockingJobQueue{
		jobs:       make(chan func() error),
		ctx:        ctx,
		cancel:     cancel,
		concurrent: concurrency,
	}

	for i := 0; i < concurrency; i++ {
		go q.worker()
	}

	return q
}

func (q *BlockingJobQueue) worker() {
	for {
		select {
		case <-q.ctx.Done():
			return
		case job, ok := <-q.jobs:
			if !ok {
				return
			}
			err := runJobWithRecovery(job)
			if err != nil {
				q.err = err
				log.Printf("Job failed: %v\n", err)
			}
			q.wg.Done()
		}
	}
}

func (q *BlockingJobQueue) AddAndBlockIfFull(job func() error) {
	q.wg.Add(1)
	q.jobs <- job
}

func (q *BlockingJobQueue) Wait() error {
	q.wg.Wait()
	return q.err
}

func (q *BlockingJobQueue) Stop() {
	q.cancel()
	close(q.jobs)
}
