package main

// `-provider gitlab` probes the GitLab commits API instead: the largest
// POST /projects/:id/repository/commits body with one file and with many small files,
// latency against size, and the rate-limit headers GitLab returns. Its results set the
// GitLab batch tunables (BatchInitialBytes, BatchMaxBytes). main.go stays GitHub-only;
// this file takes over before main runs when the flag is present.

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

var _ = flag.String("provider", "github", "github or gitlab")

func init() {
	for i, arg := range os.Args[1:] {
		value, ok := strings.CutPrefix(strings.TrimLeft(arg, "-"), "provider")
		switch {
		case !ok || !strings.HasPrefix(arg, "-"):
			continue
		case value == "" && i+2 < len(os.Args):
			value = os.Args[i+2]
		default:
			value = strings.TrimPrefix(value, "=")
		}
		if value == "gitlab" {
			os.Exit(runGitLabProbe(os.Args[1:]))
		}
		return
	}
}

type gitlabProbe struct {
	http      *http.Client
	apiURL    string
	projectID int64
	token     string
	branch    string
	attempt   atomic.Int64
}

func runGitLabProbe(args []string) int {
	flags := flag.NewFlagSet("github-limits-probe -provider gitlab", flag.ExitOnError)
	var (
		_          = flags.String("provider", "gitlab", "github (default, see main.go) or gitlab")
		token      = flags.String("token", os.Getenv("GITLAB_TOKEN"), "token with api scope for the scratch project (default $GITLAB_TOKEN)")
		projectID  = flags.Int64("project", 0, "scratch project id")
		branch     = flags.String("branch", "limits-probe", "existing branch to commit to")
		apiURL     = flags.String("api-url", "https://gitlab.com/api/v4", "API base URL (self-managed: https://host/api/v4)")
		mode       = flags.String("mode", "all", "commit-single, commit-many, latency or all")
		maxBytes   = flags.Int64("max-bytes", 128<<20, "upper bound for the binary searches, in raw bytes")
		resolution = flags.Int64("resolution", 256<<10, "binary search resolution, in raw bytes")
		smallFile  = flags.Int64("small-file-bytes", 64<<10, "file size for the many-files search")
		timeout    = flags.Duration("timeout", 5*time.Minute, "per-request timeout")
	)
	_ = flags.Parse(args)

	if *token == "" || *projectID <= 0 {
		flags.Usage()
		return 2
	}

	p := &gitlabProbe{
		http:      &http.Client{Timeout: *timeout},
		apiURL:    strings.TrimSuffix(*apiURL, "/"),
		projectID: *projectID,
		token:     *token,
		branch:    *branch,
	}
	ctx := context.Background()
	run := func(name string) bool { return *mode == "all" || *mode == name }

	if run("commit-single") {
		limit := search(*resolution, *maxBytes, func(size int64) outcome {
			return p.commit(ctx, map[string][]byte{"single.bin": random(size)})
		})
		fmt.Printf("repository/commits, one file: largest accepted %s raw (%s base64)\n", human(limit), human(limit*4/3))
	}

	if run("commit-many") {
		limit := search(*resolution, *maxBytes, func(total int64) outcome {
			files := map[string][]byte{}
			for i := int64(0); i*(*smallFile) < total; i++ {
				files[fmt.Sprintf("many/f%05d.bin", i)] = random(min(*smallFile, total-i*(*smallFile)))
			}
			return p.commit(ctx, files)
		})
		fmt.Printf("repository/commits, %s files: largest accepted total %s raw\n", human(*smallFile), human(limit))
	}

	if run("latency") {
		fmt.Println("repository/commits latency, one file:")
		for size := int64(1 << 20); size <= *maxBytes; size *= 2 {
			result := p.commit(ctx, map[string][]byte{"latency.bin": random(size)})
			fmt.Printf("  %8s  %s\n", human(size), result)
			if !result.ok {
				break
			}
		}
	}
	return 0
}

// commit creates every file under a fresh directory, so attempts never conflict.
func (p *gitlabProbe) commit(ctx context.Context, files map[string][]byte) outcome {
	dir := fmt.Sprintf("probe/%d-%d", time.Now().Unix(), p.attempt.Add(1))
	actions := make([]map[string]string, 0, len(files))
	for path, content := range files {
		actions = append(actions, map[string]string{
			"action":    "create",
			"file_path": dir + "/" + path,
			"content":   base64.StdEncoding.EncodeToString(content),
			"encoding":  "base64",
		})
	}
	payload, err := json.Marshal(map[string]any{"branch": p.branch, "commit_message": "limits probe", "actions": actions})
	if err != nil {
		log.Fatal(err)
	}

	endpoint := fmt.Sprintf("%s/projects/%s/repository/commits", p.apiURL, url.PathEscape(fmt.Sprint(p.projectID)))
	started := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(payload)))
	if err != nil {
		log.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.http.Do(req)
	result := outcome{duration: time.Since(started)}
	if err != nil {
		result.detail = err.Error()
		return result
	}
	defer resp.Body.Close()

	result.status = resp.StatusCode
	result.ok = resp.StatusCode == http.StatusCreated
	if !result.ok {
		var body [300]byte
		n, _ := resp.Body.Read(body[:])
		result.detail = string(body[:n])
	}
	if remaining := resp.Header.Get("RateLimit-Remaining"); remaining != "" {
		log.Printf("rate limit: remaining %s of %s, reset %s, retry-after %q", remaining, resp.Header.Get("RateLimit-Limit"), resp.Header.Get("RateLimit-Reset"), resp.Header.Get("Retry-After"))
	}
	return result
}
