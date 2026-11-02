package objectstorage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const customMetadataHeaderPrefix = "X-Object-Meta-"

const maxErrorBodyBytes = 8 * 1024

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type Bucket struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

type ObjectMetadata struct {
	Key          string            `json:"key"`
	Size         uint64            `json:"size"`
	ContentType  *string           `json:"content_type,omitempty"`
	ETag         string            `json:"etag"`
	LastModified string            `json:"last_modified"`
	Metadata     map[string]string `json:"metadata"`
}

type ObjectData struct {
	Metadata ObjectMetadata
	Data     []byte
}

// ObjectStream is an object being read directly from the store rather than
// buffered. The caller owns Body and must close it.
type ObjectStream struct {
	Metadata ObjectMetadata
	Body     io.ReadCloser
}

type createBucketRequest struct {
	Name string `json:"name"`
}

type listBucketsResponse struct {
	Buckets []Bucket `json:"buckets"`
}

type listObjectsResponse struct {
	Objects               []ObjectMetadata `json:"objects"`
	NextContinuationToken *string          `json:"next_continuation_token,omitempty"`
}

type ObjectPage struct {
	Objects               []ObjectMetadata
	NextContinuationToken *string
}

type deleteObjectsRequest struct {
	Keys []string `json:"keys"`
}

type copyObjectRequest struct {
	SourceBucket string `json:"source_bucket"`
	SourceKey    string `json:"source_key"`
}

type DeleteObjectResult struct {
	Key     string  `json:"key"`
	Deleted bool    `json:"deleted"`
	Error   *string `json:"error,omitempty"`
}

type deleteObjectsResponse struct {
	Results []DeleteObjectResult `json:"results"`
	Deleted int                  `json:"deleted"`
	Failed  int                  `json:"failed"`
}

type PublicUrlPurpose string

const (
	PublicUrlPurposeRetrieve PublicUrlPurpose = "retrieve"
	PublicUrlPurposeUpload   PublicUrlPurpose = "upload"
)

type PublicURLResponse struct {
	URL       string `json:"url"`
	ExpiresIn uint64 `json:"expires_in"`
}

type Error struct {
	StatusCode int
	Message    string
}

func (e *Error) Error() string {
	return fmt.Sprintf("object storage error (status %d): %s", e.StatusCode, e.Message)
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func NewClientWithHTTP(baseURL string, httpClient *http.Client) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: httpClient,
	}
}

// EscapeObjectKey percent-encodes each segment of an object key so characters such as '#', '?'
// and '%' reach the server as part of the key instead of being parsed as URL syntax.
func EscapeObjectKey(key string) string {
	segments := strings.Split(key, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}

func (c *Client) objectURL(route, bucket, key string) string {
	return fmt.Sprintf("%s/buckets/%s/%s/%s", c.baseURL, url.PathEscape(bucket), route, EscapeObjectKey(key))
}

func (c *Client) Ping() error {
	req, err := http.NewRequest("GET", c.baseURL+"/ping", nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	return nil
}

func (c *Client) CreateBucket(name string) (*Bucket, error) {
	reqBody := createBucketRequest{Name: name}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", c.baseURL+"/buckets", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var bucket Bucket
	if err := json.NewDecoder(resp.Body).Decode(&bucket); err != nil {
		return nil, err
	}

	return &bucket, nil
}

func (c *Client) UpsertBucket(name string) (*Bucket, error) {
	reqBody := createBucketRequest{Name: name}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("PUT", c.baseURL+"/buckets", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var bucket Bucket
	if err := json.NewDecoder(resp.Body).Decode(&bucket); err != nil {
		return nil, err
	}

	return &bucket, nil
}

func (c *Client) GetBucket(id string) (*Bucket, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/buckets/"+id, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var bucket Bucket
	if err := json.NewDecoder(resp.Body).Decode(&bucket); err != nil {
		return nil, err
	}

	return &bucket, nil
}

func (c *Client) ListBuckets() ([]Bucket, error) {
	req, err := http.NewRequest("GET", c.baseURL+"/buckets", nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var result listBucketsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Buckets, nil
}

func (c *Client) DeleteBucket(name string) error {
	req, err := http.NewRequest("DELETE", c.baseURL+"/buckets/"+name, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	return nil
}

func (c *Client) PutObject(bucket, key string, data []byte, contentType *string, metadata map[string]string) (*ObjectMetadata, error) {
	urlPath := c.objectURL("objects", bucket, key)
	req, err := http.NewRequest("PUT", urlPath, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	if contentType != nil {
		req.Header.Set("Content-Type", *contentType)
	}

	for k, v := range metadata {
		req.Header.Set("x-object-meta-"+k, v)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var objMetadata ObjectMetadata
	if err := json.NewDecoder(resp.Body).Decode(&objMetadata); err != nil {
		return nil, err
	}

	return &objMetadata, nil
}

func (c *Client) GetObject(bucket, key string) (*ObjectData, error) {
	urlPath := c.objectURL("objects", bucket, key)
	req, err := http.NewRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return &ObjectData{
		Metadata: objectMetadataFromHeaders(key, resp.Header),
		Data:     data,
	}, nil
}

func (c *Client) GetObjectStream(ctx context.Context, bucket, key string) (*ObjectStream, error) {
	urlPath := c.objectURL("objects", bucket, key)
	req, err := http.NewRequestWithContext(ctx, "GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes))
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	return &ObjectStream{
		Metadata: objectMetadataFromHeaders(key, resp.Header),
		Body:     resp.Body,
	}, nil
}

func (c *Client) PutObjectFromReader(
	ctx context.Context,
	bucket, key string,
	body io.Reader,
	size int64,
	contentType *string,
	metadata map[string]string,
) (*ObjectMetadata, error) {
	urlPath := c.objectURL("objects", bucket, key)
	req, err := http.NewRequestWithContext(ctx, "PUT", urlPath, body)
	if err != nil {
		return nil, err
	}

	if size >= 0 {
		req.ContentLength = size
	}

	if contentType != nil {
		req.Header.Set("Content-Type", *contentType)
	}

	for k, v := range metadata {
		req.Header.Set("x-object-meta-"+k, v)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodyBytes))
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var objMetadata ObjectMetadata
	if err := json.NewDecoder(resp.Body).Decode(&objMetadata); err != nil {
		return nil, err
	}

	return &objMetadata, nil
}

func objectMetadataFromHeaders(key string, header http.Header) ObjectMetadata {
	size, _ := strconv.ParseUint(header.Get("Content-Length"), 10, 64)

	var contentType *string
	if value := header.Get("Content-Type"); value != "" {
		contentType = &value
	}

	metadata := make(map[string]string)
	for headerName, headerValues := range header {
		if len(headerValues) == 0 {
			continue
		}

		if metaKey, ok := strings.CutPrefix(headerName, customMetadataHeaderPrefix); ok {
			metadata[metaKey] = headerValues[0]
		}
	}

	return ObjectMetadata{
		Key:          key,
		Size:         size,
		ContentType:  contentType,
		ETag:         header.Get("ETag"),
		LastModified: header.Get("Last-Modified"),
		Metadata:     metadata,
	}
}

func (c *Client) HeadObject(bucket, key string) (*ObjectMetadata, error) {
	urlPath := c.objectURL("objects", bucket, key)
	req, err := http.NewRequest("HEAD", urlPath, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    "Object not found",
		}
	}

	metadata := objectMetadataFromHeaders(key, resp.Header)
	return &metadata, nil
}

func (c *Client) GetObjectInfo(bucket, key string) (*ObjectMetadata, error) {
	urlPath := c.objectURL("object-info", bucket, key)
	req, err := http.NewRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var objMetadata ObjectMetadata
	if err := json.NewDecoder(resp.Body).Decode(&objMetadata); err != nil {
		return nil, err
	}

	return &objMetadata, nil
}

func (c *Client) DeleteObject(bucket, key string) error {
	urlPath := c.objectURL("objects", bucket, key)
	req, err := http.NewRequest("DELETE", urlPath, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	return nil
}

func (c *Client) DeleteObjects(bucket string, keys []string) ([]DeleteObjectResult, error) {
	if len(keys) == 0 {
		return []DeleteObjectResult{}, nil
	}

	body, err := json.Marshal(deleteObjectsRequest{Keys: keys})
	if err != nil {
		return nil, err
	}

	urlPath := fmt.Sprintf("%s/buckets/%s/objects/delete", c.baseURL, url.PathEscape(bucket))
	req, err := http.NewRequest("POST", urlPath, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var result deleteObjectsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Results, nil
}

func (c *Client) CopyObject(bucket, key, sourceBucket, sourceKey string) (*ObjectMetadata, error) {
	body, err := json.Marshal(copyObjectRequest{
		SourceBucket: sourceBucket,
		SourceKey:    sourceKey,
	})
	if err != nil {
		return nil, err
	}

	urlPath := c.objectURL("copy-object", bucket, key)
	req, err := http.NewRequest("POST", urlPath, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var result ObjectMetadata
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (c *Client) ListObjectsPage(bucket string, prefix *string, maxKeys *int, continuationToken *string) (*ObjectPage, error) {
	urlPath := fmt.Sprintf("%s/buckets/%s/objects", c.baseURL, url.PathEscape(bucket))

	params := url.Values{}
	if prefix != nil {
		params.Add("prefix", *prefix)
	}
	if maxKeys != nil {
		params.Add("max_keys", strconv.Itoa(*maxKeys))
	}
	if continuationToken != nil {
		params.Add("continuation_token", *continuationToken)
	}

	if len(params) > 0 {
		urlPath += "?" + params.Encode()
	}

	req, err := http.NewRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var result listObjectsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &ObjectPage{
		Objects:               result.Objects,
		NextContinuationToken: result.NextContinuationToken,
	}, nil
}

func (c *Client) ListObjects(bucket string, prefix *string, maxKeys *int) ([]ObjectMetadata, error) {
	objects := []ObjectMetadata{}
	var token *string

	for {
		page, err := c.ListObjectsPage(bucket, prefix, maxKeys, token)
		if err != nil {
			return nil, err
		}

		objects = append(objects, page.Objects...)

		if maxKeys != nil && len(objects) >= *maxKeys {
			return objects[:*maxKeys], nil
		}

		if page.NextContinuationToken == nil || *page.NextContinuationToken == "" {
			return objects, nil
		}

		token = page.NextContinuationToken
	}
}

func (c *Client) GetPublicURL(bucket, key string, expirationSecs *uint64, purpose *PublicUrlPurpose) (*PublicURLResponse, error) {
	urlPath := c.objectURL("public-url", bucket, key)

	params := url.Values{}
	if expirationSecs != nil {
		params.Add("expiration_secs", strconv.FormatUint(*expirationSecs, 10))
	}
	if purpose != nil {
		params.Add("purpose", string(*purpose))
	}

	if len(params) > 0 {
		urlPath += "?" + params.Encode()
	}

	req, err := http.NewRequest("GET", urlPath, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, &Error{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	var result PublicURLResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
