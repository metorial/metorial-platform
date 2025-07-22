package request

import (
	"bytes"
	"fmt"
	"io"
	"net/http"

	ssrfProtection "github.com/metorial/metorial/modules/ssrf-protection"
)

var client = ssrfProtection.CreateSecureHTTPClient()

func SendRequest(url, method string, body []byte, headers map[string]string) (*http.Response, error) {
	req, err := http.NewRequest(method, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	return resp, nil
}

func GetResponseBody(resp *http.Response) (string, error) {
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}
	// return body, nil

	if len(body) == 0 {
		return "", nil
	}

	shortenedBody := body
	if len(body) > 10_000 {
		shortenedBody = body[:10_000]
	}

	return string(shortenedBody), nil
}

func GetResponseHeaders(resp *http.Response) map[string]string {
	headers := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			headers[key] = values[0] // Use the first value for simplicity
		}
	}
	return headers
}
