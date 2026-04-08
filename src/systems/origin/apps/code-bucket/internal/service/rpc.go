package service

import (
	"context"
	"fmt"
	"time"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
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

func (rs *RcpService) GetBucketFilesWithContent(ctx context.Context, req *rpc.GetBucketFilesRequest) (*rpc.GetBucketFilesWithContentResponse, error) {
	files, err := rs.fsm.GetBucketFiles(ctx, req.BucketId, req.Prefix)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get files: %v", err)
	}

	var pbFiles []*rpc.FileContent
	for _, file := range files {
		_, content, err := rs.fsm.GetBucketFile(ctx, req.BucketId, file.Path)
		if err != nil {
			continue
		}

		pbFiles = append(pbFiles, &rpc.FileContent{
			FileInfo: &rpc.FileInfo{
				Path:        file.Path,
				Size:        file.Size,
				ContentType: file.ContentType,
				ModifiedAt:  file.ModifiedAt.Unix(),
			},
			Content: content.Content,
		})
	}

	return &rpc.GetBucketFilesWithContentResponse{Files: pbFiles}, nil
}

func (rs *RcpService) ExportBucketToGithub(ctx context.Context, req *rpc.ExportBucketToGithubRequest) (*rpc.ExportBucketToGithubResponse, error) {
	files, err := rs.fsm.GetBucketFiles(ctx, req.BucketId, "")
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get bucket files: %v", err)
	}

	filesToUpload := make([]github.FileToUpload, 0, len(files))
	for _, file := range files {
		_, content, err := rs.fsm.GetBucketFile(ctx, req.BucketId, file.Path)
		if err != nil {
			continue
		}

		filesToUpload = append(filesToUpload, github.FileToUpload{
			Path:    file.Path,
			Content: content.Content,
		})
	}

	if err := github.UploadToRepo(req.Owner, req.Repo, req.Path, req.Token, filesToUpload); err != nil {
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
	files, err := rs.fsm.GetBucketFiles(ctx, req.BucketId, "")
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get bucket files: %v", err)
	}

	filesToUpload := make([]gitlab.FileToUpload, 0, len(files))
	for _, file := range files {
		_, content, err := rs.fsm.GetBucketFile(ctx, req.BucketId, file.Path)
		if err != nil {
			continue
		}

		filesToUpload = append(filesToUpload, gitlab.FileToUpload{
			Path:    file.Path,
			Content: content.Content,
		})
	}

	if err := gitlab.UploadToRepo(req.ProjectId, req.Path, req.Token, req.GitlabApiUrl, filesToUpload); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upload to GitLab: %v", err)
	}

	return &rpc.ExportBucketToGitlabResponse{}, nil
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
