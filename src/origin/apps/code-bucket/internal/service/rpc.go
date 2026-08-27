package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"github.com/metorial/metorial/services/code-bucket/pkg/bitbucket"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
	"github.com/metorial/metorial/services/code-bucket/pkg/github"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlab"
	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const maxInlineBucketContentBytes int64 = 25 << 20

var errBucketTooLargeForInlineContent = errors.New("bucket content exceeds the inline response limit")

type inlineContentBudget struct {
	limit int64
	used  int64
}

func (b *inlineContentBudget) take(size int64) error {
	b.used += size
	if b.used > b.limit {
		return errBucketTooLargeForInlineContent
	}

	return nil
}

var (
	providerHTTPStatusPattern = regexp.MustCompile(`(?i)\bstatus(?: code)?[\s:=()]+(\d{3})\b`)
	providerJSONSecretPattern = regexp.MustCompile(`(?i)("(?:authorization|private-token|access[_-]?token|refresh[_-]?token)"\s*:\s*")[^"]*(")`)
	providerSecretPattern     = regexp.MustCompile(`(?i)(authorization|private-token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^,\s}"']+`)
	providerBearerPattern     = regexp.MustCompile(`(?i)bearer\s+[a-z0-9._~+/-]+=*`)
)

func providerHTTPStatusToGRPCCode(message string) codes.Code {
	if matches := providerHTTPStatusPattern.FindStringSubmatch(message); len(matches) == 2 {
		if httpStatus, parseErr := strconv.Atoi(matches[1]); parseErr == nil {
			switch {
			case httpStatus == 400 || httpStatus == 422:
				return codes.InvalidArgument
			case httpStatus == 401:
				return codes.Unauthenticated
			case httpStatus == 403 && isProtectedBranchError(message):
				return codes.FailedPrecondition
			case httpStatus == 403:
				return codes.PermissionDenied
			case httpStatus == 404:
				return codes.NotFound
			case httpStatus == 408 || httpStatus == 504:
				return codes.DeadlineExceeded
			case httpStatus == 409:
				return codes.Aborted
			case httpStatus == 429:
				return codes.ResourceExhausted
			case httpStatus >= 500:
				return codes.Unavailable
			}
		}
	}

	return codes.Internal
}

func providerErrorCode(err error, message string) codes.Code {
	if errors.Is(err, filelimit.ErrFileTooLarge) {
		return codes.FailedPrecondition
	}

	return providerHTTPStatusToGRPCCode(message)
}

func providerExportError(provider string, err error) error {
	message := err.Error()
	return status.Errorf(
		providerErrorCode(err, message),
		"failed to upload to %s: %s",
		provider,
		sanitizeProviderError(message),
	)
}

func providerImportError(provider string, err error) error {
	message := err.Error()
	return status.Errorf(
		providerErrorCode(err, message),
		"failed to download %s repository: %s",
		provider,
		sanitizeProviderError(message),
	)
}

func isProtectedBranchError(message string) bool {
	normalized := strings.ToLower(message)
	return strings.Contains(normalized, "protected branch") ||
		strings.Contains(normalized, "protected ref") ||
		strings.Contains(normalized, "not allowed to push into this branch") ||
		strings.Contains(normalized, "branch restriction") ||
		strings.Contains(normalized, "pre-receive hook declined")
}

func sanitizeProviderError(message string) string {
	const maxLength = 1000
	message = providerJSONSecretPattern.ReplaceAllString(message, `$1[redacted]$2`)
	message = providerSecretPattern.ReplaceAllString(message, `$1=[redacted]`)
	message = providerBearerPattern.ReplaceAllString(message, "Bearer [redacted]")
	if len(message) > maxLength {
		return message[:maxLength] + "…"
	}
	return message
}

type RcpService struct {
	rpc.UnimplementedCodeBucketServer
	fsm       *fs.FileSystemManager
	jwtSecret []byte
}

func newRcpService(service *Service) *RcpService {
	rs := &RcpService{
		fsm:       service.fsm,
		jwtSecret: service.jwtSecret,
	}

	return rs
}

func (rs *RcpService) CloneBucket(ctx context.Context, req *rpc.CloneBucketRequest) (*rpc.CreateBucketResponse, error) {
	if err := rs.fsm.Clone(ctx, req.SourceBucketId, req.NewBucketId); err != nil {
		return nil, err
	}

	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) CreateBucketFromGithub(ctx context.Context, req *rpc.CreateBucketFromGithubRequest) (*rpc.CreateBucketResponse, error) {
	iter, err := github.DownloadRepo(ctx, github.DownloadOptions{
		Owner: req.Owner,
		Repo:  req.Repo,
		Path:  req.Path,
		Ref:   req.Ref,
		Token: req.Token,
	})
	if err != nil {
		return nil, providerImportError("GitHub", err)
	}
	defer iter.Close()

	if err := rs.fsm.ImportZip(ctx, req.NewBucketId, iter); err != nil {
		return nil, providerImportError("GitHub", err)
	}

	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) CreateBucketFromZip(ctx context.Context, req *rpc.CreateBucketFromZipRequest) (*rpc.CreateBucketResponse, error) {
	iter, err := zipImporter.DownloadZip(req.ZipUrl, req.Path, req.Headers)
	if err != nil {
		return nil, providerImportError("zip", err)
	}
	defer iter.Close()

	if err := rs.fsm.ImportZip(ctx, req.NewBucketId, iter); err != nil {
		return nil, providerImportError("zip", err)
	}

	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) CreateBucketFromContents(ctx context.Context, req *rpc.CreateBucketFromContentsRequest) (*rpc.CreateBucketResponse, error) {
	contents := make([]*fs.FileContentsBase, 0, len(req.Contents))
	for _, c := range req.Contents {
		contents = append(contents, &fs.FileContentsBase{
			Path:    c.Path,
			Content: c.Content,
		})
	}

	if err := rs.fsm.ImportContents(ctx, req.NewBucketId, contents); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to import contents: %v", err)
	}

	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) GetBucketToken(ctx context.Context, req *rpc.GetBucketTokenRequest) (*rpc.GetBucketTokenResponse, error) {
	expiresIn := req.ExpiresInSeconds
	if expiresIn == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "expires_in_seconds must be greater than 0")
	}

	claims := &Claims{
		BucketID:   req.BucketId,
		IsReadOnly: req.IsReadOnly,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiresIn) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Audience:  jwt.ClaimStrings{fmt.Sprintf("https://code-bucket.service.metorial.com/bucket/%s", req.BucketId)},
			Issuer:    "https://code-bucket.service.metorial.com",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(rs.jwtSecret)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create token: %v", err)
	}

	return &rpc.GetBucketTokenResponse{Token: tokenString}, nil
}

func (rs *RcpService) GetBucketFile(ctx context.Context, req *rpc.GetBucketFileRequest) (*rpc.GetBucketFileResponse, error) {
	info, content, err := rs.fsm.GetBucketFile(ctx, req.BucketId, req.Path)
	if err != nil {
		if err.Error() == "file not found" {
			return nil, status.Errorf(codes.NotFound, "file not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get file: %v", err)
	}

	return &rpc.GetBucketFileResponse{
		Content: &rpc.FileContent{
			Content: content.Content,
			FileInfo: &rpc.FileInfo{
				Path:        info.Path,
				Size:        info.Size,
				ContentType: info.ContentType,
				ModifiedAt:  info.ModifiedAt.Unix(),
			},
		},
	}, nil
}

func (rs *RcpService) GetBucketFiles(ctx context.Context, req *rpc.GetBucketFilesRequest) (*rpc.GetBucketFilesResponse, error) {
	files, err := rs.fsm.GetBucketFiles(ctx, req.BucketId, req.Prefix)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get files: %v", err)
	}

	var pbFiles []*rpc.FileInfo
	for _, file := range files {
		pbFiles = append(pbFiles, &rpc.FileInfo{
			Path:        file.Path,
			Size:        file.Size,
			ContentType: file.ContentType,
			ModifiedAt:  file.ModifiedAt.Unix(),
		})
	}

	return &rpc.GetBucketFilesResponse{Files: pbFiles}, nil
}

func (rs *RcpService) GetBucketFilesAsZip(ctx context.Context, req *rpc.GetBucketFilesAsZipRequest) (*rpc.GetBucketFilesAsZipResponse, error) {
	url, expiresAt, err := rs.fsm.GetBucketFilesAsZip(ctx, req.BucketId, req.Prefix)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get files as zip: %v", err)
	}

	return &rpc.GetBucketFilesAsZipResponse{
		DownloadUrl: *url,
		ExpiresAt:   expiresAt.Unix(),
	}, nil
}

func (rs *RcpService) ExportBucketFilesAsZipToUpload(ctx context.Context, req *rpc.ExportBucketFilesAsZipToUploadRequest) (*rpc.ExportBucketFilesAsZipToUploadResponse, error) {
	if req.BucketId == "" {
		return nil, status.Error(codes.InvalidArgument, "bucket_id is required")
	}

	hasURL := req.UploadUrl != ""
	hasObject := req.UploadBucket != "" && req.UploadKey != ""

	if hasURL == hasObject {
		return nil, status.Error(
			codes.InvalidArgument,
			"exactly one of upload_url or upload_bucket/upload_key is required",
		)
	}

	result, err := rs.fsm.ExportBucketFilesAsZipToUpload(ctx, req.BucketId, req.Prefix, fs.ZipUploadDestination{
		URL:         req.UploadUrl,
		Bucket:      req.UploadBucket,
		Key:         req.UploadKey,
		ContentType: req.ContentType,
	})
	if err != nil {
		return nil, err
	}

	return &rpc.ExportBucketFilesAsZipToUploadResponse{
		ByteSize:  result.ByteSize,
		Sha256:    result.Sha256,
		FileCount: result.FileCount,
	}, nil
}

func (rs *RcpService) GetBucketFilesAsZipStream(req *rpc.GetBucketFilesAsZipRequest, stream rpc.CodeBucket_GetBucketFilesAsZipStreamServer) error {
	err := rs.fsm.StreamBucketFilesAsZip(stream.Context(), req.BucketId, req.Prefix, func(chunk []byte) error {
		return stream.Send(&rpc.GetBucketFilesAsZipChunk{
			Content: chunk,
		})
	})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to stream files as zip: %v", err)
	}

	return nil
}

func (rs *RcpService) GetBucketFilesWithContent(ctx context.Context, req *rpc.GetBucketFilesRequest) (*rpc.GetBucketFilesWithContentResponse, error) {
	var pbFiles []*rpc.FileContent
	budget := inlineContentBudget{limit: maxInlineBucketContentBytes}

	err := rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, req.Prefix, 0, func(batch []fs.FileContentItem) error {
		for _, file := range batch {
			if err := budget.take(int64(len(file.Content))); err != nil {
				return err
			}

			pbFiles = append(pbFiles, fileContentItemToRPC(file))
		}
		return nil
	})
	if errors.Is(err, errBucketTooLargeForInlineContent) {
		log.Printf(
			"[code-bucket] inline content refused bucket=%s prefix=%q limit=%d",
			req.BucketId, req.Prefix, maxInlineBucketContentBytes,
		)
		return nil, status.Errorf(
			codes.FailedPrecondition,
			"bucket %s holds more than %s of content; use GetBucketFilesWithContentStream instead",
			req.BucketId, filelimit.HumanBytes(maxInlineBucketContentBytes),
		)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get files with content: %v", err)
	}

	return &rpc.GetBucketFilesWithContentResponse{Files: pbFiles}, nil
}

func (rs *RcpService) GetBucketFilesWithContentStream(req *rpc.GetBucketFilesRequest, stream rpc.CodeBucket_GetBucketFilesWithContentStreamServer) error {
	err := rs.fsm.WalkBucketFileContentBatches(stream.Context(), req.BucketId, req.Prefix, 0, func(batch []fs.FileContentItem) error {
		files := make([]*rpc.FileContent, 0, len(batch))
		for _, file := range batch {
			files = append(files, fileContentItemToRPC(file))
		}

		return stream.Send(&rpc.GetBucketFilesWithContentChunk{
			Files: files,
		})
	})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to stream files with content: %v", err)
	}

	return nil
}

func releaseBatchItem(batch []fs.FileContentItem, i int) fs.FileContentItem {
	item := batch[i]
	batch[i].Content = nil
	return item
}

func fileContentItemToRPC(file fs.FileContentItem) *rpc.FileContent {
	return &rpc.FileContent{
		FileInfo: &rpc.FileInfo{
			Path:        file.Info.Path,
			Size:        file.Info.Size,
			ContentType: file.Info.ContentType,
			ModifiedAt:  file.Info.ModifiedAt.Unix(),
		},
		Content: file.Content,
	}
}

func (rs *RcpService) ExportBucketToGithub(ctx context.Context, req *rpc.ExportBucketToGithubRequest) (*rpc.ExportBucketToGithubResponse, error) {
	opts := github.UploadOptions{
		Owner:         req.Owner,
		Repo:          req.Repo,
		TargetPath:    req.Path,
		Branch:        req.Branch,
		CommitMessage: req.CommitMessage,
		Token:         req.Token,
		DeletePaths:   req.DeletePaths,
	}

	if err := github.UploadToRepoIter(ctx, opts, func(yield func(github.FileToUpload) error) error {
		return rs.fsm.WalkBucketFiles(ctx, req.BucketId, "", func(file fs.FileInfo) error {
			path := file.Path

			return yield(github.FileToUpload{
				Path: path,
				Size: file.Size,
				Open: func() (io.ReadCloser, error) {
					body, _, err := rs.fsm.OpenBucketFile(ctx, req.BucketId, path)
					return body, err
				},
			})
		})
	}); err != nil {
		return nil, providerExportError("GitHub", err)
	}

	return &rpc.ExportBucketToGithubResponse{}, nil
}

func (rs *RcpService) CreateBucketFromGitlab(ctx context.Context, req *rpc.CreateBucketFromGitlabRequest) (*rpc.CreateBucketResponse, error) {
	iter, err := gitlab.DownloadRepo(req.ProjectId, req.Path, req.Ref, req.Token, req.GitlabApiUrl)
	if err != nil {
		return nil, providerImportError("GitLab", err)
	}
	defer iter.Close()

	if err := rs.fsm.ImportZip(ctx, req.NewBucketId, iter); err != nil {
		return nil, providerImportError("GitLab", err)
	}

	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) ExportBucketToGitlab(ctx context.Context, req *rpc.ExportBucketToGitlabRequest) (*rpc.ExportBucketToGitlabResponse, error) {
	if err := rs.ensureBucketFitsBufferedExport(ctx, "GitLab", req.BucketId); err != nil {
		return nil, providerExportError("GitLab", err)
	}

	gitlabOpts := gitlab.UploadOptions{
		ProjectID:     req.ProjectId,
		TargetPath:    req.Path,
		Branch:        req.Branch,
		CommitMessage: req.CommitMessage,
		Token:         req.Token,
		GitlabAPIURL:  req.GitlabApiUrl,
		DeletePaths:   req.DeletePaths,
	}

	if err := gitlab.UploadToRepoIter(gitlabOpts, func(yield func(gitlab.FileToUpload) error) error {
		return rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, "", 0, func(batch []fs.FileContentItem) error {
			for i := range batch {
				file := releaseBatchItem(batch, i)

				if err := yield(gitlab.FileToUpload{
					Path:    file.Info.Path,
					Content: file.Content,
				}); err != nil {
					return err
				}
			}
			return nil
		})
	}); err != nil {
		return nil, providerExportError("GitLab", err)
	}

	return &rpc.ExportBucketToGitlabResponse{}, nil
}

func (rs *RcpService) CreateBucketFromBitbucketCloud(ctx context.Context, req *rpc.CreateBucketFromBitbucketCloudRequest) (*rpc.CreateBucketResponse, error) {
	iter, cleanup, err := bitbucket.PrepareCloudRepo(
		ctx,
		req.Workspace,
		req.Repo,
		req.Path,
		req.Ref,
		req.Token,
		req.BitbucketWebUrl,
	)
	if err != nil {
		return nil, providerImportError("Bitbucket Cloud", err)
	}
	defer cleanup()

	if err := rs.clearBucket(ctx, req.NewBucketId); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to clear Bitbucket Cloud bucket: %v", err)
	}
	if err := iter(func(file bitbucket.FileToUpload) error {
		return rs.fsm.PutBucketFile(ctx, req.NewBucketId, file.Path, file.Content, "application/octet-stream")
	}); err != nil {
		return nil, providerImportError("Bitbucket Cloud", err)
	}
	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) ExportBucketToBitbucketCloud(ctx context.Context, req *rpc.ExportBucketToBitbucketCloudRequest) (*rpc.ExportBucketToBitbucketResponse, error) {
	if err := rs.ensureBucketFitsBufferedExport(ctx, "Bitbucket Cloud", req.BucketId); err != nil {
		return nil, providerExportError("Bitbucket Cloud", err)
	}

	err := bitbucket.UploadToCloudRepo(
		bitbucket.CloudUploadOptions{
			Workspace:           req.Workspace,
			Repo:                req.Repo,
			TargetPath:          req.Path,
			Branch:              req.Branch,
			CommitMessage:       req.CommitMessage,
			Token:               req.Token,
			APIURL:              req.BitbucketApiUrl,
			WebURL:              req.BitbucketWebUrl,
			DeletePaths:         req.DeletePaths,
			ExplicitDeletesOnly: req.ExplicitDeletesOnly,
		},
		func(yield func(bitbucket.FileToUpload) error) error {
			return rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, "", 0, func(batch []fs.FileContentItem) error {
				for i := range batch {
					file := releaseBatchItem(batch, i)

					if err := yield(bitbucket.FileToUpload{Path: file.Info.Path, Content: file.Content}); err != nil {
						return err
					}
				}
				return nil
			})
		},
	)
	if err != nil {
		return nil, providerExportError("Bitbucket Cloud", err)
	}
	return &rpc.ExportBucketToBitbucketResponse{}, nil
}

func (rs *RcpService) CreateBucketFromBitbucketDataCenter(ctx context.Context, req *rpc.CreateBucketFromBitbucketDataCenterRequest) (*rpc.CreateBucketResponse, error) {
	iter, cleanup, err := bitbucket.PrepareDataCenterRepo(
		ctx,
		req.CloneUrl,
		req.Path,
		req.Ref,
		req.Username,
		req.Token,
	)
	if err != nil {
		return nil, providerImportError("Bitbucket Data Center", err)
	}
	defer cleanup()
	if err := rs.clearBucket(ctx, req.NewBucketId); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to clear Bitbucket Data Center bucket: %v", err)
	}
	if err := iter(func(file bitbucket.FileToUpload) error {
		return rs.fsm.PutBucketFile(ctx, req.NewBucketId, file.Path, file.Content, "application/octet-stream")
	}); err != nil {
		return nil, providerImportError("Bitbucket Data Center", err)
	}
	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) ExportBucketToBitbucketDataCenter(ctx context.Context, req *rpc.ExportBucketToBitbucketDataCenterRequest) (*rpc.ExportBucketToBitbucketResponse, error) {
	if err := rs.ensureBucketFitsBufferedExport(ctx, "Bitbucket Data Center", req.BucketId); err != nil {
		return nil, providerExportError("Bitbucket Data Center", err)
	}

	err := bitbucket.UploadToDataCenterRepo(
		ctx,
		bitbucket.DataCenterUploadOptions{
			CloneURL:            req.CloneUrl,
			TargetPath:          req.Path,
			Branch:              req.Branch,
			CommitMessage:       req.CommitMessage,
			Username:            req.Username,
			Token:               req.Token,
			DeletePaths:         req.DeletePaths,
			ExplicitDeletesOnly: req.ExplicitDeletesOnly,
		},
		func(yield func(bitbucket.FileToUpload) error) error {
			return rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, "", 0, func(batch []fs.FileContentItem) error {
				for i := range batch {
					file := releaseBatchItem(batch, i)

					if err := yield(bitbucket.FileToUpload{Path: file.Info.Path, Content: file.Content}); err != nil {
						return err
					}
				}
				return nil
			})
		},
	)
	if err != nil {
		return nil, providerExportError("Bitbucket Data Center", err)
	}
	return &rpc.ExportBucketToBitbucketResponse{}, nil
}

func (rs *RcpService) ensureBucketFitsBufferedExport(
	ctx context.Context,
	provider, bucketID string,
) error {
	return rs.fsm.WalkBucketFiles(ctx, bucketID, "", func(file fs.FileInfo) error {
		if file.Size <= filelimit.MaxBufferedFileBytes {
			return nil
		}

		log.Printf(
			"[scm export] rejected provider=%s bucket=%s path=%s size=%d limit=%d",
			provider, bucketID, file.Path, file.Size, filelimit.MaxBufferedFileBytes,
		)
		return filelimit.FileTooLargeError(
			provider+" export", file.Path, file.Size, filelimit.MaxBufferedFileBytes,
		)
	})
}

func (rs *RcpService) clearBucket(ctx context.Context, bucketID string) error {
	paths := make([]string, 0)
	if err := rs.fsm.WalkBucketFiles(ctx, bucketID, "", func(file fs.FileInfo) error {
		paths = append(paths, file.Path)
		return nil
	}); err != nil {
		return err
	}
	for _, filePath := range paths {
		if err := rs.fsm.DeleteBucketFile(ctx, bucketID, filePath); err != nil {
			return err
		}
	}
	return nil
}

func (rs *RcpService) SetBucketFiles(ctx context.Context, req *rpc.SetBucketFilesRequest) (*rpc.SetBucketFilesResponse, error) {
	if req.BucketId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "bucket_id is required")
	}

	if len(req.Files) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "at least one file is required")
	}

	contents := make([]*fs.FileContentsBase, 0, len(req.Files))
	for _, f := range req.Files {
		if f.Path == "" {
			return nil, status.Errorf(codes.InvalidArgument, "file path cannot be empty")
		}
		contents = append(contents, &fs.FileContentsBase{
			Path:    f.Path,
			Content: f.Content,
		})
	}

	if err := rs.fsm.SetBucketFiles(ctx, req.BucketId, contents); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to set files: %v", err)
	}

	return &rpc.SetBucketFilesResponse{}, nil
}

func (rs *RcpService) CopyBucketFiles(ctx context.Context, req *rpc.CopyBucketFilesRequest) (*rpc.CopyBucketFilesResponse, error) {
	if req.BucketId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "bucket_id is required")
	}

	if len(req.Files) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "at least one file is required")
	}

	sources := make([]fs.CopyFileSource, 0, len(req.Files))
	for _, f := range req.Files {
		if f.Path == "" {
			return nil, status.Errorf(codes.InvalidArgument, "file path cannot be empty")
		}
		if f.SourceBucket == "" || f.SourceKey == "" {
			return nil, status.Errorf(
				codes.InvalidArgument,
				"source_bucket and source_key are required for %s", f.Path,
			)
		}
		sources = append(sources, fs.CopyFileSource{
			Path:         f.Path,
			SourceBucket: f.SourceBucket,
			SourceKey:    f.SourceKey,
		})
	}

	copiedPaths, err := rs.fsm.CopyBucketFiles(ctx, req.BucketId, sources)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to copy files: %v", err)
	}

	return &rpc.CopyBucketFilesResponse{CopiedPaths: copiedPaths}, nil
}

func (rs *RcpService) SetBucketFile(ctx context.Context, req *rpc.SetBucketFileRequest) (*rpc.SetBucketFileResponse, error) {
	if req.BucketId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "bucket_id is required")
	}

	if req.Path == "" {
		return nil, status.Errorf(codes.InvalidArgument, "path is required")
	}

	if err := rs.fsm.PutBucketFile(ctx, req.BucketId, req.Path, req.Content, ""); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to set file: %v", err)
	}

	return &rpc.SetBucketFileResponse{}, nil
}

func (rs *RcpService) DeleteBucketFile(ctx context.Context, req *rpc.DeleteBucketFileRequest) (*rpc.DeleteBucketFileResponse, error) {
	if req.BucketId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "bucket_id is required")
	}

	if req.Path == "" {
		return nil, status.Errorf(codes.InvalidArgument, "path is required")
	}

	if err := rs.fsm.DeleteBucketFile(ctx, req.BucketId, req.Path); err != nil {
		if err.Error() == "file not found" {
			return nil, status.Errorf(codes.NotFound, "file not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to delete file: %v", err)
	}

	return &rpc.DeleteBucketFileResponse{}, nil
}

func (rs *RcpService) DeleteBucketPath(ctx context.Context, req *rpc.DeleteBucketPathRequest) (*rpc.DeleteBucketPathResponse, error) {
	if req.BucketId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "bucket_id is required")
	}

	if req.Path == "" {
		return nil, status.Errorf(codes.InvalidArgument, "path is required")
	}

	deletedPaths, err := rs.fsm.DeleteBucketPath(ctx, req.BucketId, req.Path)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete path: %v", err)
	}

	return &rpc.DeleteBucketPathResponse{DeletedPaths: deletedPaths}, nil
}

func (rs *RcpService) PruneBucketPath(ctx context.Context, req *rpc.PruneBucketPathRequest) (*rpc.PruneBucketPathResponse, error) {
	if req.BucketId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "bucket_id is required")
	}

	if len(req.KeepPaths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "keep_paths must not be empty")
	}

	deletedPaths, err := rs.fsm.PruneBucketPath(ctx, req.BucketId, req.Prefix, req.KeepPaths, req.ExcludePrefixes)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to prune path: %v", err)
	}

	return &rpc.PruneBucketPathResponse{DeletedPaths: deletedPaths}, nil
}
