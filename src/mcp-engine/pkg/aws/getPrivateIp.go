package aws

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// fetchWithToken tries to fetch from EC2 IMDS using optional IMDSv2 token
func fetchWithToken(url string, token string) ([]byte, error) {
	client := &http.Client{Timeout: 2 * time.Second}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	if token != "" {
		req.Header.Add("X-aws-ec2-metadata-token", token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("status code %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// getEC2PrivateIP fetches the private IP from EC2 instance metadata
func getEC2PrivateIP() (string, error) {
	// Try to get IMDSv2 token
	client := &http.Client{Timeout: 2 * time.Second}
	tokenReq, err := http.NewRequest("PUT", "http://169.254.169.254/latest/api/token", nil)
	if err != nil {
		return "", err
	}

	tokenReq.Header.Add("X-aws-ec2-metadata-token-ttl-seconds", "21600")
	resp, err := client.Do(tokenReq)

	var token string
	if err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		t, err := io.ReadAll(resp.Body)
		if err == nil {
			token = string(t)
		}
	}

	data, err := fetchWithToken("http://169.254.169.254/latest/meta-data/local-ipv4", token)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// getECSTaskPrivateIP fetches the private IP from ECS task metadata
func getECSTaskPrivateIP() (string, error) {
	metaURL := os.Getenv("ECS_CONTAINER_METADATA_URI_V4")
	if metaURL == "" {
		return "", errors.New("ECS_CONTAINER_METADATA_URI_V4 not set")
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(metaURL + "/task")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("status code %d", resp.StatusCode)
	}

	var taskMeta struct {
		Containers []struct {
			Networks []struct {
				IPv4Addresses []string `json:"IPv4Addresses"`
			} `json:"Networks"`
		} `json:"Containers"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if err := json.Unmarshal(body, &taskMeta); err != nil {
		return "", err
	}

	// Return the first private IP found
	for _, c := range taskMeta.Containers {
		for _, n := range c.Networks {
			if len(n.IPv4Addresses) > 0 {
				return n.IPv4Addresses[0], nil
			}
		}
	}

	return "", errors.New("no private IP found in ECS metadata")
}

func GetPrivateIP() (string, error) {
	if ip, err := getECSTaskPrivateIP(); err == nil {
		return ip, nil
	}

	return getEC2PrivateIP()
}
