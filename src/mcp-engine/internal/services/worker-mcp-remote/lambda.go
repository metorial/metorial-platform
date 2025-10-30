package remote

import (
	"context"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/lambda"
)

func newLambdaClient(ctx context.Context) *lambda.Client {
	var cfg aws.Config
	var err error

	accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	region := os.Getenv("AWS_REGION")

	if region == "" {
		log.Fatalln("AWS_REGION environment variable is not set")
	}

	if accessKey != "" && secretKey != "" {
		log.Printf("[awsutil] Using explicit AWS credentials from env (region=%s)", region)
		cfg, err = config.LoadDefaultConfig(ctx,
			config.WithRegion(region),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		)
	} else {
		log.Printf("[awsutil] Using default AWS credentials provider chain")
		cfg, err = config.LoadDefaultConfig(ctx)
	}

	if err != nil {
		panic("failed to load AWS config: " + err.Error())
	}

	return lambda.NewFromConfig(cfg)
}

var LambdaClient *lambda.Client

func ensureLambdaClient() *lambda.Client {
	if LambdaClient == nil {
		LambdaClient = newLambdaClient(context.Background())
	}
	return LambdaClient
}
