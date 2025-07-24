package service

import "github.com/google/uuid"

type Config struct {
	InstanceID       string
	GRPCAddress      string
	WebSocketAddress string
	RedisURL         string
	JWTSecret        string
}

type ConfigOptions func(*Config)

func WithInstanceID(instanceID string) ConfigOptions {
	return func(c *Config) {
		c.InstanceID = instanceID
	}
}

func WithGRPCAddress(port string) ConfigOptions {
	return func(c *Config) {
		c.GRPCAddress = port
	}
}

func WithWebSocketAddress(port string) ConfigOptions {
	return func(c *Config) {
		c.WebSocketAddress = port
	}
}

func WithRedisURL(url string) ConfigOptions {
	return func(c *Config) {
		c.RedisURL = url
	}
}

func WithJWTSecret(secret string) ConfigOptions {
	return func(c *Config) {
		c.JWTSecret = secret
	}
}

func applyConfigOptions(opts ...ConfigOptions) *Config {
	config := &Config{
		InstanceID:       uuid.NewString(),
		GRPCAddress:      ":4061",
		WebSocketAddress: ":4061",
		RedisURL:         "localhost:6379/0",
		JWTSecret:        uuid.NewString(),
	}

	for _, opt := range opts {
		opt(config)
	}

	return config
}
