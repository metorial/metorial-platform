package remotestate

import (
	"bytes"
	"compress/gzip"
	"io"
)

func gzipReader(data []byte) (io.Reader, error) {
	return gzip.NewReader(bytes.NewReader(data))
}

func gzipBytes(data []byte) []byte {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	gz.Write(data)
	gz.Close()
	return buf.Bytes()
}
