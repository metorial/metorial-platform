package main

import (
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	address := os.Getenv("CODE_BUCKET_HTTP_ADDRESS")
	if address == "" {
		address = ":52091"
	}
	url := "http://127.0.0.1" + address + "/files"
	client := http.Client{Timeout: 10 * time.Second}
	response, err := client.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "code-bucket is not reachable at %s: %v\n", url, err)
		os.Exit(1)
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusInternalServerError {
		fmt.Fprintf(os.Stderr, "code-bucket returned %s from %s\n", response.Status, url)
		os.Exit(1)
	}

	fmt.Printf("code-bucket is reachable at %s (%s)\n", url, response.Status)
}
