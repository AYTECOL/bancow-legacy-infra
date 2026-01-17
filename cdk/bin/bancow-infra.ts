#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BancowBaseStack } from '../lib/bancow-base-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Common tags for all resources
const commonTags = {
  Project: 'BANCOW',
  Compliance: 'PCI-DSS',
  Owner: 'AYTÉ',
  CostCenter: 'IT-Infrastructure',
  ManagedBy: 'CDK',
};

// Deploy base infrastructure stack for the specified environment
new BancowBaseStack(app, `BancowBaseStack-${environment}`, {
  env: {
    account: account,
    region: region,
  },
  stackName: `bancow-${environment}-base`,
  description: `BANCOW ${environment.toUpperCase()} - Base Infrastructure (VPC, IAM, S3) - Managed by CDK`,
  tags: {
    ...commonTags,
    Environment: environment,
  },
  environment: environment,
});

app.synth();
