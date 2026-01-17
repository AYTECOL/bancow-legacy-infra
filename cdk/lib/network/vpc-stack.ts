import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface VpcStackProps extends cdk.NestedStackProps {
  environment: string;
  projectName: string;
}

/**
 * VPC Stack - Imports existing VPC resources and publishes to SSM Parameter Store
 * 
 * This stack does NOT create new VPC resources. It imports existing ones created
 * by CloudFormation and makes them available to SAM via SSM parameters.
 * 
 * Use CDK import capabilities to reference existing resources:
 * - VPC by tag or name
 * - Subnets by tags
 * - Security groups by tags
 */
export class VpcStack extends cdk.NestedStack {
  public readonly vpc: ec2.IVpc;
  public readonly privateSubnets: ec2.ISubnet[];
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly lambdaSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    const { environment, projectName } = props;

    // Import existing VPC by tag
    // The VPC should already exist from CloudFormation deployment
    this.vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
      tags: {
        Name: `${projectName}-${environment}-vpc`,
      },
    });

    // Import private subnets by tags
    this.privateSubnets = [
      ec2.Subnet.fromSubnetAttributes(this, 'PrivateSubnet1', {
        subnetId: cdk.Fn.importValue(`${projectName}-${environment}-private-subnet-1-id`),
        availabilityZone: cdk.Fn.importValue(`${projectName}-${environment}-private-subnet-1-az`),
      }),
      ec2.Subnet.fromSubnetAttributes(this, 'PrivateSubnet2', {
        subnetId: cdk.Fn.importValue(`${projectName}-${environment}-private-subnet-2-id`),
        availabilityZone: cdk.Fn.importValue(`${projectName}-${environment}-private-subnet-2-az`),
      }),
    ];

    // Import public subnets by tags
    this.publicSubnets = [
      ec2.Subnet.fromSubnetAttributes(this, 'PublicSubnet1', {
        subnetId: cdk.Fn.importValue(`${projectName}-${environment}-public-subnet-1-id`),
        availabilityZone: cdk.Fn.importValue(`${projectName}-${environment}-public-subnet-1-az`),
      }),
      ec2.Subnet.fromSubnetAttributes(this, 'PublicSubnet2', {
        subnetId: cdk.Fn.importValue(`${projectName}-${environment}-public-subnet-2-id`),
        availabilityZone: cdk.Fn.importValue(`${projectName}-${environment}-public-subnet-2-az`),
      }),
    ];

    // Import Lambda security group
    this.lambdaSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'LambdaSecurityGroup',
      cdk.Fn.importValue(`${projectName}-${environment}-lambda-sg-id`),
    );

    // Publish VPC ID to SSM Parameter Store for SAM consumption
    new ssm.StringParameter(this, 'VpcIdParameter', {
      parameterName: `/${projectName}/${environment}/network/vpc-id`,
      stringValue: this.vpc.vpcId,
      description: `VPC ID for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish private subnet IDs
    new ssm.StringParameter(this, 'PrivateSubnetIdsParameter', {
      parameterName: `/${projectName}/${environment}/network/private-subnet-ids`,
      stringValue: this.privateSubnets.map(s => s.subnetId).join(','),
      description: `Private subnet IDs for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish public subnet IDs
    new ssm.StringParameter(this, 'PublicSubnetIdsParameter', {
      parameterName: `/${projectName}/${environment}/network/public-subnet-ids`,
      stringValue: this.publicSubnets.map(s => s.subnetId).join(','),
      description: `Public subnet IDs for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish Lambda security group ID
    new ssm.StringParameter(this, 'LambdaSecurityGroupParameter', {
      parameterName: `/${projectName}/${environment}/network/lambda-sg-id`,
      stringValue: this.lambdaSecurityGroup.securityGroupId,
      description: `Lambda security group ID for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Publish VPC CIDR for reference
    new ssm.StringParameter(this, 'VpcCidrParameter', {
      parameterName: `/${projectName}/${environment}/network/vpc-cidr`,
      stringValue: this.vpc.vpcCidrBlock,
      description: `VPC CIDR block for ${projectName} ${environment}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${projectName}-${environment}-vpc-id-cdk`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.privateSubnets.map(s => s.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: `${projectName}-${environment}-private-subnets-cdk`,
    });

    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID',
      exportName: `${projectName}-${environment}-lambda-sg-cdk`,
    });
  }
}
