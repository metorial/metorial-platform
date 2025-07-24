package limiter

import (
	"sync"
)

type Limiter struct {
	sem chan struct{}
	wg  sync.WaitGroup
}

func NewLimiter(maxConcurrent int) *Limiter {
	return &Limiter{
		sem: make(chan struct{}, maxConcurrent),
	}
}

func (l *Limiter) Go(f func()) {
	l.sem <- struct{}{} // acquire a slot
	l.wg.Add(1)

	go func() {
		defer func() {
			<-l.sem // release the slot
			l.wg.Done()
		}()
		f()
	}()
}

func (l *Limiter) Wait() {
	l.wg.Wait()
}
