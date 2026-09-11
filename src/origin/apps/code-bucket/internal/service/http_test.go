package service

import (
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
)

func TestWriteFileResponseSendsSmallFilesUnchanged(t *testing.T) {
	content := "package main"
	recorder := httptest.NewRecorder()

	info := &fs.FileInfo{
		Path:        "main.go",
		Size:        int64(len(content)),
		ContentType: "text/x-go",
	}

	placeholder, err := writeFileResponse(recorder, info, strings.NewReader(content))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if placeholder {
		t.Fatal("a small file should be served as itself")
	}

	if got := recorder.Body.String(); got != content {
		t.Fatalf("body = %q, want %q", got, content)
	}
	if got := recorder.Header().Get("Content-Type"); got != "text/x-go" {
		t.Fatalf("content type = %q, want the file's own type", got)
	}
	if got := recorder.Header().Get("Content-Length"); got != strconv.Itoa(len(content)) {
		t.Fatalf("content length = %q, want %d", got, len(content))
	}
	if recorder.Header().Get(FileTooLargeHeader) != "" {
		t.Fatal("a small file should not be marked as a placeholder")
	}
}

func TestWriteFileResponseServesAtTheLimit(t *testing.T) {
	info := &fs.FileInfo{Path: "big.bin", Size: maxServedFileBytes, ContentType: "application/octet-stream"}
	recorder := httptest.NewRecorder()

	placeholder, err := writeFileResponse(recorder, info, strings.NewReader("x"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if placeholder {
		t.Fatal("a file exactly at the limit should still be served")
	}
}

func TestWriteFileResponseReplacesOversizedFilesWithAMessage(t *testing.T) {
	// A reader that must never be touched: the whole point is not to move the
	// bytes of a file this large.
	body := readerThatFailsIfUsed{t: t}
	info := &fs.FileInfo{
		Path:        "huge.bin",
		Size:        maxServedFileBytes + 1,
		ContentType: "application/octet-stream",
	}
	recorder := httptest.NewRecorder()

	placeholder, err := writeFileResponse(recorder, info, body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !placeholder {
		t.Fatal("an oversized file should be replaced with a placeholder")
	}

	if got := recorder.Header().Get(FileTooLargeHeader); got != "true" {
		t.Fatalf("%s = %q, want \"true\"", FileTooLargeHeader, got)
	}
	if got := recorder.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/plain") {
		t.Fatalf("content type = %q, want text/plain", got)
	}

	served := recorder.Body.String()
	if !strings.Contains(served, "too large to display") {
		t.Fatalf("body = %q, want it to say the file is too large to display", served)
	}
	if !strings.Contains(served, "10.0 MiB") {
		t.Fatalf("body = %q, want it to name the limit", served)
	}
}

func TestFileTooLargeMessageNamesTheSizeAndLimit(t *testing.T) {
	got := fileTooLargeMessage(500 << 20)
	want := "This file is too large to display (500.0 MiB, over the 10.0 MiB limit)."

	if got != want {
		t.Fatalf("message = %q, want %q", got, want)
	}
}

type readerThatFailsIfUsed struct {
	t *testing.T
}

func (r readerThatFailsIfUsed) Read([]byte) (int, error) {
	r.t.Error("the oversized file's content was read, which defeats the limit")
	return 0, nil
}
