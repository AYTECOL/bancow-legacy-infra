import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcStack } from './network/vpc-stack';
import { IamStack } from './iam/iam-stack';
import { S3Stack } from './s3/s3-stack';
import { KmsStack } from './security/kms-stack';

export interface BancowBaseStackProps extends cdk.StackProps {
  environment: string;
}

/**
 * BANCOW Base Infrastructure Stack
 * 
 * This is the orchestrator stack that coordinates all base infrastructure:
 * - Network (VPC, Subnets, Security Groups)
 * - IAM (OIDC, Roles, Boundaries)
 * - S3 (Buckets for artifacts, logs, data)
 * - Security (KMS keys)
 * 
 * IMPORTANT: This stack imports existing resources created by CloudFormation.
 * It does NOT create new infrastructure, only imports and publishes to SSM.
 * 
 * All outputs are published to SSM Parameter Store for SAM consumption.
 * 
 * Rules:
 * ❌ Never deploy infrastructure from bancow-app
 * ✅ Always deploy CDK before SAM
 * ✅ CDK publishes outputs to SSM
 * ✅ SAM consumes from SSM
 * ❌ SAM does NOT create VPC, IAM base, or shared buckets
 */
export class BancowBaseStack extends cdk.Stack {
  public readonly vpcStack: VpcStack;
  public readonly iamStack: IamStack;
  public readonly s3Stack: S3Stack;
  public readonly kmsStack: KmsStack;

  constructor(scope: Construct, id: string, props: BancowBaseStackProps) {
    super(scope, id, props);

    const projectName = 'bancow';
    const { environment } = props;

    // GitHub configuration (should be parameterized in production)
    const githubOrg = this.node.tryGetContext('githubOrg') || 'your-org';
    const githubRepo = this.node.tryGetContext('githubRepo') || 'bancow-infra';

    // Deploy KMS stack first (needed for encryption)
    this.kmsStack = new KmsStack(this, 'KmsStack', {
      environment,
      projectName,
    });

    // Deploy S3 stack (buckets may reference KMS keys)
    this.s3Stack = new S3Stack(this, 'S3Stack', {
      environment,
      projectName,
    });

    // Deploy VPC stack
    this.vpcStack = new VpcStack(this, 'VpcStack', {
      environment,
      projectName,
    });

    // Deploy IAM stack (may need to reference other resources)
    this.iamStack = new IamStack(this, 'IamStack', {
      environment,
      projectName,
      githubOrg,
      githubRepo,
    });

    // Add dependencies to ensure proper deployment order
    this.s3Stack.addDependency(this.kmsStack);
    this.iamStack.addDependency(this.vpcStack);
    this.iamStack.addDependency(this.s3Stack);

    // Stack-level outputs
    new cdk.CfnOutput(this, 'Environment', {
      value: environment,
      description: 'Deployment environment',
      exportName: `${projectName}-${environment}-environment`,
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
      exportName: `${projectName}-${environment}-region`,
    });

    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'Base stack name',
      exportName: `${projectName}-${environment}-base-stack-name`,
    });

    // Add deployment instructions as stack description
    this.templateOptions.description = `
BANCOW ${environment.toUpperCase()} Base Infrastructure - Managed by CDK

This stack imports and manages references to existing base infrastructure:
- VPC and networking resources
- IAM roles and OIDC provider for GitHub Actions
- S3 buckets (artifacts, logs, data)
- KMS encryption keys

All resources are published to SSM Parameter Store at:
  /${projectName}/${environment}/*

SAM templates should consume these parameters, not create base resources.

Deployment order: CDK → SAM
Managed by: Platform Team
    `.trim();
  }
}
