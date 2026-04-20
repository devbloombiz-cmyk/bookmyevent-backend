import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

type S3EnvironmentConfig = {
  bucketName: string;
  region: string;
};

const requiredEnvKeys = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "AWS_BUCKET_NAME",
] as const;

let cachedS3Client: S3Client | null = null;
let cachedS3Config: S3EnvironmentConfig | null = null;

function getMissingS3EnvKeys(): string[] {
  const missingKeys: string[] = [];

  for (const key of requiredEnvKeys) {
    const value = env[key];
    if (!value || value.trim().length === 0) {
      missingKeys.push(key);
    }
  }

  return missingKeys;
}

export function getS3Config(): S3EnvironmentConfig {
  if (cachedS3Config) {
    return cachedS3Config;
  }

  const missingKeys = getMissingS3EnvKeys();
  if (missingKeys.length > 0) {
    throw new Error(`Missing AWS S3 environment variables: ${missingKeys.join(", ")}`);
  }

  cachedS3Config = {
    bucketName: env.AWS_BUCKET_NAME as string,
    region: env.AWS_REGION as string,
  };

  return cachedS3Config;
}

export function getS3Client(): S3Client {
  if (cachedS3Client) {
    return cachedS3Client;
  }

  getS3Config();

  cachedS3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
    },
  });

  return cachedS3Client;
}