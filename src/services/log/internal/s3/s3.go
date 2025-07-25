package s3

import (
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

type S3Config struct {
	AwsAccessKey string
	AwsSecretKey string
	AwsRegion    string
	AwsEndpoint  string
	Bucket       string
}

type S3StorageBackend struct {
	client *s3.S3
	bucket string
	prefix string
}

func NewS3StorageBackend(config S3Config) (*S3StorageBackend, error) {
	awsConfig := aws.NewConfig().
		WithRegion(config.AwsRegion).
		WithCredentials(credentials.NewStaticCredentials(
			config.AwsAccessKey,
			config.AwsSecretKey,
			"",
		)).
		WithEndpoint(config.AwsEndpoint).
		WithS3ForcePathStyle(true)

	sess, err := session.NewSession(awsConfig)
	if err != nil {
		panic(fmt.Sprintf("failed to create AWS session: %v", err))
	}
	s3Client := s3.New(sess)

	return &S3StorageBackend{
		client: s3Client,
		bucket: config.Bucket,
		prefix: "",
	}, nil
}

func (s *S3StorageBackend) Store(key string, payload []byte) error {
	fullKey := s.prefix + key
	_, err := s.client.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(fullKey),
		Body:   strings.NewReader(string(payload)),
	})
	return err
}

func (s *S3StorageBackend) Retrieve(key string) ([]byte, error) {
	fullKey := s.prefix + key
	result, err := s.client.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(fullKey),
	})
	if err != nil {
		return nil, err
	}
	defer result.Body.Close()

	return io.ReadAll(result.Body)
}
