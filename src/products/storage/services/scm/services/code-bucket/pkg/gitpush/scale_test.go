package gitpush_test

import (
	"bytes"
	"fmt"
	"runtime"
	"runtime/debug"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
)

const (
	scaleEntries   = 250_000
	scaleHeapLimit = 320 << 20
)

func scaleContent(i int) string { return fmt.Sprintf("skill %d\n", i) }

func scalePath(i int) string {
	return fmt.Sprintf("plugins/p%04d/skills/s%02d/SKILL.md", i/100, i%100)
}

// peakHeap samples the live heap until stop is called.
func peakHeap() (stop func() uint64) {
	var peak atomic.Uint64
	done := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		var stats runtime.MemStats
		for {
			runtime.ReadMemStats(&stats)
			if stats.HeapAlloc > peak.Load() {
				peak.Store(stats.HeapAlloc)
			}
			select {
			case <-done:
				return
			case <-time.After(20 * time.Millisecond):
			}
		}
	}()
	return func() uint64 {
		close(done)
		wg.Wait()
		return peak.Load()
	}
}

func TestExportScale250k(t *testing.T) {
	if testing.Short() {
		t.Skip("scale test")
	}

	repo := gittest.NewRepo(t, nil)
	var stream bytes.Buffer
	fmt.Fprintf(&stream, "commit refs/heads/main\ncommitter Test <test@example.com> 0 +0000\ndata 4\ninit\n")
	files := make(map[string]string, scaleEntries)
	for i := 0; i < scaleEntries; i++ {
		content := scaleContent(i)
		files[scalePath(i)] = content
		fmt.Fprintf(&stream, "M 100644 inline %s\ndata %d\n%s\n", scalePath(i), len(content), content)
	}
	repo.FastImport(&stream)
	stream = bytes.Buffer{}

	server := repo.Serve()
	f := &fixture{t: t, repo: repo, server: server, manifests: gittest.NewManifests(t, scope), listings: gittest.NewListings()}
	for i := 0; i < 10; i++ {
		files[scalePath(i*997)] = "changed " + scaleContent(i)
	}
	opts := f.options(files, nil)
	opts.Fetch.AuthHeader = ""

	defer debug.SetGCPercent(debug.SetGCPercent(20))
	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)
	stop := peakHeap()
	started := time.Now()
	result := f.mustExport(opts)
	elapsed := time.Since(started)
	growth := stop() - before.HeapAlloc

	t.Logf("250k entries: %s, peak heap growth %d MiB over %d MiB, %d commits, %d requests", elapsed, growth>>20, before.HeapAlloc>>20, result.CommitsCreated, result.Stats.GithubRequests)
	if growth > scaleHeapLimit {
		t.Fatalf("peak heap grew by %d MiB, want under %d MiB", growth>>20, scaleHeapLimit>>20)
	}
	if result.CommitsCreated == 0 || result.Stats.FilesUploaded != 10 {
		t.Fatalf("result = %+v", result.Stats)
	}
	if result.NewRemoteState == nil || result.NewRemoteState.EntryCount < scaleEntries {
		t.Fatalf("NewRemoteState = %+v", result.NewRemoteState)
	}
	for _, push := range f.pushes() {
		if len(push.Body) > 256<<10 {
			t.Fatalf("push of 10 small files was %d bytes", len(push.Body))
		}
	}
	if got := repo.Show("main", scalePath(997)); got != "changed "+scaleContent(1) {
		t.Fatalf("content = %q", got)
	}

	f.server.Reset()
	warm := f.mustExport(f.options(files, result.NewRemoteState))
	if warm.CommitsCreated != 0 || len(f.fetches()) != 0 || len(f.server.Requests()) > 3 {
		t.Fatalf("warm run: %d commits, %d fetches, %d requests", warm.CommitsCreated, len(f.fetches()), len(f.server.Requests()))
	}
}
