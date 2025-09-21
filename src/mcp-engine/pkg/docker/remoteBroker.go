package docker

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/metorial/metorial/mcp-engine/pkg/rendezvous"
)

type ServiceInstance struct {
	InstanceID string    `json:"instanceId"`
	IP         string    `json:"ip"`
	LastSeen   time.Time `json:"lastSeen"`
}

type ServiceListResponse struct {
	Services []ServiceInstance `json:"services"`
}

type remoteBroker struct {
	mutex sync.Mutex

	brokerAddress string
	serviceName   string
	listToken     string

	instances []string
}

var Broker = &remoteBroker{
	instances: []string{},
}

func (b *remoteBroker) FetchInstances() error {
	if b.brokerAddress == "" {
		return fmt.Errorf("broker address not set")
	}

	client := &http.Client{Transport: &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}}

	// Create a new GET request
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/v1/%s/list", b.brokerAddress, b.serviceName), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Add the Authorization header with the bearer token
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", b.listToken))

	// Send the request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Check for a successful response status code
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	// Unmarshal the JSON response into a Go struct
	var listResponse ServiceListResponse
	if err := json.Unmarshal(body, &listResponse); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Extract IPs from the service instances
	var ips []string
	for _, instance := range listResponse.Services {
		ips = append(ips, instance.IP)
	}

	b.instances = ips

	return nil
}

func (b *remoteBroker) GetRemoteHost(key, address, serviceName, listToken string) string {
	if b.brokerAddress == "" {
		b.mutex.Lock()
		defer b.mutex.Unlock()

		if b.brokerAddress == "" {
			fmt.Printf("Setting up remote broker with address %s, service %s\n", address, serviceName)

			b.brokerAddress = address
			b.serviceName = serviceName
			b.listToken = listToken

			// Start the update routine
			go b.updateRoutine()

			// Initial fetch
			if err := b.FetchInstances(); err != nil {
				fmt.Printf("Failed to fetch instances from broker: %v\n", err)
			}
		}
	}

	return rendezvous.PickElementConsistently(key, b.instances)
}

func (b *remoteBroker) updateRoutine() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if err := b.FetchInstances(); err != nil {
			fmt.Printf("Failed to fetch instances from broker: %v\n", err)
		}
	}
}
