package ssrfProtection

import "fmt"

var allowedPorts = map[int]bool{
	80:  true, // HTTP
	443: true, // HTTPS
}

func validatePort(portStr string) error {
	if portStr == "" {
		return nil
	}

	port := 0
	_, err := fmt.Sscanf(portStr, "%d", &port)
	if err != nil {
		return fmt.Errorf("invalid port format: %s", portStr)
	}

	if port < 1 || port > 65535 {
		return fmt.Errorf("port out of range: %d", port)
	}

	if !allowedPorts[port] {
		return fmt.Errorf("port %d is blocked", port)
	}

	return nil
}
