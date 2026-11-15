// Package healthcheck lets distroless images (no shell, no wget) run container health
// checks as "<binary> healthcheck [url]".
package healthcheck

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// RunIfRequested exits the process when invoked as "<binary> healthcheck [url]".
func RunIfRequested(defaultURL string) {
	if len(os.Args) < 2 || os.Args[1] != "healthcheck" {
		return
	}
	target := defaultURL
	if len(os.Args) > 2 {
		target = os.Args[2]
	}
	if err := Check(target); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	os.Exit(0)
}

func Check(target string) error {
	client := &http.Client{Timeout: 3 * time.Second, Transport: &http.Transport{Proxy: nil}}
	response, err := client.Get(target)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("%s returned %d", target, response.StatusCode)
	}
	return nil
}

// LocalURL turns a listen address like ":8080" into http://127.0.0.1:8080/healthz.
func LocalURL(listenAddr string) string {
	host, port, err := net.SplitHostPort(listenAddr)
	if err != nil {
		return "http://127.0.0.1" + listenAddr + "/healthz"
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(strings.Trim(host, "[]"), port) + "/healthz"
}
