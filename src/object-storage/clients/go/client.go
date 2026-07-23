package objectstorage

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

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

type createBucketRequest struct {
	Name string `json:"name"`
}

type listBucketsResponse struct {
	Buckets []Bucket `json:"buckets"`
}

type listObjectsResponse struct {
	Objects []ObjectMetadata `json:"objects"`
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
	urlPath := fmt.Sprintf("%s/buckets/%s/objects/%s", c.baseURL, bucket, key)
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
	urlPath := fmt.Sprintf("%s/buckets/%s/objects/%s", c.baseURL, bucket, key)
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

	size, _ := strconv.ParseUint(resp.Header.Get("Content-Length"), 10, 64)
	contentType := resp.Header.Get("Content-Type")
	var ct *string
	if contentType != "" {
		ct = &contentType
	}

	// Extract custom metadata from x-object-meta-* headers
	metadata := make(map[string]string)
	for headerName, headerValues := range resp.Header {
		if len(headerValues) > 0 {
			const prefix = "X-Object-Meta-"
			if len(headerName) > len(prefix) && headerName[:len(prefix)] == prefix {
				metaKey := headerName[len(prefix):]
				metadata[metaKey] = headerValues[0]
			}
		}
	}

	return &ObjectData{
		Metadata: ObjectMetadata{
			Key:          key,
			Size:         size,
			ContentType:  ct,
			ETag:         resp.Header.Get("ETag"),
			LastModified: resp.Header.Get("Last-Modified"),
			Metadata:     metadata,
		},
		Data: data,
	}, nil
}

func (c *Client) HeadObject(bucket, key string) (*ObjectMetadata, error) {
	urlPath := fmt.Sprintf("%s/buckets/%s/objects/%s", c.baseURL, bucket, key)
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

	size, _ := strconv.ParseUint(resp.Header.Get("Content-Length"), 10, 64)
	contentType := resp.Header.Get("Content-Type")
	var ct *string
	if contentType != "" {
		ct = &contentType
	}

	// Extract custom metadata from x-object-meta-* headers
	metadata := make(map[string]string)
	for headerName, headerValues := range resp.Header {
		if len(headerValues) > 0 {
			const prefix = "X-Object-Meta-"
			if len(headerName) > len(prefix) && headerName[:len(prefix)] == prefix {
				metaKey := headerName[len(prefix):]
				metadata[metaKey] = headerValues[0]
			}
		}
	}

	return &ObjectMetadata{
		Key:          key,
		Size:         size,
		ContentType:  ct,
		ETag:         resp.Header.Get("ETag"),
		LastModified: resp.Header.Get("Last-Modified"),
		Metadata:     metadata,
	}, nil
}

func (c *Client) GetObjectInfo(bucket, key string) (*ObjectMetadata, error) {
	urlPath := fmt.Sprintf("%s/buckets/%s/object-info/%s", c.baseURL, bucket, key)
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
	urlPath := fmt.Sprintf("%s/buckets/%s/objects/%s", c.baseURL, bucket, key)
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

func (c *Client) ListObjects(bucket string, prefix *string, maxKeys *int) ([]ObjectMetadata, error) {
	urlPath := fmt.Sprintf("%s/buckets/%s/objects", c.baseURL, bucket)

	params := url.Values{}
	if prefix != nil {
		params.Add("prefix", *prefix)
	}
	if maxKeys != nil {
		params.Add("max_keys", strconv.Itoa(*maxKeys))
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

	return result.Objects, nil
}

func (c *Client) GetPublicURL(bucket, key string, expirationSecs *uint64, purpose *PublicUrlPurpose) (*PublicURLResponse, error) {
	urlPath := fmt.Sprintf("%s/buckets/%s/public-url/%s", c.baseURL, bucket, key)

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
