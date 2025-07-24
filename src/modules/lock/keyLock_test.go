package lock

import (
	"sync"
	"testing"
	"time"
)

func TestKeyLock_LockUnlock_SingleKey(t *testing.T) {
	kl := NewKeyLock()
	key := "foo"

	kl.Lock(key)
	locked := true

	done := make(chan struct{})
	go func() {
		kl.Lock(key)
		locked = false
		kl.Unlock(key)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)
	if !locked {
		t.Fatal("Lock should block other goroutines on same key")
	}

	kl.Unlock(key)
	select {
	case <-done:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Unlock did not unblock waiting goroutine")
	}
}

func TestKeyLock_LockUnlock_DifferentKeys(t *testing.T) {
	kl := NewKeyLock()
	key1 := "foo"
	key2 := "bar"

	kl.Lock(key1)

	done := make(chan struct{})
	go func() {
		kl.Lock(key2)
		kl.Unlock(key2)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Lock on different key should not block")
	}

	kl.Unlock(key1)
}

func TestKeyLock_UnlockWithoutLock_Panics(t *testing.T) {
	kl := NewKeyLock()
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("Expected panic when unlocking unacquired key")
		}
	}()
	kl.Unlock("notlocked")
}

func TestKeyLock_ConcurrentLockUnlock(t *testing.T) {
	kl := NewKeyLock()
	key := "foo"
	var wg sync.WaitGroup
	counter := 0

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			kl.Lock(key)
			tmp := counter
			time.Sleep(10 * time.Millisecond)
			counter = tmp + 1
			kl.Unlock(key)
			wg.Done()
		}()
	}
	wg.Wait()
	if counter != 10 {
		t.Fatalf("Expected counter to be 10, got %d", counter)
	}
}

func TestKeyLock_DeletesUnusedLocks(t *testing.T) {
	kl := NewKeyLock()
	key := "foo"

	kl.Lock(key)
	kl.Unlock(key)

	kl.mu.Lock()
	_, exists := kl.locks[key]
	kl.mu.Unlock()
	if exists {
		t.Fatal("Lock for key should be deleted after last unlock")
	}
}
