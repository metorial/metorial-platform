package bundle_test

import (
	"archive/tar"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/bundle"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/bundle/bundletest"
)

func fetch(t *testing.T, srv *bundletest.Server, data []byte, mutate func(*bundle.FetchOptions)) (string, error) {
	t.Helper()
	dir := t.TempDir()
	tokenFile := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(tokenFile, []byte(srv.Token+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	opts := bundle.FetchOptions{
		Addr:           srv.URL,
		TokenFile:      tokenFile,
		ExpectedSize:   int64(len(data)),
		ExpectedSHA256: bundletest.SHA256(data),
		Dir:            dir,
	}
	if mutate != nil {
		mutate(&opts)
	}
	_, err := bundle.Fetch(context.Background(), opts)
	return dir, err
}

func TestFetchUnpacksVerifiedBundle(t *testing.T) {
	data := bundletest.Pack(
		bundletest.File("index.js", "module.exports = () => 1"),
		bundletest.Entry{Header: tar.Header{Name: "bin/", Typeflag: tar.TypeDir, Mode: 0o755}},
		bundletest.Entry{Header: tar.Header{Name: "bin/run", Typeflag: tar.TypeReg, Mode: 0o4755}, Body: []byte("#!/bin/sh")},
		bundletest.Entry{Header: tar.Header{Name: "lib/link.js", Typeflag: tar.TypeSymlink, Linkname: "../index.js"}},
		bundletest.Entry{Header: tar.Header{Name: "hard.js", Typeflag: tar.TypeLink, Linkname: "index.js"}},
	)
	srv := bundletest.NewServer("tok", data)
	defer srv.Close()

	dir, err := fetch(t, srv, data, nil)
	if err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"index.js", "lib/link.js", "hard.js"} {
		got, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil || string(got) != "module.exports = () => 1" {
			t.Fatalf("%s: %q %v", name, got, err)
		}
	}
	info, err := os.Stat(filepath.Join(dir, "bin/run"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o755 || info.Mode()&os.ModeSetuid != 0 {
		t.Fatalf("unexpected mode %v", info.Mode())
	}
}

func TestFetchRejectsBadTokenAndIntegrity(t *testing.T) {
	data := bundletest.Pack(bundletest.File("index.js", "x"))
	srv := bundletest.NewServer("tok", data)
	defer srv.Close()

	_, err := fetch(t, srv, data, func(o *bundle.FetchOptions) {
		_ = os.WriteFile(o.TokenFile, []byte("wrong"), 0o600)
	})
	var status *bundle.StatusError
	if !errors.As(err, &status) || status.Status != 401 {
		t.Fatalf("expected 401, got %v", err)
	}

	dir, err := fetch(t, srv, data, func(o *bundle.FetchOptions) { o.ExpectedSHA256 = strings.Repeat("0", 64) })
	var integrity *bundle.IntegrityError
	if !errors.As(err, &integrity) {
		t.Fatalf("expected integrity error, got %v", err)
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Fatalf("bundle dir not cleared after failed verification: %v", entries)
	}

	_, err = fetch(t, srv, data, func(o *bundle.FetchOptions) { o.ExpectedSize-- })
	if !errors.As(err, &integrity) {
		t.Fatalf("expected size mismatch, got %v", err)
	}
}

func TestUnpackRejectsUnsafeArchives(t *testing.T) {
	cases := map[string][]bundletest.Entry{
		"traversal":          {bundletest.File("../evil.js", "x")},
		"nested traversal":   {bundletest.File("a/../../evil.js", "x")},
		"absolute":           {bundletest.File("/etc/evil", "x")},
		"absolute symlink":   {{Header: tar.Header{Name: "l", Typeflag: tar.TypeSymlink, Linkname: "/etc/passwd"}}},
		"escaping symlink":   {{Header: tar.Header{Name: "a/l", Typeflag: tar.TypeSymlink, Linkname: "../../etc"}}},
		"escaping hard link": {{Header: tar.Header{Name: "h", Typeflag: tar.TypeLink, Linkname: "../outside"}}},
		"char device":        {{Header: tar.Header{Name: "dev", Typeflag: tar.TypeChar, Devmajor: 1, Devminor: 3}}},
		"block device":       {{Header: tar.Header{Name: "dev", Typeflag: tar.TypeBlock}}},
		"fifo":               {{Header: tar.Header{Name: "fifo", Typeflag: tar.TypeFifo}}},
		"write through symlink": {
			{Header: tar.Header{Name: "sub/up", Typeflag: tar.TypeSymlink, Linkname: ".."}},
			bundletest.File("sub/up/up2/x", "x"),
			{Header: tar.Header{Name: "sub/up/escape", Typeflag: tar.TypeSymlink, Linkname: "../.."}},
		},
		"symlink chain": {
			{Header: tar.Header{Name: "p/d", Typeflag: tar.TypeSymlink, Linkname: "../q"}},
			{Header: tar.Header{Name: "q/", Typeflag: tar.TypeDir, Mode: 0o755}},
			{Header: tar.Header{Name: "p/l", Typeflag: tar.TypeSymlink, Linkname: "d/../../x"}},
		},
	}

	for name, entries := range cases {
		t.Run(name, func(t *testing.T) {
			parent := t.TempDir()
			dir := filepath.Join(parent, "bundle")
			if err := os.Mkdir(dir, 0o755); err != nil {
				t.Fatal(err)
			}

			data := bundletest.Pack(entries...)
			srv := bundletest.NewServer("tok", data)
			defer srv.Close()

			_, err := fetch(t, srv, data, func(o *bundle.FetchOptions) { o.Dir = dir })
			if err == nil {
				t.Fatal("expected unsafe archive to be rejected")
			}
			if leftovers, _ := os.ReadDir(parent); len(leftovers) != 1 {
				t.Fatalf("archive wrote outside the bundle: %v", leftovers)
			}
		})
	}
}

func TestUnpackEnforcesLimits(t *testing.T) {
	data := bundletest.Pack(bundletest.File("a", strings.Repeat("x", 2048)))
	srv := bundletest.NewServer("tok", data)
	defer srv.Close()

	_, err := fetch(t, srv, data, func(o *bundle.FetchOptions) { o.Limits = bundle.Limits{MaxUnpackedBytes: 1024} })
	var unsafe *bundle.UnsafeArchiveError
	if !errors.As(err, &unsafe) {
		t.Fatalf("expected size limit rejection, got %v", err)
	}

	many := bundletest.Pack(bundletest.File("a", "1"), bundletest.File("b", "2"), bundletest.File("c", "3"))
	srv.Bundle = many
	_, err = fetch(t, srv, many, func(o *bundle.FetchOptions) { o.Limits = bundle.Limits{MaxEntries: 2} })
	if !errors.As(err, &unsafe) {
		t.Fatalf("expected entry limit rejection, got %v", err)
	}
}
