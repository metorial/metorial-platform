// Command github-limits-probe measures GitHub's undocumented write limits against a
// scratch repository: the largest createCommitOnBranch mutation (one file, then many
// small files of the same total size), the largest REST createBlob, and mutation latency
// against size. Its results set the graphqlMaxFileBytes, restMaxBlobBytes and batch size
// ceiling tunables. It commits to the given branch, so never point it at a real repo.
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

const createCommitMutation = `mutation($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid } }
}`

type probe struct {
	http       *http.Client
	baseURL    string
	graphqlURL string
	token      string
	owner      string
	repo       string
	branch     string
}

type outcome struct {
	ok       bool
	status   int
	duration time.Duration
	detail   string
}

func (o outcome) String() string {
	if o.ok {
		return fmt.Sprintf("ok in %s", o.duration.Round(time.Millisecond))
	}
	return fmt.Sprintf("failed after %s (status %d): %s", o.duration.Round(time.Millisecond), o.status, o.detail)
}

func main() {
	var (
		token      = flag.String("token", os.Getenv("GITHUB_TOKEN"), "installation token for the scratch repository (default $GITHUB_TOKEN)")
		owner      = flag.String("owner", "", "scratch repository owner")
		repo       = flag.String("repo", "", "scratch repository name")
		branch     = flag.String("branch", "limits-probe", "existing branch to commit to")
		baseURL    = flag.String("base-url", "https://api.github.com", "REST API base URL (GHES: https://host/api/v3)")
		mode       = flag.String("mode", "all", "graphql-single, graphql-many, rest-blob, latency or all")
		maxBytes   = flag.Int64("max-bytes", 64<<20, "upper bound for the binary searches, in raw bytes")
		resolution = flag.Int64("resolution", 256<<10, "binary search resolution, in raw bytes")
		smallFile  = flag.Int64("small-file-bytes", 64<<10, "file size for the many-files search")
		timeout    = flag.Duration("timeout", 2*time.Minute, "per-request timeout")
	)
	flag.Parse()

	if *token == "" || *owner == "" || *repo == "" {
		flag.Usage()
		os.Exit(2)
	}

	base := strings.TrimSuffix(*baseURL, "/")
	graphqlURL := base + "/graphql"
	if strings.HasSuffix(base, "/api/v3") {
		graphqlURL = strings.TrimSuffix(base, "/v3") + "/graphql"
	}

	p := &probe{
		http:       &http.Client{Timeout: *timeout},
		baseURL:    base,
		graphqlURL: graphqlURL,
		token:      *token,
		owner:      *owner,
		repo:       *repo,
		branch:     *branch,
	}
	ctx := context.Background()

	run := func(name string) bool { return *mode == "all" || *mode == name }

	if run("graphql-single") {
		limit := search(*resolution, *maxBytes, func(size int64) outcome {
			return p.mutation(ctx, map[string][]byte{"probe/single.bin": random(size)})
		})
		fmt.Printf("createCommitOnBranch, one file: largest accepted %s\n", human(limit))
	}

	if run("graphql-many") {
		limit := search(*resolution, *maxBytes, func(total int64) outcome {
			files := map[string][]byte{}
			for i := int64(0); i*(*smallFile) < total; i++ {
				files[fmt.Sprintf("probe/many/f%05d.bin", i)] = random(min(*smallFile, total-i*(*smallFile)))
			}
			return p.mutation(ctx, files)
		})
		fmt.Printf("createCommitOnBranch, %s files: largest accepted total %s\n", human(*smallFile), human(limit))
	}

	if run("rest-blob") {
		limit := search(*resolution, *maxBytes, func(size int64) outcome {
			return p.createBlob(ctx, random(size))
		})
		fmt.Printf("REST createBlob: largest accepted %s\n", human(limit))
	}

	if run("latency") {
		fmt.Println("createCommitOnBranch latency, one file:")
		for size := int64(1 << 20); size <= *maxBytes; size *= 2 {
			result := p.mutation(ctx, map[string][]byte{"probe/latency.bin": random(size)})
			fmt.Printf("  %8s  %s\n", human(size), result)
			if !result.ok {
				break
			}
		}
	}
}

// search returns the largest size in (0, hi] that try accepts, to within resolution,
// assuming acceptance is monotonic in size.
func search(resolution, hi int64, try func(size int64) outcome) int64 {
	var lo int64
	for hi-lo > resolution {
		mid := lo + (hi-lo)/2
		result := try(mid)
		log.Printf("%s: %s", human(mid), result)
		if result.ok {
			lo = mid
		} else {
			hi = mid
		}
	}
	return lo
}

func random(size int64) []byte {
	content := make([]byte, size)
	if _, err := rand.Read(content); err != nil {
		log.Fatal(err)
	}
	return content
}

func human(n int64) string {
	switch {
	case n >= 1<<20:
		return fmt.Sprintf("%.2f MiB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.1f KiB", float64(n)/(1<<10))
	}
	return fmt.Sprintf("%d B", n)
}

func (p *probe) head(ctx context.Context) (string, error) {
	var branch struct {
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	status, body, err := p.request(ctx, http.MethodGet, fmt.Sprintf("%s/repos/%s/%s/branches/%s", p.baseURL, p.owner, p.repo, p.branch), nil)
	if err != nil {
		return "", err
	}
	if status != http.StatusOK {
		return "", fmt.Errorf("read branch %s: status %d: %s", p.branch, status, truncate(body))
	}
	if err := json.Unmarshal(body, &branch); err != nil {
		return "", err
	}
	return branch.Commit.SHA, nil
}

func (p *probe) mutation(ctx context.Context, files map[string][]byte) outcome {
	head, err := p.head(ctx)
	if err != nil {
		log.Fatal(err)
	}

	additions := make([]map[string]string, 0, len(files))
	for path, content := range files {
		additions = append(additions, map[string]string{"path": path, "contents": base64.StdEncoding.EncodeToString(content)})
	}
	payload, err := json.Marshal(map[string]any{
		"query": createCommitMutation,
		"variables": map[string]any{"input": map[string]any{
			"branch":          map[string]string{"repositoryNameWithOwner": p.owner + "/" + p.repo, "branchName": p.branch},
			"message":         map[string]string{"headline": "limits probe"},
			"expectedHeadOid": head,
			"fileChanges":     map[string]any{"additions": additions},
		}},
	})
	if err != nil {
		log.Fatal(err)
	}

	started := time.Now()
	status, body, err := p.request(ctx, http.MethodPost, p.graphqlURL, payload)
	result := outcome{status: status, duration: time.Since(started)}
	switch {
	case err != nil:
		result.detail = err.Error()
	case status != http.StatusOK:
		result.detail = truncate(body)
	default:
		var resp struct {
			Errors []struct {
				Type    string `json:"type"`
				Message string `json:"message"`
			} `json:"errors"`
		}
		_ = json.Unmarshal(body, &resp)
		if len(resp.Errors) > 0 {
			result.detail = resp.Errors[0].Type + ": " + resp.Errors[0].Message
		} else {
			result.ok = true
		}
	}
	return result
}

func (p *probe) createBlob(ctx context.Context, content []byte) outcome {
	payload, err := json.Marshal(map[string]string{"content": base64.StdEncoding.EncodeToString(content), "encoding": "base64"})
	if err != nil {
		log.Fatal(err)
	}

	started := time.Now()
	status, body, err := p.request(ctx, http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/git/blobs", p.baseURL, p.owner, p.repo), payload)
	result := outcome{status: status, duration: time.Since(started), ok: err == nil && status == http.StatusCreated}
	if err != nil {
		result.detail = err.Error()
	} else if !result.ok {
		result.detail = truncate(body)
	}
	return result
}

func (p *probe) request(ctx context.Context, method, url string, payload []byte) (int, []byte, error) {
	var body io.Reader
	if payload != nil {
		body = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := p.http.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return 0, nil, fmt.Errorf("timed out: %w", err)
		}
		return 0, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return resp.StatusCode, respBody, err
}

func truncate(body []byte) string {
	if len(body) > 300 {
		return string(body[:300]) + "…"
	}
	return string(body)
}
