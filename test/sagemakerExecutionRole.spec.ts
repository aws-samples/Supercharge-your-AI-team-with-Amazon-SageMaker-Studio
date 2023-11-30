import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { SageMakerExecutionRole } from '../src/sagemakerExecutionRole';

describe('LimitedPermissionUserProfile tests ', () => {
  let stack: Stack;
  let encryptionkey: Key;
  let dataBucketArn: string;

  //initializes stack during each test. Region is eu-central-1
  beforeEach(() => {
    stack = new Stack(new App(), 'test-stack');
    encryptionkey = new Key(stack, 'config-bucket-key');
    dataBucketArn = new Bucket(stack, 'test-bucket', {}).bucketArn;
  });

  //Tests
  test('Test role is assumed by correct service', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'test-sagemaker-execution-role',
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'sagemaker.amazonaws.com' },
          },
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'events.amazonaws.com' },
          },
        ]),
      },
    });
  });

  test('Test role has ECR policy', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'ecr:GetAuthorizationToken',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
              'ecr:BatchCheckLayerAvailability',
              'ecr:SetRepositoryPolicy',
              'ecr:CompleteLayerUpload',
              'ecr:BatchDeleteImage',
              'ecr:UploadLayerPart',
              'ecr:InitiateLayerUpload',
              'ecr:PutImage',
            ],
            Effect: 'Allow',
            Resource: '*',
            Sid: 'sagemakerEcrPolicy',
          },
        ]),
      },
    });
  });

  test('Test KMS key access policy', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).resourceCountIs('AWS::KMS::Key', 1);

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: [
              'kms:Decrypt',
              'kms:Encrypt',
              'kms:DescribeKey',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:CreateGrant',
              'kms:RetireGrant',
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [Match.anyValue(), 'Arn'],
            },
          }),
        ]),
      },
    });
  });

  test('Tests checks if users has access to EC2 actions', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'ec2:CreateNetworkInterface',
              'ec2:CreateNetworkInterfacePermission',
              'ec2:CreateVpcEndpoint',
              'ec2:DeleteNetworkInterface',
              'ec2:DeleteNetworkInterfacePermission',
              'ec2:DescribeDhcpOptions',
              'ec2:DescribeNetworkInterfaces',
              'ec2:DescribeRouteTables',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeSubnets',
              'ec2:DescribeVpcEndpoints',
              'ec2:DescribeVpcs',
              'elasticfilesystem:DescribeFileSystems',
              'elasticfilesystem:DescribeMountTargets',
            ],
            Effect: 'Allow',
            Resource: '*',
            Sid: 'sagemakerEc2policy',
          },
        ]),
      },
    });
  });

  test('Tests checks if users has access to EC2 actions', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              's3:GetObject',
              's3:GetObjectAcl',
              's3:GetObjectTagging',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:PutObjectTagging',
              's3:DeleteObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:ListBucketMultipartUploads',
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  {
                    'Fn::GetAtt': [Match.anyValue(), 'Arn'],
                  },
                  '/*',
                ],
              ],
            },
            Sid: 'sagemakerS3Getpolicy',
          },
        ]),
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: ['s3:ListBucket', 's3:GetBucketLocation'],
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [Match.anyValue(), 'Arn'],
            },
            Sid: 'sagemakerS3ListBucketpolicy',
          },
        ]),
      },
    });
  });

  //Create
  test('Tests checks sagemaker studio create actions', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'sagemaker:DescribeApp',
              'sagemaker:DescribeDomain',
              'sagemaker:DeleteApp',
              'sagemaker:CreateApp',
              'sagemaker:DescribeUserProfile',
              'sagemaker:DescribeSpace',
              'sagemaker:DescribeStudioLifecycleConfig',
              'sagemaker:ListStudioLifecycleConfigs',
              'sagemaker:Search',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: [
              'sagemaker:CreateDataQualityJobDefinition',
              'sagemaker:CreateHyperParameterTuningJob',
              'sagemaker:CreateModelBiasJobDefinition',
              'sagemaker:CreateModelQualityJobDefinition',
              'sagemaker:CreateMonitoringSchedule',
              'sagemaker:CreateProcessingJob',
              'sagemaker:CreateTrainingJob',
              'sagemaker:CreateTransformJob',
            ],
            Condition: {
              StringEquals: {
                'aws:RequestTag/DomainName': 'test',
              },
              ArnEquals: {
                'sagemaker:VolumeKmsKey': {
                  'Fn::GetAtt': [Match.anyValue(), 'Arn'],
                },
              },
            },
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: [
              'sagemaker:CreateExperiment',
              'sagemaker:CreateModelCard',
              'sagemaker:CreateModelPackage',
              'sagemaker:CreateModelPackageGroup',
              'sagemaker:CreatePipeline',
              'sagemaker:CreateTrial',
              'sagemaker:CreateTrialComponent',
              'sagemaker:CreateModel',
            ],
            Condition: {
              StringEquals: {
                'aws:RequestTag/DomainName': 'test',
              },
            },
            Effect: 'Allow',
            Resource: '*',
          },
        ]),
      },
    });
  });

  test('Tests checks sagemaker studio describe and delete actions', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    //Delete, Describe actions
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'sagemaker:BatchDescribeModelPackage',
              'sagemaker:DescribeDataQualityJobDefinition',
              'sagemaker:DescribeExperiment',
              'sagemaker:DescribeHyperParameterTuningJob',
              'sagemaker:DescribeInferenceExperiment',
              'sagemaker:DescribeImageVersion',
              'sagemaker:DescribeModel',
              'sagemaker:GetModelPackageGroupPolicy',
              'sagemaker:DescribeAppImageConfig',
              'sagemaker:DescribeModelPackage',
              'sagemaker:DescribeModelPackageGroup',
              'sagemaker:DescribeModelCardExportJob',
              'sagemaker:DescribeModelQualityJobDefinition',
              'sagemaker:DescribeMonitoringSchedule',
              'sagemaker:DescribePipeline',
              'sagemaker:DescribeProcessingJob',
              'sagemaker:DescribeTrainingJob',
              'sagemaker:DescribeTransformJob',
              'sagemaker:DescribeTrial',
              'sagemaker:DescribeTrialComponent',
              'sagemaker:DescribeArtifact',
              'sagemaker:DescribeEndpoint',
              'sagemaker:DescribeEndpointConfig',
              'sagemaker:ListModelCardExportJobs',
              'sagemaker:ListModelCardVersions',
              'sagemaker:ListModelPackages',
              'sagemaker:DeleteDataQualityJobDefinition',
              'sagemaker:DeleteEndpoint',
              'sagemaker:DeleteEndpointConfig',
              'sagemaker:DeleteExperiment',
              'sagemaker:DeleteInferenceExperiment',
              'sagemaker:DeleteModel',
              'sagemaker:DeleteModelBiasJobDefinition',
              'sagemaker:DeleteModelCard',
              'sagemaker:DeleteModelExplainabilityJobDefinition',
              'sagemaker:DeleteModelPackage',
              'sagemaker:DeleteModelPackageGroup',
              'sagemaker:DeleteModelPackageGroupPolicy',
              'sagemaker:DeleteModelQualityJobDefinition',
              'sagemaker:DeleteMonitoringSchedule',
              'sagemaker:DeletePipeline',
              'sagemaker:DeleteRecord',
              'sagemaker:DeleteTrial',
              'sagemaker:DeleteTrialComponent',
            ],
            Effect: 'Allow',
            Condition: {
              StringEquals: {
                'aws:ResourceTag/DomainName': 'test',
              },
            },
            Resource: '*',
          },
        ]),
      },
    });
  });

  //Update
  test('Tests checks sagemaker studio update actions', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'sagemaker:StartMonitoringSchedule',
              'sagemaker:StartPipelineExecution',
              'sagemaker:StopHyperParameterTuningJob',
              'sagemaker:StopPipelineExecution',
              'sagemaker:StopProcessingJob',
              'sagemaker:StopTrainingJob',
              'sagemaker:StopTransformJob',
              'sagemaker:UpdateExperiment',
              'sagemaker:UpdateEndPoint',
              'sagemaker:UpdateInferenceExperiment',
              'sagemaker:UpdateModelCard',
              'sagemaker:UpdateModelPackage',
              'sagemaker:UpdateMonitoringSchedule',
              'sagemaker:UpdatePipeline',
              'sagemaker:UpdatePipelineExecution',
              'sagemaker:UpdateTrainingJob',
              'sagemaker:UpdateTrial',
              'sagemaker:UpdateTrialComponent',
              'sagemaker:AssociateTrialComponent',
              'sagemaker:DisassociateTrialComponent',
            ],
            Effect: 'Allow',
            Condition: {
              StringEquals: {
                'aws:ResourceTag/DomainName': 'test',
              },
            },
            Resource: '*',
          },
        ]),
      },
    });
  });

  //List
  test('Tests checks sagemaker studio list actions', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );

    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'sagemaker:DescribePipelineDefinitionForExecution',
              'sagemaker:ListDataQualityJobDefinitions',
              'sagemaker:ListModelBiasJobDefinitions',
              'sagemaker:ListModelCards',
              'sagemaker:ListModelExplainabilityJobDefinitions',
              'sagemaker:ListModelMetadata',
              'sagemaker:ListModelPackageGroups',
              'sagemaker:ListModelQualityJobDefinitions',
              'sagemaker:ListModels',
              'sagemaker:ListMonitoringSchedules',
              'sagemaker:ListProcessingJobs',
              'sagemaker:ListPipelineExecutionSteps',
              'sagemaker:ListPipelineExecutions',
              'sagemaker:ListTrainingJobs',
              'sagemaker:ListTrialComponents',
              'sagemaker:ListTrials',
              'sagemaker:ListAssociations',
            ],
            Effect: 'Allow',
            Resource: '*',
          },
        ]),
      },
    });
  });

  //AddTags
  test('Tests checks sagemaker studio add tags actions', () => {
    const executionRole = new SageMakerExecutionRole(
      stack,
      'test-execution-role',
      {
        account: '1111111111111',
        region: 'eu-central-1',
        domainName: 'test',
        kmsKey: encryptionkey,
        dataBucketArn,
      }
    );
    Template.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: 'sagemaker:AddTags',
            Effect: 'Allow',
            Resource: 'arn:aws:sagemaker:eu-central-1:1111111111111:*/*',
            Condition: {
              Null: {
                'sagemaker:TaggingAction': false,
              },
            },
          },
        ]),
      },
    });
  });
});
