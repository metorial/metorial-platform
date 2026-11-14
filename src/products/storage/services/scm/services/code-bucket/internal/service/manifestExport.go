package service

import (
	"context"
	"strings"
	"time"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"github.com/metorial/metorial/services/code-bucket/pkg/bitbucket"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/github"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlab"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

const (
	maxSliceSeconds      = 3600
	remoteStateKeyPrefix = "remote-state/"
)

type manifestStorage interface {
	manifest.Storage
	AllowBucket(bucket string) bool
}

type openedManifestExport struct {
	options export.ManifestOptions
	close   func()
}

func (rs *RcpService) openManifestExport(ctx context.Context, src *rpc.ManifestSource) (*openedManifestExport, error) {
	if rs.manifestStorage == nil {
		return nil, export.NewError(export.CodeManifestInvalid, "manifest sources are not configured on this exporter")
	}

	if prefix := src.RemoteStateKeyPrefix; prefix != "" && (!strings.HasPrefix(prefix, remoteStateKeyPrefix) || !strings.HasSuffix(prefix, "/")) {
		return nil, export.NewError(export.CodeManifestInvalid, "remote_state_key_prefix must start with %q and end with \"/\"", remoteStateKeyPrefix)
	}

	openOptions := manifest.Options{AllowBucket: rs.manifestStorage.AllowBucket}

	current, err := manifest.Open(ctx, rs.manifestStorage, manifest.Ref{Bucket: src.Bucket, Key: src.Key, SHA256: src.Sha256}, openOptions)
	if err != nil {
		return nil, export.FromError(err, export.Progress{})
	}

	var previous *manifest.Manifest
	if src.PreviousKey != "" || src.PreviousSha256 != "" {
		previous, err = manifest.Open(ctx, rs.manifestStorage, manifest.Ref{Bucket: src.PreviousBucket, Key: src.PreviousKey, SHA256: src.PreviousSha256}, openOptions)
		if err != nil {
			current.Close()
			return nil, export.FromError(err, export.Progress{})
		}
	}

	sliceSeconds := min(src.SliceSeconds, maxSliceSeconds)
	slice := export.DefaultSlice
	if sliceSeconds > 0 {
		slice = time.Duration(sliceSeconds) * time.Second
	}

	options := export.ManifestOptions{
		Manifest: current,
		Previous: previous,
		Source:   current.Source(rs.manifestStorage),
		Guard: export.Guard{
			MaxUnexpectedDeletes:     src.MaxUnexpectedDeletes,
			MaxUnexpectedDeleteRatio: src.MaxUnexpectedDeleteRatio,
			AllowMassDelete:          src.AllowMassDelete,
		},
		WriteBudget:          src.WriteBudget,
		Deadline:             time.Now().Add(slice),
		RemoteState:          remoteStateFromRPC(src.RemoteState),
		RemoteStateKeyPrefix: src.RemoteStateKeyPrefix,
		Listings:             rs.listings,
	}
	if tuning := src.Tuning; tuning != nil {
		options.Tuning = export.Tuning{
			GraphQLMaxFileBytes: int64(tuning.GraphqlMaxFileBytes),
			RESTMaxBlobBytes:    int64(tuning.RestMaxBlobBytes),
			BatchInitialBytes:   int64(tuning.BatchInitialBytes),
			BatchMaxBytes:       int64(tuning.BatchMaxBytes),
		}
	}

	return &openedManifestExport{
		options: options,
		close: func() {
			current.Close()
			if previous != nil {
				previous.Close()
			}
		},
	}, nil
}

func remoteStateFromRPC(state *rpc.RemoteStateCache) *export.RemoteState {
	if state == nil || state.CommitSha == "" {
		return nil
	}

	return &export.RemoteState{
		CommitSHA:     state.CommitSha,
		TreeSHA:       state.TreeSha,
		ListingBucket: state.ListingBucket,
		ListingKey:    state.ListingKey,
		EntryCount:    state.EntryCount,
	}
}

func remoteStateToRPC(state *export.RemoteState) *rpc.RemoteStateCache {
	if state == nil {
		return nil
	}

	return &rpc.RemoteStateCache{
		CommitSha:     state.CommitSHA,
		TreeSha:       state.TreeSHA,
		ListingBucket: state.ListingBucket,
		ListingKey:    state.ListingKey,
		EntryCount:    state.EntryCount,
	}
}

func exportStatsToRPC(stats export.Stats) *rpc.ExportStats {
	return &rpc.ExportStats{
		FilesTotal:          stats.FilesTotal,
		FilesUploaded:       stats.FilesUploaded,
		FilesSkipped:        stats.FilesSkipped,
		BlobsCreated:        stats.BlobsCreated,
		BlobsReused:         stats.BlobsReused,
		LfsUploaded:         stats.LFSUploaded,
		BytesUploaded:       stats.BytesUploaded,
		Deleted:             stats.Deleted,
		UnexpectedDeletes:   stats.UnexpectedDeletes,
		GithubRequests:      stats.GithubRequests,
		RateLimitWaitMs:     stats.RateLimitWaitMs,
		CommitsCreated:      stats.CommitsCreated,
		BatchSizeReductions: stats.BatchSizeReductions,
	}
}

func retryAfterUnix(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.Unix()
}

// manifestExportError returns structured export errors as their gRPC status and runs
// everything else through the legacy provider error mapping.
func manifestExportError(provider string, err error) error {
	if exportErr, ok := export.As(err); ok {
		return exportErr.GRPCStatus().Err()
	}
	return providerExportError(provider, err)
}

func runManifestExport(
	ctx context.Context,
	rs *RcpService,
	provider string,
	src *rpc.ManifestSource,
	run func(export.ManifestOptions) (*export.Result, error),
) (*export.Result, error) {
	opened, err := rs.openManifestExport(ctx, src)
	if err != nil {
		return nil, manifestExportError(provider, err)
	}
	defer opened.close()

	result, err := run(opened.options)
	if err != nil {
		return nil, manifestExportError(provider, err)
	}
	return result, nil
}

func (rs *RcpService) exportManifestToGithub(ctx context.Context, req *rpc.ExportBucketToGithubRequest, upload github.UploadOptions) (*rpc.ExportBucketToGithubResponse, error) {
	result, err := runManifestExport(ctx, rs, "GitHub", req.Manifest, func(options export.ManifestOptions) (*export.Result, error) {
		return github.ExportManifest(ctx, github.ManifestExportOptions{UploadOptions: upload, ManifestOptions: options, Fetcher: gitremote.Client{}})
	})
	if err != nil {
		return nil, err
	}

	return &rpc.ExportBucketToGithubResponse{
		Stats:          exportStatsToRPC(result.Stats),
		CommitsCreated: result.CommitsCreated,
		Partial:        result.Partial,
		NewRemoteState: remoteStateToRPC(result.NewRemoteState),
		RetryAfterUnix: retryAfterUnix(result.RetryAfter),
		StartHeadSha:   result.Lineage.StartHeadSHA,
		LastCommitSha:  result.Lineage.LastCommitSHA,
		ForeignCommits: result.Lineage.ForeignCommits,
		WriteRequests:  result.WriteRequests,
	}, nil
}

func (rs *RcpService) exportManifestToGitlab(ctx context.Context, req *rpc.ExportBucketToGitlabRequest, upload gitlab.UploadOptions) (*rpc.ExportBucketToGitlabResponse, error) {
	result, err := runManifestExport(ctx, rs, "GitLab", req.Manifest, func(options export.ManifestOptions) (*export.Result, error) {
		return gitlab.ExportManifest(ctx, gitlab.ManifestExportOptions{
			UploadOptions:     upload,
			ManifestOptions:   options,
			LFSThresholdBytes: req.GetLfsThresholdBytes(),
		})
	})
	if err != nil {
		return nil, err
	}

	return &rpc.ExportBucketToGitlabResponse{
		Stats:          exportStatsToRPC(result.Stats),
		CommitsCreated: result.CommitsCreated,
		Partial:        result.Partial,
		NewRemoteState: remoteStateToRPC(result.NewRemoteState),
		RetryAfterUnix: retryAfterUnix(result.RetryAfter),
		StartHeadSha:   result.Lineage.StartHeadSHA,
		LastCommitSha:  result.Lineage.LastCommitSHA,
		ForeignCommits: result.Lineage.ForeignCommits,
		WriteRequests:  result.WriteRequests,
	}, nil
}

func bitbucketManifestResponse(result *export.Result) *rpc.ExportBucketToBitbucketResponse {
	return &rpc.ExportBucketToBitbucketResponse{
		Stats:          exportStatsToRPC(result.Stats),
		CommitsCreated: result.CommitsCreated,
		Partial:        result.Partial,
		NewRemoteState: remoteStateToRPC(result.NewRemoteState),
		RetryAfterUnix: retryAfterUnix(result.RetryAfter),
		StartHeadSha:   result.Lineage.StartHeadSHA,
		LastCommitSha:  result.Lineage.LastCommitSHA,
		ForeignCommits: result.Lineage.ForeignCommits,
		WriteRequests:  result.WriteRequests,
	}
}

func (rs *RcpService) exportManifestToBitbucketCloud(ctx context.Context, req *rpc.ExportBucketToBitbucketCloudRequest, upload bitbucket.CloudUploadOptions) (*rpc.ExportBucketToBitbucketResponse, error) {
	result, err := runManifestExport(ctx, rs, "Bitbucket Cloud", req.Manifest, func(options export.ManifestOptions) (*export.Result, error) {
		return bitbucket.ExportManifestToCloud(ctx, bitbucket.CloudManifestExportOptions{
			CloudUploadOptions: upload,
			ManifestOptions:    options,
			ManifestTransport:  bitbucket.ManifestTransport{LFSThresholdBytes: req.GetLfsThresholdBytes()},
		})
	})
	if err != nil {
		return nil, err
	}
	return bitbucketManifestResponse(result), nil
}

func (rs *RcpService) exportManifestToBitbucketDataCenter(ctx context.Context, req *rpc.ExportBucketToBitbucketDataCenterRequest, upload bitbucket.DataCenterUploadOptions) (*rpc.ExportBucketToBitbucketResponse, error) {
	result, err := runManifestExport(ctx, rs, "Bitbucket Data Center", req.Manifest, func(options export.ManifestOptions) (*export.Result, error) {
		return bitbucket.ExportManifestToDataCenter(ctx, bitbucket.DataCenterManifestExportOptions{
			DataCenterUploadOptions: upload,
			ManifestOptions:         options,
			ManifestTransport:       bitbucket.ManifestTransport{LFSThresholdBytes: req.GetLfsThresholdBytes()},
		})
	})
	if err != nil {
		return nil, err
	}
	return bitbucketManifestResponse(result), nil
}
