package bundles

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// DiskCache is a size-capped, least-recently-used cache of bundle files on local disk. Bundles are
// immutable per key, so entries never need invalidation. A nil or disabled cache is a no-op.
type DiskCache struct {
	dir      string
	maxBytes int64

	mu      sync.Mutex
	entries map[string]*cacheEntry
	total   int64
}

type cacheEntry struct {
	size     int64
	accessed time.Time
}

func NewDiskCache(dir string, maxBytes int64) (*DiskCache, error) {
	if dir == "" || maxBytes <= 0 {
		return nil, nil
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}

	c := &DiskCache{dir: dir, maxBytes: maxBytes, entries: map[string]*cacheEntry{}}
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	for _, f := range files {
		if strings.HasPrefix(f.Name(), ".tmp-") {
			_ = os.Remove(filepath.Join(dir, f.Name()))
			continue
		}
		info, err := f.Info()
		if err != nil || !info.Mode().IsRegular() {
			continue
		}
		c.entries[f.Name()] = &cacheEntry{size: info.Size(), accessed: info.ModTime()}
		c.total += info.Size()
	}
	c.mu.Lock()
	c.evictLocked()
	c.mu.Unlock()
	return c, nil
}

func (c *DiskCache) Enabled() bool {
	return c != nil
}

func fileName(name string) string {
	sum := sha256.Sum256([]byte(name))
	return hex.EncodeToString(sum[:])
}

func (c *DiskCache) Open(name string) (*os.File, int64, bool) {
	if c == nil {
		return nil, 0, false
	}
	file := fileName(name)

	c.mu.Lock()
	entry, ok := c.entries[file]
	if ok {
		entry.accessed = time.Now()
	}
	c.mu.Unlock()
	if !ok {
		return nil, 0, false
	}

	f, err := os.Open(filepath.Join(c.dir, file))
	if err != nil {
		return nil, 0, false
	}
	return f, entry.size, true
}

type CacheWriter struct {
	cache *DiskCache
	file  string
	tmp   *os.File
	n     int64
	limit int64
}

// Writer returns a sink for one object. Objects of unknown size or larger than a quarter of the
// cache aren't cached; the returned writer then discards everything.
func (c *DiskCache) Writer(name string, size int64) *CacheWriter {
	if c == nil || size < 0 || size > c.maxBytes/4 {
		return &CacheWriter{}
	}
	tmp, err := os.CreateTemp(c.dir, ".tmp-*")
	if err != nil {
		return &CacheWriter{}
	}
	return &CacheWriter{cache: c, file: fileName(name), tmp: tmp, limit: size}
}

func (w *CacheWriter) Write(p []byte) (int, error) {
	if w.tmp == nil {
		return len(p), nil
	}
	if _, err := w.tmp.Write(p); err != nil {
		w.Abort()
		return len(p), nil
	}
	w.n += int64(len(p))
	return len(p), nil
}

func (w *CacheWriter) Abort() {
	if w.tmp == nil {
		return
	}
	_ = w.tmp.Close()
	_ = os.Remove(w.tmp.Name())
	w.tmp = nil
}

func (w *CacheWriter) Commit() {
	if w.tmp == nil {
		return
	}
	defer func() { w.tmp = nil }()

	if err := w.tmp.Close(); err != nil || w.n != w.limit {
		_ = os.Remove(w.tmp.Name())
		return
	}
	if err := os.Rename(w.tmp.Name(), filepath.Join(w.cache.dir, w.file)); err != nil {
		_ = os.Remove(w.tmp.Name())
		return
	}

	c := w.cache
	c.mu.Lock()
	defer c.mu.Unlock()
	if old, ok := c.entries[w.file]; ok {
		c.total -= old.size
	}
	c.entries[w.file] = &cacheEntry{size: w.n, accessed: time.Now()}
	c.total += w.n
	c.evictLocked()
}

func (c *DiskCache) evictLocked() {
	if c.total <= c.maxBytes {
		return
	}
	names := make([]string, 0, len(c.entries))
	for name := range c.entries {
		names = append(names, name)
	}
	sort.Slice(names, func(i, j int) bool { return c.entries[names[i]].accessed.Before(c.entries[names[j]].accessed) })

	for _, name := range names {
		if c.total <= c.maxBytes {
			return
		}
		_ = os.Remove(filepath.Join(c.dir, name))
		c.total -= c.entries[name].size
		delete(c.entries, name)
	}
}
