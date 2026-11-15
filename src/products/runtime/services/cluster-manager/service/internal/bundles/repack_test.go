package bundles

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"errors"
	"hash/crc32"
	"io"
	"io/fs"
	"testing"
	"time"

	"github.com/klauspost/compress/zstd"
)

type zipEntry struct {
	name    string
	body    string
	mode    fs.FileMode
	modTime time.Time
}

func makeZip(t *testing.T, entries ...zipEntry) *zip.Reader {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, e := range entries {
		h := &zip.FileHeader{Name: e.name, Method: zip.Deflate, Modified: e.modTime}
		mode := e.mode
		if mode == 0 {
			mode = 0o644
		}
		h.SetMode(mode)
		w, err := zw.CreateHeader(h)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(w, e.body); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return openZip(t, buf.Bytes())
}

func openZip(t *testing.T, data []byte) *zip.Reader {
	t.Helper()
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	return r
}

type tarEntry struct {
	name string
	mode int64
	body string
}

func untar(t *testing.T, data []byte) []tarEntry {
	t.Helper()
	dec, err := zstd.NewReader(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	defer dec.Close()

	var out []tarEntry
	tr := tar.NewReader(dec)
	for {
		h, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return out
		}
		if err != nil {
			t.Fatal(err)
		}
		if !h.ModTime.Equal(epoch) || h.Uid != 0 || h.Gid != 0 {
			t.Fatalf("%s: non-deterministic metadata %+v", h.Name, h)
		}
		body, _ := io.ReadAll(tr)
		out = append(out, tarEntry{h.Name, h.Mode, string(body)})
	}
}

var limits = Limits{MaxUnpackedBytes: 1 << 20, MaxEntries: 100}

func TestRepackNormalizesAndSorts(t *testing.T) {
	z := makeZip(t,
		zipEntry{name: "package.json", body: `{"type":"module"}`, mode: 0o600},
		zipEntry{name: "dist/", mode: fs.ModeDir | 0o700},
		zipEntry{name: "dist/index.js", body: "export const handler = 1", mode: 0o744},
		zipEntry{name: "./README.md", body: "hi"},
	)
	var out bytes.Buffer
	n, err := Repack(z, &out, limits)
	if err != nil {
		t.Fatal(err)
	}
	if n != int64(len(`{"type":"module"}`)+len("export const handler = 1")+len("hi")) {
		t.Fatalf("unexpected unpacked size %d", n)
	}

	got := untar(t, out.Bytes())
	want := []tarEntry{
		{"README.md", 0o644, "hi"},
		{"dist/", 0o755, ""},
		{"dist/index.js", 0o755, "export const handler = 1"},
		{"package.json", 0o644, `{"type":"module"}`},
	}
	if len(got) != len(want) {
		t.Fatalf("got %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("entry %d: got %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestRepackIsDeterministic(t *testing.T) {
	a := makeZip(t,
		zipEntry{name: "a.js", body: "a", modTime: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)},
		zipEntry{name: "b/c.js", body: "c", modTime: time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC)},
	)
	b := makeZip(t,
		zipEntry{name: "b/c.js", body: "c", modTime: time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC)},
		zipEntry{name: "a.js", body: "a", mode: 0o600},
	)

	var outA, outB bytes.Buffer
	if _, err := Repack(a, &outA, limits); err != nil {
		t.Fatal(err)
	}
	if _, err := Repack(b, &outB, limits); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(outA.Bytes(), outB.Bytes()) {
		t.Fatal("equivalent archives produced different bundles")
	}
}

func TestRepackRejectsUnsafeArchives(t *testing.T) {
	cases := map[string]*zip.Reader{
		"parent traversal": makeZip(t, zipEntry{name: "../evil.js", body: "x"}),
		"nested traversal": makeZip(t, zipEntry{name: "a/../../evil.js", body: "x"}),
		"absolute":         makeZip(t, zipEntry{name: "/etc/passwd", body: "x"}),
		"backslash":        makeZip(t, zipEntry{name: `..\evil.js`, body: "x"}),
		"symlink":          makeZip(t, zipEntry{name: "link", body: "/etc/passwd", mode: fs.ModeSymlink | 0o777}),
		"device":           makeZip(t, zipEntry{name: "dev", mode: fs.ModeDevice | 0o644}),
		"duplicate":        makeZip(t, zipEntry{name: "a.js", body: "1"}, zipEntry{name: "./a.js", body: "2"}),
		"file and dir":     makeZip(t, zipEntry{name: "a", body: "1"}, zipEntry{name: "a/b.js", body: "2"}),
		"too many entries": makeZip(t, zipEntry{name: "a", body: "1"}, zipEntry{name: "b", body: "2"}, zipEntry{name: "c", body: "3"}),
		"too large":        makeZip(t, zipEntry{name: "big", body: string(make([]byte, 2048))}),
	}
	small := Limits{MaxUnpackedBytes: 1024, MaxEntries: 2}

	for name, z := range cases {
		var out bytes.Buffer
		_, err := Repack(z, &out, small)
		var invalidErr *InvalidError
		if !errors.As(err, &invalidErr) {
			t.Errorf("%s: expected InvalidError, got %v", name, err)
		}
	}
}

func rawZip(t *testing.T, name string, declared uint64, body []byte) *zip.Reader {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.CreateRaw(&zip.FileHeader{
		Name:               name,
		Method:             zip.Store,
		CRC32:              crc32.ChecksumIEEE(body),
		CompressedSize64:   uint64(len(body)),
		UncompressedSize64: declared,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write(body); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return openZip(t, buf.Bytes())
}

func TestRepackRejectsSizeLies(t *testing.T) {
	body := bytes.Repeat([]byte("x"), 4096)
	for name, z := range map[string]*zip.Reader{
		"larger than declared":  rawZip(t, "bomb", 16, body),
		"shorter than declared": rawZip(t, "short", 8192, body),
	} {
		var out bytes.Buffer
		_, err := Repack(z, &out, Limits{MaxUnpackedBytes: 1 << 20})
		var invalidErr *InvalidError
		if !errors.As(err, &invalidErr) {
			t.Errorf("%s: expected InvalidError, got %v", name, err)
		}
		if out.Len() > 1024 {
			t.Errorf("%s: wrote %d bytes before rejecting", name, out.Len())
		}
	}
}

func TestKeyIsDeterministic(t *testing.T) {
	if Key("fver_1") != Key("fver_1") || Key("fver_1") == Key("fver_2") {
		t.Fatal("bundle keys must be stable and distinct")
	}
	if got := Key("fver_1"); len(got) != len("runtime/bundles/")+64+len(".tar.zst") {
		t.Fatalf("unexpected key %s", got)
	}
}
