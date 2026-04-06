package fs

type FileSystemManagerOptions struct {
	RedisURL string

	ObjectStorageEndpoint string
	ObjectStorageBucket   string
}

type FileSystemManagerOption func(*FileSystemManagerOptions)

func WithRedisURL(redisURL string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.RedisURL = redisURL
	}
}

func WithObjectStorageEndpoint(endpoint string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.ObjectStorageEndpoint = endpoint
	}
}

func WithObjectStorageBucket(bucket string) FileSystemManagerOption {
	return func(opts *FileSystemManagerOptions) {
		opts.ObjectStorageBucket = bucket
	}
}
