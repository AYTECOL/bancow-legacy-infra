import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import {Construct} from 'constructs';

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

        const {environment, projectName} = props;

        // Import existing VPC by tag
        // The VPC should already exist from CloudFormation deployment
        this.vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
            tags: {
                Name: 'vpc_bancow_poc',
            },
        });

        // Let CDK discover subnets automatically from the VPC
        // This approach reduces coupling and is more resilient to infrastructure changes
        this.privateSubnets = this.vpc.privateSubnets;
        this.publicSubnets = this.vpc.publicSubnets;

        // Import Lambda security group
        this.lambdaSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
            this,
            'sg_ec2_gea',
            'sg-0560abb16110cb333',
        );

        // Publish VPC ID to SSM Parameter Store for SAM consumption
        new ssm.StringParameter(this, 'VpcIdParameter', {
            parameterName: `/${projectName}/${environment}/network/vpc/id`,
            stringValue: this.vpc.vpcId,
            description: `VPC ID for ${projectName} ${environment}`,
            tier: ssm.ParameterTier.STANDARD,
        });

        // Publish VPC CIDR for reference
        new ssm.StringParameter(this, 'VpcCidrParameter', {
            parameterName: `/${projectName}/${environment}/network/vpc/cidr`,
            stringValue: this.vpc.vpcCidrBlock,
            description: `VPC CIDR block for ${projectName} ${environment}`,
            tier: ssm.ParameterTier.STANDARD,
        });

        // Publish private subnet IDs
        new ssm.StringParameter(this, 'PrivateSubnetIdsParameter', {
            parameterName: `/${projectName}/${environment}/network/subnets/private`,
            stringValue: this.privateSubnets.map(s => s.subnetId).join(','),
            description: `Private subnet IDs for ${projectName} ${environment}`,
            tier: ssm.ParameterTier.STANDARD,
        });

        // Publish public subnet IDs
        new ssm.StringParameter(this, 'PublicSubnetIdsParameter', {
            parameterName: `/${projectName}/${environment}/network/subnets/public`,
            stringValue: this.publicSubnets.map(s => s.subnetId).join(','),
            description: `Public subnet IDs for ${projectName} ${environment}`,
            tier: ssm.ParameterTier.STANDARD,
        });

        // Publish Lambda security group ID
        new ssm.StringParameter(this, 'LambdaSecurityGroupParameter', {
            parameterName: `/${projectName}/${environment}/network/sg/lambda`,
            stringValue: this.lambdaSecurityGroup.securityGroupId,
            description: `Lambda security group ID for ${projectName} ${environment}`,
            tier: ssm.ParameterTier.STANDARD,
        });

        // CloudFormation outputs
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID'
        });

        new cdk.CfnOutput(this, 'PrivateSubnetIds', {
            value: this.privateSubnets.map(s => s.subnetId).join(','),
            description: 'Private Subnet IDs'
        });

        new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
            value: this.lambdaSecurityGroup.securityGroupId,
            description: 'Lambda Security Group ID'
        });
    }
}
