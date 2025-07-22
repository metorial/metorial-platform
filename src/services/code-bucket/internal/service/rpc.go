package service

import (
	"context"
	"time"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"

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

func (rs *RcpService) CloneBucket(ctx context.Context, req *rpc.CloneBucketRequest) (*rpc.CloneBucketResponse, error) {
	files, err := rs.fsm.GetBucketFiles(ctx, req.SourceBucketId, "")
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "source bucket not found: %v", err)
	}

	// Copy all files to new bucket
	for _, file := range files {
		content, contentType, err := rs.fsm.GetBucketFile(ctx, req.SourceBucketId, file.Path)
		if err != nil {
			continue
		}

		rs.fsm.PutBucketFile(ctx, req.NewBucketId, file.Path, content, contentType)
	}

	return &rpc.CloneBucketResponse{}, nil
}

func (rs *RcpService) GetBucketToken(ctx context.Context, req *rpc.GetBucketTokenRequest) (*rpc.GetBucketTokenResponse, error) {
	expiresIn := req.ExpiresInSeconds
	if expiresIn == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "expires_in_seconds must be greater than 0")
	}

	claims := &Claims{
		BucketID: req.BucketId,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiresIn) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
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
	content, contentType, err := rs.fsm.GetBucketFile(ctx, req.BucketId, req.Path)
	if err != nil {
		if err.Error() == "file not found" {
			return nil, status.Errorf(codes.NotFound, "file not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to get file: %v", err)
	}

	return &rpc.GetBucketFileResponse{
		Content:     content,
		ContentType: contentType,
		Size:        int64(len(content)),
		ModifiedAt:  time.Now().Unix(),
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
