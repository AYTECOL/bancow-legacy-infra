import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface S3StackProps extends cdk.NestedStackProps {
  environment: string;
  projectName: string;
}

/**
 * S3 Stack - Imports existing S3 buckets and publishes to SSM Parameter Store
 * 
 * This stack does NOT create new S3 buckets. It imports existing ones created
 * by CloudFormation and makes them available to SAM via SSM parameters.
 * 
 * Buckets managed:
 * - Artifacts bucket (for Lambda deployment packages)
 * - Logs bucket (for application and access logs)
 * - Data bucket (for application data storage)
 */
export class S3Stack extends cdk.NestedStack {
  public readonly artifactsBucket: s3.IBucket;
  public readonly logsBucket: s3.IBucket;
  public readonly dataBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    const { environment, projectName } = props;

    // Import existing Artifacts bucket
    this.artifactsBucket = s3.Bucket.fromBucketName(
      this,
      'ArtifactsBucket',
      `${projectName}-${environment}-artifacts`,
    );

    // Import existing Logs bucket
    this.logsBucket = s3.Bucket.fromBucketName(
      this,
      'LogsBucket',
      `${projectName}-${environment}-logs`,
    );

    // Import existing Data bucket
    this.dataBucket = s3.Bucket.fromBucketName(
      this,
      'DataBucket',
      `${projectName}-${environment}-data`,
    );

    // Publish Artifacts bucket name to SSM
    new ssm.StringParameter(this, 'ArtifactsBucketParameter', {
      parameterName: `/${projectName}/${environment}/s3/artifacts-bucket-name`,
      stringValue: this.artifactsBucket.bucketName,
      description: `Artifacts S3 bucket name for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Artifacts bucket ARN to SSM
    new ssm.StringParameter(this, 'ArtifactsBucketArnParameter', {
      parameterName: `/${projectName}/${environment}/s3/artifacts-bucket-arn`,
      stringValue: this.artifactsBucket.bucketArn,
      description: `Artifacts S3 bucket ARN for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Logs bucket name to SSM
    new ssm.StringParameter(this, 'LogsBucketParameter', {
      parameterName: `/${projectName}/${environment}/s3/logs-bucket-name`,
      stringValue: this.logsBucket.bucketName,
      description: `Logs S3 bucket name for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Logs bucket ARN to SSM
    new ssm.StringParameter(this, 'LogsBucketArnParameter', {
      parameterName: `/${projectName}/${environment}/s3/logs-bucket-arn`,
      stringValue: this.logsBucket.bucketArn,
      description: `Logs S3 bucket ARN for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Data bucket name to SSM
    new ssm.StringParameter(this, 'DataBucketParameter', {
      parameterName: `/${projectName}/${environment}/s3/data-bucket-name`,
      stringValue: this.dataBucket.bucketName,
      description: `Data S3 bucket name for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Data bucket ARN to SSM
    new ssm.StringParameter(this, 'DataBucketArnParameter', {
      parameterName: `/${projectName}/${environment}/s3/data-bucket-arn`,
      stringValue: this.dataBucket.bucketArn,
      description: `Data S3 bucket ARN for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'ArtifactsBucketName', {
      value: this.artifactsBucket.bucketName,
      description: 'Artifacts Bucket Name',
      exportName: `${projectName}-${environment}-artifacts-bucket`,
    });

    new cdk.CfnOutput(this, 'LogsBucketName', {
      value: this.logsBucket.bucketName,
      description: 'Logs Bucket Name',
      exportName: `${projectName}-${environment}-logs-bucket`,
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      description: 'Data Bucket Name',
      exportName: `${projectName}-${environment}-data-bucket`,
    });
  }
}
