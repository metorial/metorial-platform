package fs

type FileSystemManagerOptions struct {
	RedisURL string

	S3Bucket     string
	AwsRegion    string
	AwsAccessKey string
	AwsSecretKey string
	AwsEndpoint  string
}

type FileSystemManagerOption func(*FileSystemManagerOptions)

func WithRedisURL(redisURL string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.RedisURL = redisURL
	}
}

func WithS3Bucket(bucket string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.S3Bucket = bucket
	}
}

func WithAwsRegion(region string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.AwsRegion = region
	}
}

func WithAwsAccessKey(accessKey string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.AwsAccessKey = accessKey
	}
}

func WithAwsSecretKey(secretKey string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.AwsSecretKey = secretKey
	}
}

func WithAwsEndpoint(endpoint string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		if endpoint == "" {
			return
		}

		opts.AwsEndpoint = endpoint
	}
}
