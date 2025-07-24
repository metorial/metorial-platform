package ssrfProtection

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

var allowedSchemes = map[string]bool{
	"http":  true,
	"https": true,
}

func ValidateURL(rawURL string) error {
	uri, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL format: %w", err)
	}

	if !allowedSchemes[strings.ToLower(uri.Scheme)] {
		return fmt.Errorf("disallowed URL scheme: %s", uri.Scheme)
	}

	if uri.Hostname() == "" {
		return fmt.Errorf("URL must contain a hostname")
	}

	hostname := uri.Hostname()
	if strings.Contains(hostname, "@") || strings.Contains(hostname, "%") {
		return fmt.Errorf("suspicious characters in hostname")
	}

	ips, err := net.LookupIP(hostname)
	if err != nil {
		return fmt.Errorf("failed to resolve hostname %s: %w", hostname, err)
	}

	for _, ip := range ips {
		err := validateIP(ip)
		if err != nil {
			return fmt.Errorf("invalid IP %s for hostname %s: %w", ip.String(), hostname, err)
		}
	}

	port := uri.Port()
	if port != "" {
		err := validatePort(port)
		if err != nil {
			return err
		}
	} else {
		switch strings.ToLower(uri.Scheme) {
		case "http":
			err := validatePort("80")
			if err != nil {
				return err
			}
		case "https":
			err := validatePort("443")
			if err != nil {
				return err
			}
		}
	}

	return nil
}
