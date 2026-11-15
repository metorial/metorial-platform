package gitlfs

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
)

const (
	BatchSize = 100

	maxTransferAttempts = 3
	transferBaseTimeout = 2 * time.Minute
	transferBytesPerSec = 1 << 20
)

var transferRetryInterval = 2 * time.Second

type BatchObject struct {
	OID  string
	Size int64
	Open func(ctx context.Context) (io.ReadCloser, error)
}

// UploadBatch asks the server about objects in groups of BatchSize and streams the ones
// it doesn't have to the returned upload URLs. It returns how many it transferred.
func (c *Client) UploadBatch(ctx context.Context, ref string, objects []BatchObject) (int, error) {
	uploaded := 0

	for start := 0; start < len(objects); start += BatchSize {
		group := objects[start:min(start+BatchSize, len(objects))]
		requested := make([]batchObjectR, len(group))
		byOID := make(map[string]BatchObject, len(group))
		for i, object := range group {
			requested[i] = batchObjectR{OID: object.OID, Size: object.Size}
			byOID[object.OID] = object
		}

		response, err := c.batch(ctx, "upload", ref, requested)
		if err != nil {
			return uploaded, err
		}

		for _, obj := range response {
			if obj.Error != nil {
				return uploaded, newError(fmt.Sprintf("Git LFS batch (upload) object %s", obj.OID), c.endpoint+"/objects/batch", obj.Error.Code, obj.Error.Message)
			}
			if obj.Actions == nil || obj.Actions.Upload == nil {
				continue
			}

			object, ok := byOID[obj.OID]
			if !ok {
				return uploaded, fmt.Errorf("Git LFS batch (upload): server returned unrequested object %s", obj.OID)
			}
			if err := c.transfer(ctx, obj, object); err != nil {
				return uploaded, err
			}
			uploaded++
		}
	}

	return uploaded, nil
}

func (c *Client) transfer(ctx context.Context, obj batchObject, object BatchObject) error {
	var lastErr error

	for attempt := 1; attempt <= maxTransferAttempts; attempt++ {
		err := c.putStream(ctx, obj.Actions.Upload, object)

		var readErr *contentReadError
		switch {
		case err == nil:
			if obj.Actions.Verify == nil {
				return nil
			}
			return c.verifyObject(ctx, obj.Actions.Verify, object.OID, object.Size)
		case errors.As(err, &readErr), ctx.Err() != nil:
			return err
		case !retryableTransfer(err):
			return err
		}

		lastErr = err
		if attempt < maxTransferAttempts {
			timer := time.NewTimer(transferRetryInterval * time.Duration(attempt))
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
	}

	return lastErr
}

func retryableTransfer(err error) bool {
	var lfsErr *Error
	if errors.As(err, &lfsErr) {
		return lfsErr.StatusCode >= 500
	}
	return true
}

// contentReadError is a failure reading the source, including integrity checks that
// fail at EOF; it is never retried.
type contentReadError struct {
	OID string
	Err error
}

func (e *contentReadError) Error() string {
	return fmt.Sprintf("Git LFS upload of %s: reading content: %v", e.OID, e.Err)
}

func (e *contentReadError) Unwrap() error { return e.Err }

type recordingReader struct {
	r io.ReadCloser

	mu  sync.Mutex
	err error
}

func (r *recordingReader) Read(p []byte) (int, error) {
	n, err := r.r.Read(p)
	if err != nil && err != io.EOF {
		r.mu.Lock()
		r.err = err
		r.mu.Unlock()
	}
	return n, err
}

func (r *recordingReader) Close() error { return r.r.Close() }

func (r *recordingReader) readErr() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.err
}

func (c *Client) putStream(ctx context.Context, action *batchAction, object BatchObject) error {
	ctx, cancel := context.WithTimeout(ctx, transferBaseTimeout+time.Duration(object.Size/transferBytesPerSec)*time.Second)
	defer cancel()

	body, err := object.Open(ctx)
	if err != nil {
		return &contentReadError{OID: object.OID, Err: err}
	}
	recording := &recordingReader{r: body}
	defer recording.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, action.Href, recording)
	if err != nil {
		return err
	}
	req.ContentLength = object.Size
	if object.Size == 0 {
		req.Body = http.NoBody
	}
	applyActionHeaders(req, action.Header)

	resp, err := c.http.Do(req)
	if readErr := recording.readErr(); readErr != nil {
		if resp != nil {
			resp.Body.Close()
		}
		return &contentReadError{OID: object.OID, Err: readErr}
	}
	if err != nil {
		return transportError("Git LFS upload", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return newError("Git LFS upload", action.Href, resp.StatusCode, string(respBody))
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

func (c *Client) batch(ctx context.Context, operation, ref string, objects []batchObjectR) ([]batchObject, error) {
	body := batchRequest{
		Operation: operation,
		Transfers: []string{"basic"},
		Objects:   objects,
		HashAlgo:  "sha256",
	}
	if ref != "" {
		body.Ref = &batchRef{Name: ref}
	}

	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := c.endpoint + "/objects/batch"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(encoded))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", contentType)
	req.Header.Set("Content-Type", contentType)
	c.authorize(req)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, transportError(fmt.Sprintf("Git LFS batch (%s)", operation), err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, newError(fmt.Sprintf("Git LFS batch (%s)", operation), url, resp.StatusCode, string(respBody))
	}

	var parsed batchResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("Git LFS batch (%s): invalid response: %w", operation, err)
	}
	if parsed.Transfer != "" && parsed.Transfer != "basic" {
		return nil, fmt.Errorf("Git LFS batch (%s): server requires unsupported transfer %q", operation, parsed.Transfer)
	}
	return parsed.Objects, nil
}

// Uploader adapts a Client to commitbatch.LFSUploader for one branch.
type Uploader struct {
	Client *Client
	Ref    string
}

func (u Uploader) UploadLFS(ctx context.Context, objects []commitbatch.LFSObject) (int, error) {
	batch := make([]BatchObject, len(objects))
	for i, object := range objects {
		batch[i] = BatchObject{OID: object.OID, Size: object.Size, Open: object.Open}
	}
	return u.Client.UploadBatch(ctx, u.Ref, batch)
}
