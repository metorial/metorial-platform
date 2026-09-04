package service

import (
	"context"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// The destination is validated before the filesystem manager is touched, so a
// zero-value service is enough to exercise these cases.
func TestExportBucketFilesAsZipToUploadRejectsAmbiguousDestinations(t *testing.T) {
	tests := []struct {
		name string
		req  *rpc.ExportBucketFilesAsZipToUploadRequest
	}{
		{
			name: "no destination",
			req:  &rpc.ExportBucketFilesAsZipToUploadRequest{BucketId: "bkt_1"},
		},
		{
			name: "both destinations",
			req: &rpc.ExportBucketFilesAsZipToUploadRequest{
				BucketId:     "bkt_1",
				UploadUrl:    "https://example.com/signed",
				UploadBucket: "files",
				UploadKey:    "str_a",
			},
		},
		{
			name: "bucket without key",
			req: &rpc.ExportBucketFilesAsZipToUploadRequest{
				BucketId:     "bkt_1",
				UploadBucket: "files",
			},
		},
		{
			name: "key without bucket",
			req: &rpc.ExportBucketFilesAsZipToUploadRequest{
				BucketId:  "bkt_1",
				UploadKey: "str_a",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rs := &RcpService{}

			_, err := rs.ExportBucketFilesAsZipToUpload(context.Background(), tt.req)
			if err == nil {
				t.Fatal("expected an invalid argument error")
			}
			if status.Code(err) != codes.InvalidArgument {
				t.Fatalf("expected InvalidArgument, got %v", status.Code(err))
			}
		})
	}
}

func TestExportBucketFilesAsZipToUploadRequiresBucketId(t *testing.T) {
	rs := &RcpService{}

	_, err := rs.ExportBucketFilesAsZipToUpload(context.Background(), &rpc.ExportBucketFilesAsZipToUploadRequest{
		UploadUrl: "https://example.com/signed",
	})
	if err == nil {
		t.Fatal("expected an invalid argument error")
	}
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", status.Code(err))
	}
}
