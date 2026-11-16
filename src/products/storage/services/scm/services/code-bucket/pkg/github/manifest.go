package github

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
)

const manifestAPITimeout = 10 * time.Minute

var manifestAPIClient = &http.Client{Timeout: manifestAPITimeout}

// ManifestExportOptions drives a manifest export. UploadOptions.DeletePaths is ignored:
// deletes come from the manifest scope and the previous manifest.
type ManifestExportOptions struct {
	UploadOptions
	export.ManifestOptions

	// Fetcher reads the remote tree over git smart HTTP; nil uses the REST tree API.
	Fetcher gitremote.Fetcher
	// GitURL defaults to the LFS endpoint without /info/lfs.
	GitURL          string
	MaxLFSFileBytes int64
	// ForceREST skips createCommitOnBranch, e.g. for GitHub Enterprise Server versions
	// without it.
	ForceREST bool

	HTTPClient     *http.Client
	TransferClient *http.Client
	Now            func() time.Time
	Sleep          func(ctx context.Context, d time.Duration) error
}

func ExportManifest(ctx context.Context, opts ManifestExportOptions) (*export.Result, error) {
	upload := opts.UploadOptions.withDefaults()
	if upload.Token == "" {
		return nil, errors.New("a GitHub token is required")
	}
	if upload.Owner == "" || upload.Repo == "" {
		return nil, export.NewError(export.CodeManifestInvalid, "owner and repo are required")
	}
	if !isRootTarget(upload.TargetPath) {
		return nil, export.NewError(export.CodeManifestInvalid, "manifest exports write to the repository root; target path %q is not supported", upload.TargetPath)
	}

	tuning := resolveTuning(opts.Tuning)
	threshold := export.EffectiveLFSThreshold(opts.UploadOptions.LFSThresholdBytes, tuning.RESTMaxBlobBytes)
	maxLFS := upload.MaxFileBytes
	if opts.MaxLFSFileBytes > 0 {
		maxLFS = min(maxLFS, opts.MaxLFSFileBytes)
	}

	now := opts.Now
	if now == nil {
		now = time.Now
	}
	sleep := opts.Sleep
	if sleep == nil {
		sleep = sleepContext
	}
	httpClient := opts.HTTPClient
	if httpClient == nil {
		httpClient = manifestAPIClient
	}
	transfer := opts.TransferClient
	if transfer == nil {
		transfer = transferClient
	}

	api := &restClient{
		http:       httpClient,
		repoURL:    fmt.Sprintf("%s/repos/%s/%s", upload.BaseURL, upload.Owner, upload.Repo),
		graphqlURL: graphqlEndpoint(upload.BaseURL),
		token:      upload.Token,
		now:        now,
		sleep:      sleep,
	}

	writer := newCommitWriter(api, upload.Owner, upload.Repo, upload.Branch, writerConfig{
		GraphQLMaxFileBytes: tuning.GraphQLMaxFileBytes,
		BatchInitialBytes:   tuning.BatchInitialBytes,
		BatchMaxBytes:       tuning.BatchMaxBytes,
		ForceREST:           opts.ForceREST,
	})

	gitURL := opts.GitURL
	if gitURL == "" {
		gitURL = strings.TrimSuffix(upload.LFSEndpoint, "/info/lfs")
	}
	reader := &remoteReader{
		api:     api,
		fetcher: opts.Fetcher,
		fetch: gitremote.FetchOptions{
			URL:        gitURL,
			Branch:     upload.Branch,
			AuthHeader: gitremote.BasicAuth(gitlfs.DefaultUsername, upload.Token),
			HTTPClient: transfer,
		},
		include: manifestDirs(ctx, opts.Manifest),
		logf:    log.Printf,
	}

	return export.Sync(ctx, export.SyncInput{
		Options:           opts.ManifestOptions,
		Writer:            writer,
		Remote:            reader,
		LFS:               gitlfs.Uploader{Client: gitlfs.NewClient(upload.LFSEndpoint, gitlfs.DefaultUsername, upload.Token, transfer), Ref: "refs/heads/" + upload.Branch},
		CommitMessage:     upload.CommitMessage,
		LFSThresholdBytes: threshold,
		MaxFileBytes:      upload.MaxFileBytes,
		MaxLFSFileBytes:   maxLFS,
		ReadBlob:          api.readBlob,
		Requests:          api.requests.Load,
		Now:               now,
		Sleep:             sleep,
	})
}

func isRootTarget(target string) bool {
	switch strings.Trim(target, "/") {
	case "", ".":
		return true
	}
	return false
}

func resolveTuning(t export.Tuning) export.Tuning {
	if t.GraphQLMaxFileBytes <= 0 {
		t.GraphQLMaxFileBytes = DefaultGraphQLMaxFileBytes
	}
	if t.RESTMaxBlobBytes <= 0 {
		t.RESTMaxBlobBytes = DefaultRESTMaxBlobBytes
	}
	if t.BatchMaxBytes <= 0 {
		t.BatchMaxBytes = commitbatch.DefaultMaxBytes
	}
	if t.BatchInitialBytes <= 0 {
		t.BatchInitialBytes = commitbatch.DefaultInitialBytes
	}
	t.BatchInitialBytes = min(t.BatchInitialBytes, t.BatchMaxBytes)
	t.GraphQLMaxFileBytes = min(t.GraphQLMaxFileBytes, t.RESTMaxBlobBytes)
	return t
}

func (c *restClient) readBlob(ctx context.Context, sha string) ([]byte, error) {
	var blob githubBlobResponse
	if err := c.do(ctx, http.MethodGet, fmt.Sprintf("%s/git/blobs/%s", c.repoURL, sha), nil, &blob); err != nil {
		return nil, err
	}

	switch blob.Encoding {
	case "base64", "":
		return base64.StdEncoding.DecodeString(strings.NewReplacer("\n", "", "\r", "").Replace(blob.Content))
	case "utf-8":
		return []byte(blob.Content), nil
	default:
		return nil, fmt.Errorf("blob %s has unsupported encoding %q", sha, blob.Encoding)
	}
}
