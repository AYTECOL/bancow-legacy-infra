import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface KmsStackProps extends cdk.NestedStackProps {
  environment: string;
  projectName: string;
}

/**
 * KMS Stack - Imports existing KMS keys and publishes to SSM Parameter Store
 * 
 * This stack does NOT create new KMS keys. It imports existing ones created
 * by CloudFormation and makes them available to SAM via SSM parameters.
 * 
 * Keys managed:
 * - Main encryption key (for S3, Secrets Manager, etc.)
 * - Optional: separate keys for different data classifications
 */
export class KmsStack extends cdk.NestedStack {
  public readonly mainKey: kms.IKey;

  constructor(scope: Construct, id: string, props: KmsStackProps) {
    super(scope, id, props);

    const { environment, projectName } = props;

    // Import existing KMS key by alias
    // The key should already exist from CloudFormation deployment
    this.mainKey = kms.Key.fromLookup(this, 'MainEncryptionKey', {
      aliasName: `alias/${projectName}-${environment}-main`,
    });

    // Publish KMS key ID to SSM
    new ssm.StringParameter(this, 'MainKeyIdParameter', {
      parameterName: `/${projectName}/${environment}/kms/main-key-id`,
      stringValue: this.mainKey.keyId,
      description: `Main KMS key ID for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish KMS key ARN to SSM
    new ssm.StringParameter(this, 'MainKeyArnParameter', {
      parameterName: `/${projectName}/${environment}/kms/main-key-arn`,
      stringValue: this.mainKey.keyArn,
      description: `Main KMS key ARN for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'MainKeyId', {
      value: this.mainKey.keyId,
      description: 'Main KMS Key ID',
      exportName: `${projectName}-${environment}-kms-key-id`,
    });

    new cdk.CfnOutput(this, 'MainKeyArn', {
      value: this.mainKey.keyArn,
      description: 'Main KMS Key ARN',
      exportName: `${projectName}-${environment}-kms-key-arn`,
    });
  }
}
