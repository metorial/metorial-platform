package gitlab

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitpush"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
)

// GitLab accepts any username with an OAuth or personal access token over git HTTP
// and Git LFS; "oauth2" is the documented one.
const tokenUsername = "oauth2"

var manifestAPIClient = &http.Client{Timeout: 10 * time.Minute}

// ManifestExportOptions drives a manifest export. UploadOptions.DeletePaths is ignored:
// deletes come from the manifest scope and the previous manifest.
type ManifestExportOptions struct {
	UploadOptions
	export.ManifestOptions

	// LFSThresholdBytes is the project's Git LFS threshold (zero: LFS off); files over
	// DefaultMaxFileBytes use LFS regardless.
	LFSThresholdBytes int64
	MaxLFSFileBytes   int64
	// ForceREST reads the remote tree through the REST tree API instead of git.
	ForceREST bool

	// GitURL overrides the project's http_url_to_repo; AllowHTTP permits plain-HTTP API
	// and git URLs. Both are for tests.
	GitURL    string
	AllowHTTP bool

	HTTPClient *http.Client
	GitClient  *http.Client
	Now        func() time.Time
	Sleep      func(ctx context.Context, d time.Duration) error
	Logf       func(format string, args ...any)
}

// ExportManifest reads the branch's tree with a blobless fetch (REST tree listing as
// the fallback) and writes through the REST commits API in adaptive batches, with
// Git LFS for large files and scope deletes.
func ExportManifest(ctx context.Context, opts ManifestExportOptions) (*export.Result, error) {
	upload := opts.UploadOptions.withDefaults()
	switch {
	case upload.Token == "":
		return nil, errors.New("GitLab token is required")
	case upload.ProjectID <= 0:
		return nil, export.NewError(export.CodeManifestInvalid, "project id is required")
	case strings.Trim(upload.TargetPath, "/") != "" && strings.Trim(upload.TargetPath, "/") != ".":
		return nil, export.NewError(export.CodeManifestInvalid, "manifest exports write to the repository root; target path %q is not supported", upload.TargetPath)
	}

	apiURL, err := url.Parse(strings.TrimSuffix(upload.GitlabAPIURL, "/"))
	if err != nil || apiURL.Host == "" || apiURL.User != nil || (apiURL.Scheme != "https" && !(opts.AllowHTTP && apiURL.Scheme == "http")) {
		return nil, export.NewError(export.CodeManifestInvalid, "GitLab API URL must be an HTTPS URL without credentials")
	}

	logf := opts.Logf
	if logf == nil {
		logf = log.Printf
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
	gitClient, gitRequests := gitpush.CountRequests(opts.GitClient)
	if opts.GitClient == nil {
		gitClient, gitRequests = gitpush.CountRequests(gitpush.HTTPClient)
	}

	api := &apiClient{http: httpClient, baseURL: apiURL, projectID: upload.ProjectID, token: upload.Token, now: now, sleep: sleep}

	gitURL := opts.GitURL
	if gitURL == "" {
		project, err := api.project(ctx)
		if err != nil {
			return nil, export.FromError(err, export.Progress{})
		}
		gitURL = sameHostGitURL(apiURL, project.HTTPURLToRepo, logf)
	}
	gitURL = strings.TrimSuffix(gitURL, "/")

	r := &remote{api: api, branch: upload.Branch, logf: logf}
	if !opts.ForceREST && gitURL != "" {
		r.git = gitpush.NewTracker(gitremote.FetchOptions{
			URL:        gitURL,
			Branch:     upload.Branch,
			AuthHeader: gitremote.BasicAuth(tokenUsername, upload.Token),
			HTTPClient: gitClient,
			AllowHTTP:  opts.AllowHTTP,
		})
		r.git.Logf = logf
	}
	options := r.seed(ctx, opts.ManifestOptions)

	var lfs commitbatch.LFSUploader
	if gitURL != "" {
		lfs = gitlfs.Uploader{
			Client: gitlfs.NewClient(gitURL+"/info/lfs", tokenUsername, upload.Token, gitClient),
			Ref:    "refs/heads/" + upload.Branch,
		}
	}

	return export.Sync(ctx, export.SyncInput{
		Options:           options,
		Writer:            &commitWriter{api: api, remote: r, branch: upload.Branch, limits: resolveLimits(opts.Tuning)},
		Remote:            r,
		LFS:               lfs,
		CommitMessage:     upload.CommitMessage,
		LFSThresholdBytes: gitpush.EffectiveLFSThreshold(opts.LFSThresholdBytes, DefaultMaxFileBytes),
		MaxFileBytes:      DefaultMaxFileBytes,
		MaxLFSFileBytes:   opts.MaxLFSFileBytes,
		ReadBlob:          r.ReadBlob,
		Requests:          func() uint32 { return api.requests.Load() + gitRequests() },
		Now:               now,
		Sleep:             sleep,
		Logf:              logf,
	})
}

// sameHostGitURL only trusts http_url_to_repo on the API's host: the token must not be
// sent anywhere else, whatever the API returns.
func sameHostGitURL(apiURL *url.URL, repoURL string, logf func(string, ...any)) string {
	parsed, err := url.Parse(repoURL)
	if err != nil || parsed.Host != apiURL.Host || parsed.Scheme != apiURL.Scheme || parsed.User != nil {
		logf("[gitlab] http_url_to_repo is not on the API host; using the REST tree API without Git LFS")
		return ""
	}
	parsed.RawQuery, parsed.Fragment = "", ""
	return parsed.String()
}

func sleepContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
