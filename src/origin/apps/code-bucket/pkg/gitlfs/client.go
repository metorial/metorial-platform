package gitlfs

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const contentType = "application/vnd.git-lfs+json"

const maxPreallocateBytes int64 = 32 << 20

const DefaultUsername = "x-access-token"

type Client struct {
	endpoint string
	username string
	token    string
	http     *http.Client
}

func NewClient(endpoint, username, token string, httpClient *http.Client) *Client {
	if username == "" {
		username = DefaultUsername
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		endpoint: strings.TrimSuffix(endpoint, "/"),
		username: username,
		token:    token,
		http:     httpClient,
	}
}

type batchRequest struct {
	Operation string         `json:"operation"`
	Transfers []string       `json:"transfers"`
	Ref       *batchRef      `json:"ref,omitempty"`
	Objects   []batchObjectR `json:"objects"`
	HashAlgo  string         `json:"hash_algo"`
}

type batchRef struct {
	Name string `json:"name"`
}

type batchObjectR struct {
	OID  string `json:"oid"`
	Size int64  `json:"size"`
}

type batchAction struct {
	Href   string            `json:"href"`
	Header map[string]string `json:"header"`
}

type batchObjectError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type batchObject struct {
	OID     string `json:"oid"`
	Size    int64  `json:"size"`
	Actions *struct {
		Upload   *batchAction `json:"upload"`
		Verify   *batchAction `json:"verify"`
		Download *batchAction `json:"download"`
	} `json:"actions"`
	Error *batchObjectError `json:"error"`
}

type batchResponse struct {
	Transfer string        `json:"transfer"`
	Objects  []batchObject `json:"objects"`
}

type ContentOpener func() (io.ReadCloser, error)

func OpenerForBytes(content []byte) ContentOpener {
	return func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(content)), nil
	}
}

func (c *Client) Upload(ctx context.Context, ref, oid string, size int64, open ContentOpener) error {
	obj, err := c.batchOne(ctx, "upload", ref, oid, size)
	if err != nil {
		return err
	}

	if obj.Actions == nil || obj.Actions.Upload == nil {
		return nil
	}

	if err := c.putObject(ctx, obj.Actions.Upload, size, open); err != nil {
		return err
	}

	if obj.Actions.Verify == nil {
		return nil
	}
	return c.verifyObject(ctx, obj.Actions.Verify, oid, size)
}

func (c *Client) DownloadTo(ctx context.Context, ref string, pointer *Pointer, w io.Writer) error {
	obj, err := c.batchOne(ctx, "download", ref, pointer.OID, pointer.Size)
	if err != nil {
		return err
	}

	if obj.Actions == nil || obj.Actions.Download == nil {
		return fmt.Errorf("Git LFS server returned no download action for object %s: %w", pointer.OID, ErrObjectNotFound)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, obj.Actions.Download.Href, nil)
	if err != nil {
		return err
	}
	applyActionHeaders(req, obj.Actions.Download.Header)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("Git LFS download for object %s: %w", pointer.OID, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return newError("Git LFS download", obj.Actions.Download.Href, resp.StatusCode, string(body))
	}

	digest := sha256.New()
	written, err := io.Copy(io.MultiWriter(w, digest), io.LimitReader(resp.Body, pointer.Size+1))
	if err != nil {
		return fmt.Errorf("Git LFS download for object %s: %w", pointer.OID, err)
	}
	if written != pointer.Size {
		return fmt.Errorf("Git LFS object %s: expected %d bytes, got %d", pointer.OID, pointer.Size, written)
	}
	if got := hex.EncodeToString(digest.Sum(nil)); got != pointer.OID {
		return fmt.Errorf("Git LFS object %s: content digest mismatch (got %s)", pointer.OID, got)
	}

	return nil
}

func (c *Client) Download(ctx context.Context, ref string, pointer *Pointer) ([]byte, error) {
	var buf bytes.Buffer
	if pointer.Size > 0 && pointer.Size <= maxPreallocateBytes {
		buf.Grow(int(pointer.Size))
	}

	if err := c.DownloadTo(ctx, ref, pointer, &buf); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (c *Client) batchOne(ctx context.Context, operation, ref, oid string, size int64) (*batchObject, error) {
	body := batchRequest{
		Operation: operation,
		Transfers: []string{"basic"},
		Objects:   []batchObjectR{{OID: oid, Size: size}},
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
		return nil, fmt.Errorf("Git LFS batch (%s): %w", operation, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
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
	if len(parsed.Objects) != 1 {
		return nil, fmt.Errorf("Git LFS batch (%s): expected 1 object, got %d", operation, len(parsed.Objects))
	}

	obj := parsed.Objects[0]
	if obj.Error != nil {
		return nil, newError(
			fmt.Sprintf("Git LFS batch (%s) object %s", operation, oid),
			url,
			obj.Error.Code,
			obj.Error.Message,
		)
	}

	return &obj, nil
}

func (c *Client) putObject(ctx context.Context, action *batchAction, size int64, open ContentOpener) error {
	body, err := open()
	if err != nil {
		return fmt.Errorf("Git LFS upload: %w", err)
	}
	defer body.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, action.Href, body)
	if err != nil {
		return err
	}
	req.ContentLength = size
	applyActionHeaders(req, action.Header)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("Git LFS upload: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return newError("Git LFS upload", action.Href, resp.StatusCode, string(body))
	}

	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

func (c *Client) verifyObject(ctx context.Context, action *batchAction, oid string, size int64) error {
	encoded, err := json.Marshal(batchObjectR{OID: oid, Size: size})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, action.Href, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", contentType)
	req.Header.Set("Content-Type", contentType)
	applyActionHeaders(req, action.Header)
	if req.Header.Get("Authorization") == "" {
		c.authorize(req)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("Git LFS verify: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return newError("Git LFS verify", action.Href, resp.StatusCode, string(body))
	}

	_, _ = io.Copy(io.Discard, resp.Body)
	return nil
}

func (c *Client) authorize(req *http.Request) {
	if c.token == "" {
		return
	}
	credentials := base64.StdEncoding.EncodeToString([]byte(c.username + ":" + c.token))
	req.Header.Set("Authorization", "Basic "+credentials)
}

func applyActionHeaders(req *http.Request, headers map[string]string) {
	for key, value := range headers {
		req.Header.Set(key, value)
	}
}
