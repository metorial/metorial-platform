package service

import "github.com/metorial/metorial/services/log/internal/s3"

type Config struct {
	AwsAccessKey string
	AwsSecretKey string
	AwsRegion    string
	AwsEndpoint  string
	Bucket       string

	MongoURI      string
	MongoDatabase string

	GRPCAddress string
}

type ConfigOptions func(*Config)

func WithAwsAccessKey(accessKey string) ConfigOptions {
	return func(c *Config) {
		c.AwsAccessKey = accessKey
	}
}

func WithAwsSecretKey(secretKey string) ConfigOptions {
	return func(c *Config) {
		c.AwsSecretKey = secretKey
	}
}

func WithAwsRegion(region string) ConfigOptions {
	return func(c *Config) {
		c.AwsRegion = region
	}
}

func WithAwsEndpoint(endpoint string) ConfigOptions {
	return func(c *Config) {
		if endpoint == "" {
			return
		}

		c.AwsEndpoint = endpoint
	}
}

func WithS3Bucket(bucket string) ConfigOptions {
	return func(c *Config) {
		c.Bucket = bucket
	}
}

func WithMongoURI(uri string) ConfigOptions {
	return func(c *Config) {
		c.MongoURI = uri
	}
}

func WithMongoDatabase(database string) ConfigOptions {
	return func(c *Config) {
		c.MongoDatabase = database
	}
}

func WithGRPCAddress(address string) ConfigOptions {
	return func(c *Config) {
		c.GRPCAddress = address
	}
}

func applyConfigOptions(opts ...ConfigOptions) *Config {
	config := &Config{
		AwsAccessKey:  "",
		AwsSecretKey:  "",
		AwsRegion:     "us-east-1",
		AwsEndpoint:   "http://localhost:9000",
		Bucket:        "metorial-logs",
		MongoURI:      "mongodb://localhost:27017",
		MongoDatabase: "metorial",
	}

	for _, opt := range opts {
		opt(config)
	}

	return config
}

func (c *Config) ToS3Config() s3.S3Config {
	return s3.S3Config{
		AwsAccessKey: c.AwsAccessKey,
		AwsSecretKey: c.AwsSecretKey,
		AwsRegion:    c.AwsRegion,
		AwsEndpoint:  c.AwsEndpoint,
		Bucket:       c.Bucket,
	}
}
