# BANCOW Infrastructure Repository

> **Single Source of Truth for AWS Infrastructure**
> 
> This repository defines what exists, how it connects, and in what environment.
> It decides which version of the app runs, but contains NO business logic.

---

## 🏗️ Architecture Conceptual Model

Think in **layers, not services**.

```
┌──────────────────────────────┐
│ Root (orchestration)         │  ← Entry point, coordinates all stacks
├──────────────────────────────┤
│ Network (VPC / Subnets)      │  ← Parameters only (externally managed)
├──────────────────────────────┤
│ Security (IAM / SG / Cognito)│  ← Roles, policies, authentication
├──────────────────────────────┤
│ Data (S3 / Secrets / DB)     │  ← Stateful resources
├──────────────────────────────┤
│ App (Lambda / API)           │  ← Application deployment unit
├──────────────────────────────┤
│ Async (SQS / SFN)            │  ← Future: Message queues, workflows
└──────────────────────────────┘
```

### Key Principles

✅ Each layer has a **single responsibility**  
✅ Each layer can **evolve independently**  
✅ Each layer can be **deployed in a controlled manner**  
✅ Use **Parameters**, NOT `Fn::ImportValue`  
✅ Explicit naming: `bancow-{env}-{stack}-{resource}`

---

## 📂 Repository Structure

```
infra/
├─ stacks/
│  ├─ root.yaml              # Orchestrates all stacks
│  ├─ network.yaml           # Network documentation (externally managed)
│  ├─ security.yaml          # IAM, Cognito, WAF
│  ├─ data.yaml              # Secrets Manager, S3
│  ├─ app.yaml               # Lambda, API Gateway
│  └─ async/                 # Future: SQS, Step Functions
│      └─ README.md
│
├─ environments/
│  ├─ dev/
│  │   └─ parameters.json    # Dev environment config
│  ├─ uat/
│  │   └─ parameters.json    # UAT environment config
│  └─ prod/
│      └─ parameters.json    # Prod environment config
│
├─ .github/
│  └─ workflows/
│      ├─ validate.yml       # CI: Validation
│      └─ deploy.yml         # CD: Deployment
│
├─ samconfig.toml            # SAM CLI configuration per environment
└─ README.md                 # This file
```

---

## 🔐 Stack Responsibilities

### 1. Root Stack (Orchestrator Pattern)
**File**: `stacks/root.yaml`

- Coordinates all other stacks
- Does NOT create resources directly
- Passes parameters between stacks
- Entry point for deployments

**Never put**: Lambda functions, VPC, databases

### 2. Network Stack (Infrastructure Boundary Pattern)
**File**: `stacks/network.yaml`

- Documents externally managed network resources
- Currently: VPC, Subnets, Security Groups are external
- Future: Can be used to create VPC if needed

**Currently**: Parameter documentation only

### 3. Security Stack (Least Privilege Pattern)
**File**: `stacks/security.yaml`

**Creates**:
- IAM Roles (explicit, no automatic creation)
- Cognito User Pool, Client, Domain
- WAF Web ACL
- Security policies

**Naming**:
- `bancow-{env}-lambda-execution-role`
- `bancow-{env}-user-pool`
- `bancow-{env}-webacl`

### 4. Data Stack (Stateful Boundary Pattern)
**File**: `stacks/data.yaml`

**Creates**:
- Secrets Manager (SOAP credentials)
- Future: S3 buckets, RDS databases

**Important**: Stateful resources, handle with care during updates

### 5. App Stack (Deployment Unit Pattern)
**File**: `stacks/app.yaml`

**Creates**:
- Lambda functions (using artifacts from app repo)
- API Gateway
- CloudWatch Log Groups

**Uses artifacts from**:
- S3 bucket specified in parameters
- Version specified in parameters
- Does NOT build code

**Does NOT create**: VPC, IAM roles, databases

### 6. Async Stack (Future)
**Folder**: `stacks/async/`

**Status**: Placeholder for future SQS and Step Functions

---

## 🚀 Deployment Guide

### Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **SAM CLI** installed (`sam --version`)
3. **Permissions**: CloudFormation, IAM, Lambda, API Gateway, Cognito, WAF, Secrets Manager
4. **S3 Bucket** for CloudFormation artifacts (SAM creates automatically)
5. **Lambda Artifacts** uploaded to S3 by the app repo CI/CD

### Environment Strategy

| Environment | Deployment | Approval | Use Case |
|-------------|-----------|----------|----------|
| **dev**     | Automatic | None     | Development, testing |
| **uat**     | Manual    | Required | Pre-production validation |
| **prod**    | Manual    | Required + Changeset Review | Production |

### Deployment Commands

#### 1. Validate Templates

```bash
# Validate all templates
sam validate --template stacks/root.yaml --lint
sam validate --template stacks/security.yaml --lint
sam validate --template stacks/data.yaml --lint
sam validate --template stacks/app.yaml --lint
```

#### 2. Deploy to Development

```bash
cd infra
sam deploy \
  --template-file stacks/root.yaml \
  --config-env dev \
  --parameter-overrides $(cat environments/dev/parameters.json | jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")')
```

#### 3. Deploy to UAT (Manual Approval)

```bash
cd infra
sam deploy \
  --template-file stacks/root.yaml \
  --config-env uat \
  --parameter-overrides $(cat environments/uat/parameters.json | jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")')
```

**Note**: Requires manual confirmation of changeset

#### 4. Deploy to Production (Change Set + Approval)

```bash
cd infra
sam deploy \
  --template-file stacks/root.yaml \
  --config-env prod \
  --parameter-overrides $(cat environments/prod/parameters.json | jq -r '.Parameters | to_entries | map("\(.key)=\(.value)") | join(" ")')
```

**Note**: Review changeset carefully before approving

### Deployment Order (First Time)

When deploying for the first time, deploy stacks individually:

```bash
# 1. Security Stack
sam deploy --template-file stacks/security.yaml --stack-name bancow-dev-security --parameter-overrides Environment=dev

# 2. Data Stack
sam deploy --template-file stacks/data.yaml --stack-name bancow-dev-data --parameter-overrides Environment=dev

# 3. App Stack (requires outputs from previous stacks)
sam deploy --template-file stacks/app.yaml --stack-name bancow-dev-app --parameter-overrides file://environments/dev/parameters.json

# Or deploy all at once via root
sam deploy --template-file stacks/root.yaml --stack-name bancow-dev-infra --parameter-overrides file://environments/dev/parameters.json
```

---

## 🔄 Update Strategy

### Updating a Single Stack

To update only one stack (e.g., app stack):

```bash
sam deploy \
  --template-file stacks/app.yaml \
  --stack-name bancow-dev-app \
  --parameter-overrides file://environments/dev/parameters.json
```

### Promoting Between Environments

The typical flow: **dev → uat → prod**

1. Deploy and test in **dev**
2. Update `ArtifactHash` in `environments/uat/parameters.json` (or pass it via `--parameter-overrides` in your pipeline)
3. Deploy to **uat** with manual approval
4. Validate in **uat**
5. Update `ArtifactHash` in `environments/prod/parameters.json` (or pass it via `--parameter-overrides` in your pipeline)
6. Deploy to **prod** with manual approval and changeset review

---

## 🧪 CI/CD Integration

### Repository: App (Business Logic)

**Responsibilities**:
- Build code
- Run tests
- Package artifacts
- Upload to S3
- Notify (optional)

**Does NOT**: Deploy infrastructure, create AWS resources

### Repository: Infra (This Repo)

**Responsibilities**:
- Receive approved version from app repo
- Deploy infrastructure with specified artifact version
- Promote through environments: dev → uat → prod

---

## 🔒 Naming Convention (Mandatory)

**Pattern**: `bancow-{env}-{stack}-{resource}`

**Examples**:
- `bancow-dev-api`
- `bancow-prod-service-fn`
- `bancow-uat-soap-credentials`
- `bancow-dev-lambda-execution-role`
- `bancow-prod-webacl`

---

## 📋 Parameter Management

### Updating Parameters

1. Edit the appropriate file: `environments/{env}/parameters.json`
2. Commit changes
3. Deploy using the updated parameters

### Required Parameters

All environments require:
- `Environment` (dev, uat, prod)
- `VpcId` (VPC where resources live)
- `PrivateSubnetIds` (comma-separated subnet IDs)
- `LambdaSecurityGroupId` (security group for Lambda)
- `LambdaArtifactBucket` (S3 bucket with artifacts)
- `ArtifactBucket` (S3 bucket with async/step-functions Lambdas artifacts)
- `ArtifactHash` (unique value per build/release; used to reference a new S3 key and force Lambda code update)
- `LogLevel` (DEBUG, INFO, WARN, ERROR)

Optional (can be empty to use the hash-based key pattern):
- `LambdaArtifactKey` (explicit S3 key for app Lambda artifact)
- `ArtifactKey` (explicit S3 key for async Lambdas artifact)

---

## ⚠️ Critical Rules

### ❌ DO NOT

- Use `Fn::ImportValue` (creates hidden dependencies)
- Put business logic in infrastructure code
- Hardcode secrets (use Secrets Manager)
- Mix infrastructure and application code
- Deploy from app repo

### ✅ DO

- Use Parameters for cross-stack communication
- Keep stacks focused on single responsibility
- Version your Lambda artifacts
- Review changesets before production deployment
- Tag all resources appropriately
- Use explicit IAM roles (no automatic creation)

---

## 🆘 Troubleshooting

### Stack Deployment Fails

1. Check CloudFormation events in AWS Console
2. Verify parameter values in `environments/{env}/parameters.json`
3. Ensure Lambda artifacts exist in S3
4. Check IAM permissions

### Nested Stack Errors

1. Ensure child stack templates are accessible (S3 or local path)
2. Verify TemplateURL in root.yaml
3. Check parameter passing between stacks

### Lambda Deployment Issues

1. Verify artifact bucket and key in parameters
2. If you are NOT using S3 versioning, ensure your pipeline uploads to a **new key per release**.
   - This repo supports `lambda/bancow-service-${ArtifactHash}.zip` via `ArtifactHash`.
3. Ensure IAM role has permissions
4. Validate VPC and subnet configuration

---

## 📞 Support

For issues or questions:
1. Check CloudFormation stack events
2. Review SAM CLI logs
3. Consult AWS documentation
4. Contact the infrastructure team

---

## 📝 Version History

- **2026-01-17**: Initial infrastructure decoupling
  - Separated infrastructure from app repo
  - Implemented layered stack architecture
  - Added multi-environment support (dev, uat, prod)

---

**Last Updated**: 2026-01-17  
**Maintained By**: Infrastructure Team
