package bitbucket

import (
	"context"
	"errors"
	"fmt"
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

const cloudTokenUsername = "x-token-auth"

// ManifestTransport carries the options both Bitbucket flavours share. Manifest
// exports read the remote tree with a blobless fetch and write with packfile pushes;
// they never clone, check out or use the REST /src API.
type ManifestTransport struct {
	// LFSThresholdBytes is the project's Git LFS threshold (zero: LFS off); files over
	// gitpush.MaxFileBytes use LFS regardless.
	LFSThresholdBytes int64
	MaxLFSFileBytes   int64

	// GitURL overrides the repository URL derived from the request; AllowHTTP permits
	// a plain-HTTP GitURL. Both are for tests.
	GitURL    string
	AllowHTTP bool

	HTTPClient *http.Client
	Now        func() time.Time
	Sleep      func(ctx context.Context, d time.Duration) error
	Logf       func(format string, args ...any)
}

// CloudManifestExportOptions drives a manifest export. DeletePaths and
// ExplicitDeletesOnly are ignored: deletes come from the manifests.
type CloudManifestExportOptions struct {
	CloudUploadOptions
	export.ManifestOptions
	ManifestTransport
}

// DataCenterManifestExportOptions drives a manifest export. DeletePaths and
// ExplicitDeletesOnly are ignored: deletes come from the manifests.
type DataCenterManifestExportOptions struct {
	DataCenterUploadOptions
	export.ManifestOptions
	ManifestTransport
}

func ExportManifestToCloud(ctx context.Context, opts CloudManifestExportOptions) (*export.Result, error) {
	upload := opts.CloudUploadOptions.withDefaults()
	if upload.Workspace == "" || upload.Repo == "" {
		return nil, export.NewError(export.CodeManifestInvalid, "workspace and repo are required")
	}

	gitURL := opts.GitURL
	if gitURL == "" {
		baseURL, err := cleanHTTPSBaseURL(upload.WebURL, defaultCloudWebURL)
		if err != nil {
			return nil, err
		}
		gitURL = fmt.Sprintf("%s/%s/%s.git", baseURL, url.PathEscape(upload.Workspace), url.PathEscape(upload.Repo))
	}

	return exportManifest(ctx, manifestTarget{
		gitURL:        gitURL,
		username:      cloudTokenUsername,
		token:         upload.Token,
		branch:        upload.Branch,
		targetPath:    upload.TargetPath,
		commitMessage: upload.CommitMessage,
	}, opts.ManifestOptions, opts.ManifestTransport)
}

func ExportManifestToDataCenter(ctx context.Context, opts DataCenterManifestExportOptions) (*export.Result, error) {
	upload := opts.DataCenterUploadOptions.withDefaults()

	gitURL := opts.GitURL
	if gitURL == "" {
		if err := validateCloneURL(upload.CloneURL); err != nil {
			return nil, err
		}
		gitURL = strings.TrimSuffix(upload.CloneURL, "/")
	}

	username := upload.Username
	if username == "" {
		username = cloudTokenUsername
	}
	return exportManifest(ctx, manifestTarget{
		gitURL:        gitURL,
		username:      username,
		token:         upload.Token,
		branch:        upload.Branch,
		targetPath:    upload.TargetPath,
		commitMessage: upload.CommitMessage,
	}, opts.ManifestOptions, opts.ManifestTransport)
}

type manifestTarget struct {
	gitURL        string
	username      string
	token         string
	branch        string
	targetPath    string
	commitMessage string
}

func exportManifest(ctx context.Context, target manifestTarget, options export.ManifestOptions, transport ManifestTransport) (*export.Result, error) {
	if target.token == "" {
		return nil, errors.New("Bitbucket token is required")
	}
	if err := validateBranch(target.branch); err != nil {
		return nil, export.NewError(export.CodeManifestInvalid, "%v", err)
	}
	if normalized, err := normalizeRepoPath(target.targetPath, true); err != nil || normalized != "" {
		return nil, export.NewError(export.CodeManifestInvalid, "manifest exports write to the repository root; target path %q is not supported", target.targetPath)
	}

	client := transport.HTTPClient
	if client == nil {
		client = gitpush.HTTPClient
	}
	gitURL := strings.TrimSuffix(target.gitURL, "/")

	return gitpush.Export(ctx, gitpush.ExportOptions{
		Fetch: gitremote.FetchOptions{
			URL:        gitURL,
			Branch:     target.branch,
			AuthHeader: gitremote.BasicAuth(target.username, target.token),
			HTTPClient: client,
			AllowHTTP:  transport.AllowHTTP,
		},
		Options:           options,
		CommitMessage:     target.commitMessage,
		LFS:               lfsUploader(gitURL, target, client),
		LFSThresholdBytes: transport.LFSThresholdBytes,
		MaxLFSFileBytes:   transport.MaxLFSFileBytes,
		Now:               transport.Now,
		Sleep:             transport.Sleep,
		Logf:              transport.Logf,
	})
}

func lfsUploader(gitURL string, target manifestTarget, client *http.Client) commitbatch.LFSUploader {
	return gitlfs.Uploader{
		Client: gitlfs.NewClient(gitURL+"/info/lfs", target.username, target.token, client),
		Ref:    "refs/heads/" + target.branch,
	}
}
