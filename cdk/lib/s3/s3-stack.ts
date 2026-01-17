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
 * - Templates bucket (for CloudFormation templates)
 * - Data bucket (for application data storage)
 */
export class S3Stack extends cdk.NestedStack {
  public readonly artifactsBucket: s3.IBucket;
  public readonly templatesBucket: s3.IBucket;
  public readonly dataBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    const { environment, projectName } = props;

    // Import existing Artifacts bucket
    this.artifactsBucket = s3.Bucket.fromBucketName(
      this,
      'ArtifactsBucket',
      `bancow-${environment}-artifacts`,
    );

    // Import existing Templates bucket
    this.templatesBucket = s3.Bucket.fromBucketName(
      this,
      'TemplatesBucket',
      `bancow-${environment}-templates`,
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

    // Publish Templates bucket name to SSM
    new ssm.StringParameter(this, 'TemplatesBucketParameter', {
      parameterName: `/${projectName}/${environment}/s3/templates-bucket-name`,
      stringValue: this.templatesBucket.bucketName,
      description: `Templates S3 bucket name for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Templates bucket ARN to SSM
    new ssm.StringParameter(this, 'TemplatesBucketArnParameter', {
      parameterName: `/${projectName}/${environment}/s3/templates-bucket-arn`,
      stringValue: this.templatesBucket.bucketArn,
      description: `Templates S3 bucket ARN for ${projectName} ${environment}`,
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

    new cdk.CfnOutput(this, 'TemplatesBucketName', {
      value: this.templatesBucket.bucketName,
      description: 'Templates Bucket Name',
      exportName: `${projectName}-${environment}-templates-bucket`,
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      description: 'Data Bucket Name',
      exportName: `${projectName}-${environment}-data-bucket`,
    });
  }
}
