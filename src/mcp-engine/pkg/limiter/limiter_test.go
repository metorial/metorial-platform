package limiter

import (
	"sync/atomic"
	"testing"
	"time"
)

func TestLimiter_AllowsMaxConcurrent(t *testing.T) {
	const maxConcurrent = 3
	const totalTasks = 10

	lim := NewLimiter(maxConcurrent)
	var running int32
	var maxSeen int32

	for i := 0; i < totalTasks; i++ {
		lim.Go(func() {
			cur := atomic.AddInt32(&running, 1)
			defer atomic.AddInt32(&running, -1)
			// Track the maximum number of concurrent goroutines
			for {
				old := atomic.LoadInt32(&maxSeen)
				if cur > old {
					if atomic.CompareAndSwapInt32(&maxSeen, old, cur) {
						break
					}
				} else {
					break
				}
			}
			time.Sleep(50 * time.Millisecond)
		})
	}
	lim.Wait()

	if maxSeen > maxConcurrent {
		t.Errorf("max concurrent goroutines = %d, want <= %d", maxSeen, maxConcurrent)
	}
}

func TestLimiter_WaitBlocksUntilAllDone(t *testing.T) {
	lim := NewLimiter(2)
	done := make(chan struct{})

	lim.Go(func() {
		time.Sleep(50 * time.Millisecond)
		done <- struct{}{}
	})
	lim.Go(func() {
		time.Sleep(50 * time.Millisecond)
		done <- struct{}{}
	})

	go func() {
		lim.Wait()
		done <- struct{}{}
	}()

	// Wait for both tasks to finish
	<-done
	<-done
	// Wait should now return
	select {
	case <-done:
		// ok
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Wait did not return after all goroutines finished")
	}
}

func TestLimiter_GoRunsAllTasks(t *testing.T) {
	const totalTasks = 5
	lim := NewLimiter(2)
	var count int32

	for i := 0; i < totalTasks; i++ {
		lim.Go(func() {
			atomic.AddInt32(&count, 1)
		})
	}
	lim.Wait()

	if count != totalTasks {
		t.Errorf("expected %d tasks to run, got %d", totalTasks, count)
	}
}
