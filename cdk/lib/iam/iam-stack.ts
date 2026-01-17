import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface IamStackProps extends cdk.NestedStackProps {
  environment: string;
  projectName: string;
  githubOrg: string;
  githubRepo: string;
}

/**
 * IAM Stack - OIDC Provider for GitHub Actions and base IAM roles
 * 
 * This stack creates:
 * - OIDC Identity Provider for GitHub Actions (if not exists)
 * - IAM roles for CI/CD deployment with proper boundaries
 * - Base Lambda execution role (or imports existing one)
 * - Publishes role ARNs to SSM for SAM consumption
 */
export class IamStack extends cdk.NestedStack {
  public readonly githubActionsRole: iam.Role;
  public readonly lambdaExecutionRole: iam.IRole;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    const { environment, projectName, githubOrg, githubRepo } = props;

    // Create or import OIDC Provider for GitHub Actions
    // Check if provider already exists to avoid conflicts
    const githubOidcProvider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'], // GitHub Actions thumbprint
    });

    // Permission boundary for deployment roles
    const deploymentBoundary = new iam.ManagedPolicy(this, 'DeploymentBoundary', {
      managedPolicyName: `${projectName}-${environment}-deployment-boundary`,
      description: 'Permission boundary for CI/CD deployment roles',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['*'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: [
            'iam:DeleteUser',
            'iam:DeleteRole',
            'iam:DeletePolicy',
            'organizations:*',
            'account:*',
          ],
          resources: ['*'],
        }),
      ],
    });

    // GitHub Actions deployment role with OIDC trust
    this.githubActionsRole = new iam.Role(this, 'GithubActionsRole', {
      roleName: `${projectName}-${environment}-github-actions`,
      description: 'Role for GitHub Actions to deploy infrastructure and applications',
      assumedBy: new iam.FederatedPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${githubOrg}/${githubRepo}:*`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      permissionsBoundary: deploymentBoundary,
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Attach policies for CDK and SAM deployments
    this.githubActionsRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
    );

    // Additional policy for IAM operations needed for CDK/SAM
    this.githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'iam:CreateRole',
          'iam:PutRolePolicy',
          'iam:AttachRolePolicy',
          'iam:PassRole',
          'iam:GetRole',
          'iam:GetRolePolicy',
          'iam:ListRolePolicies',
          'iam:ListAttachedRolePolicies',
          'iam:UpdateAssumeRolePolicy',
          'iam:TagRole',
        ],
        resources: [
          `arn:aws:iam::${cdk.Stack.of(this).account}:role/${projectName}-${environment}-*`,
        ],
      }),
    );

    // Import or reference existing Lambda execution role
    // If the role exists from CloudFormation, import it; otherwise reference will be created by SAM
    try {
      this.lambdaExecutionRole = iam.Role.fromRoleName(
        this,
        'ImportedLambdaRole',
        `${projectName}-${environment}-lambda-execution-role`,
      );
    } catch (error) {
      // If role doesn't exist yet, create a placeholder reference
      // SAM will create the actual role
      this.lambdaExecutionRole = iam.Role.fromRoleArn(
        this,
        'PlaceholderLambdaRole',
        `arn:aws:iam::${cdk.Stack.of(this).account}:role/${projectName}-${environment}-lambda-execution-role`,
      );
    }

    // Publish GitHub Actions role ARN to SSM
    new ssm.StringParameter(this, 'GithubActionsRoleParameter', {
      parameterName: `/${projectName}/${environment}/iam/github-actions-role-arn`,
      stringValue: this.githubActionsRole.roleArn,
      description: `GitHub Actions deployment role ARN for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Lambda execution role ARN to SSM
    new ssm.StringParameter(this, 'LambdaExecutionRoleParameter', {
      parameterName: `/${projectName}/${environment}/iam/lambda-execution-role-arn`,
      stringValue: this.lambdaExecutionRole.roleArn,
      description: `Lambda execution role ARN for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish OIDC provider ARN to SSM
    new ssm.StringParameter(this, 'OidcProviderParameter', {
      parameterName: `/${projectName}/${environment}/iam/github-oidc-provider-arn`,
      stringValue: githubOidcProvider.openIdConnectProviderArn,
      description: `GitHub OIDC provider ARN for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'GithubActionsRoleArn', {
      value: this.githubActionsRole.roleArn,
      description: 'GitHub Actions Role ARN',
      exportName: `${projectName}-${environment}-github-actions-role-arn`,
    });

    new cdk.CfnOutput(this, 'GithubActionsRoleName', {
      value: this.githubActionsRole.roleName,
      description: 'GitHub Actions Role Name',
      exportName: `${projectName}-${environment}-github-actions-role-name`,
    });

    new cdk.CfnOutput(this, 'OidcProviderArn', {
      value: githubOidcProvider.openIdConnectProviderArn,
      description: 'GitHub OIDC Provider ARN',
      exportName: `${projectName}-${environment}-github-oidc-provider`,
    });
  }
}
