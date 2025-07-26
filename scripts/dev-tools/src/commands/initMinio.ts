import { CreateBucketCommand, ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';

let buckets = ['metorial-code-bucket-dev', 'metorial-logs-dev'];

export let initMinio = async () => {
  let s3Client = new S3Client({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'minio',
      secretAccessKey: 'minio123'
    },
    forcePathStyle: true
  });

  try {
    let { Buckets } = await s3Client.send(new ListBucketsCommand({}));
    let existingBuckets = Buckets?.map(bucket => bucket.Name) || [];

    for (let bucketName of buckets) {
      if (!existingBuckets.includes(bucketName)) {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`Bucket created: ${bucketName}`);
      } else {
        console.log(`Bucket already exists: ${bucketName}`);
      }
    }
  } catch (error) {
    console.error('Error initializing Minio:', error);
  }
};
