package service

import (
	"context"
	"fmt"
	"time"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"github.com/metorial/metorial/services/code-bucket/pkg/bitbucket"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
	"github.com/metorial/metorial/services/code-bucket/pkg/github"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlab"
	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"

	"github.com/golang-jwt/jwt/v5"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

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
	iter, err := github.DownloadRepo(req.Owner, req.Repo, req.Path, req.Ref, req.Token)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to download GitHub repository: %v", err)
	}
	defer iter.Close()

	if err := rs.fsm.ImportZip(ctx, req.NewBucketId, iter); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to import zip: %v", err)
	}

	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) CreateBucketFromZip(ctx context.Context, req *rpc.CreateBucketFromZipRequest) (*rpc.CreateBucketResponse, error) {
	iter, err := zipImporter.DownloadZip(req.ZipUrl, req.Path, req.Headers)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to download zip: %v", err)
	}
	defer iter.Close()

	if err := rs.fsm.ImportZip(ctx, req.NewBucketId, iter); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to import zip: %v", err)
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
	err := rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, req.Prefix, 0, func(batch []fs.FileContentItem) error {
		for _, file := range batch {
			pbFiles = append(pbFiles, fileContentItemToRPC(file))
		}
		return nil
	})
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
	if err := github.UploadToRepoIter(req.Owner, req.Repo, req.Path, req.Branch, req.CommitMessage, req.Token, func(yield func(github.FileToUpload) error) error {
		return rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, "", 0, func(batch []fs.FileContentItem) error {
			for _, file := range batch {
				if err := yield(github.FileToUpload{
					Path:    file.Info.Path,
					Content: file.Content,
				}); err != nil {
					return err
				}
			}
			return nil
		})
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upload to GitHub: %v", err)
	}

	return &rpc.ExportBucketToGithubResponse{}, nil
}

func (rs *RcpService) CreateBucketFromGitlab(ctx context.Context, req *rpc.CreateBucketFromGitlabRequest) (*rpc.CreateBucketResponse, error) {
	iter, err := gitlab.DownloadRepo(req.ProjectId, req.Path, req.Ref, req.Token, req.GitlabApiUrl)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to download GitLab repository: %v", err)
	}
	defer iter.Close()

	if err := rs.fsm.ImportZip(ctx, req.NewBucketId, iter); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to import zip: %v", err)
	}

	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) ExportBucketToGitlab(ctx context.Context, req *rpc.ExportBucketToGitlabRequest) (*rpc.ExportBucketToGitlabResponse, error) {
	if err := gitlab.UploadToRepoIter(req.ProjectId, req.Path, req.Branch, req.CommitMessage, req.Token, req.GitlabApiUrl, func(yield func(gitlab.FileToUpload) error) error {
		return rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, "", 0, func(batch []fs.FileContentItem) error {
			for _, file := range batch {
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
		return nil, status.Errorf(codes.Internal, "failed to upload to GitLab: %v", err)
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
		return nil, status.Errorf(codes.Internal, "failed to prepare Bitbucket Cloud repository: %v", err)
	}
	defer cleanup()

	if err := rs.clearBucket(ctx, req.NewBucketId); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to clear Bitbucket Cloud bucket: %v", err)
	}
	if err := iter(func(file bitbucket.FileToUpload) error {
		return rs.fsm.PutBucketFile(ctx, req.NewBucketId, file.Path, file.Content, "application/octet-stream")
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to import Bitbucket Cloud repository: %v", err)
	}
	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) ExportBucketToBitbucketCloud(ctx context.Context, req *rpc.ExportBucketToBitbucketCloudRequest) (*rpc.ExportBucketToBitbucketResponse, error) {
	err := bitbucket.UploadToCloudRepo(
		req.Workspace,
		req.Repo,
		req.Path,
		req.Branch,
		req.CommitMessage,
		req.Token,
		req.BitbucketApiUrl,
		req.BitbucketWebUrl,
		func(yield func(bitbucket.FileToUpload) error) error {
			return rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, "", 0, func(batch []fs.FileContentItem) error {
				for _, file := range batch {
					if err := yield(bitbucket.FileToUpload{Path: file.Info.Path, Content: file.Content}); err != nil {
						return err
					}
				}
				return nil
			})
		},
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upload to Bitbucket Cloud: %v", err)
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
		return nil, status.Errorf(codes.Internal, "failed to prepare Bitbucket Data Center repository: %v", err)
	}
	defer cleanup()
	if err := rs.clearBucket(ctx, req.NewBucketId); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to clear Bitbucket Data Center bucket: %v", err)
	}
	if err := iter(func(file bitbucket.FileToUpload) error {
		return rs.fsm.PutBucketFile(ctx, req.NewBucketId, file.Path, file.Content, "application/octet-stream")
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to import Bitbucket Data Center repository: %v", err)
	}
	return &rpc.CreateBucketResponse{}, nil
}

func (rs *RcpService) ExportBucketToBitbucketDataCenter(ctx context.Context, req *rpc.ExportBucketToBitbucketDataCenterRequest) (*rpc.ExportBucketToBitbucketResponse, error) {
	err := bitbucket.UploadToDataCenterRepo(
		ctx,
		req.CloneUrl,
		req.Path,
		req.Branch,
		req.CommitMessage,
		req.Username,
		req.Token,
		func(yield func(bitbucket.FileToUpload) error) error {
			return rs.fsm.WalkBucketFileContentBatches(ctx, req.BucketId, "", 0, func(batch []fs.FileContentItem) error {
				for _, file := range batch {
					if err := yield(bitbucket.FileToUpload{Path: file.Info.Path, Content: file.Content}); err != nil {
						return err
					}
				}
				return nil
			})
		},
	)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upload to Bitbucket Data Center: %v", err)
	}
	return &rpc.ExportBucketToBitbucketResponse{}, nil
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

	if err := rs.fsm.DeleteBucketPath(ctx, req.BucketId, req.Path); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete path: %v", err)
	}

	return &rpc.DeleteBucketPathResponse{}, nil
}
