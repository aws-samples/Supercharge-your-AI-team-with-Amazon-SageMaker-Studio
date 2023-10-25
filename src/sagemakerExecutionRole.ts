import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { IKey } from 'aws-cdk-lib/aws-kms';

export interface SageMakerExecutionRoleProps {
  account: string;
  domainName: string;
  kmsKey: IKey;
}

export class SageMakerExecutionRole extends Construct {
  private executionRoleArn: string;
  private executionRole: Role;

  constructor(
    scope: Construct,
    id: string,
    props: SageMakerExecutionRoleProps
  ) {
    super(scope, id);

    const cwLogsPolicy = new iam.PolicyStatement({
      actions: [
        'logs:CreateLogDelivery',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:DeleteLogDelivery',
        'logs:Describe*',
        'logs:GetLogDelivery',
        'logs:GetLogEvents',
        'logs:ListLogDeliveries',
        'logs:PutLogEvents',
        'logs:PutResourcePolicy',
        'logs:UpdateLogDelivery',
      ],
      resources: [
        `arn:aws:logs:eu-central-1:${props.account}:log-group:/aws/sagemaker/*`,
        `arn:aws:logs:eu-central-1:${props.account}:log-stream:*`,
      ],
    });

    const createDeleteAppPolicy = new iam.PolicyStatement({
      actions: [
        'sagemaker:DescribeApp',
        'sagemaker:DescribeDomain',
        'sagemaker:DeleteApp',
        'sagemaker:CreateApp',
        'sagemaker:DescribeUserProfile',
        'sagemaker:DescribeStudioLifecycleConfig',
        'sagemaker:ListStudioLifecycleConfigs',
        'sagemaker:Search',
      ],
      resources: ['*'],
    });
    const createJobs = (domainName: string, keyArn: string) => {
      return new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [
          'sagemaker:CreateDataQualityJobDefinition',
          'sagemaker:CreateHyperParameterTuningJob',
          'sagemaker:CreateModelBiasJobDefinition',
          'sagemaker:CreateModelQualityJobDefinition',
          'sagemaker:CreateMonitoringSchedule',
          'sagemaker:CreateProcessingJob',
          'sagemaker:CreateTrainingJob',
          'sagemaker:CreateTransformJob',
          'sagemaker:CreateDataQualityJobDefinition',
          'sagemaker:CreateHyperParameterTuningJob',
          'sagemaker:CreateModelBiasJobDefinition',
          'sagemaker:CreateModelQualityJobDefinition',
          'sagemaker:CreateMonitoringSchedule',
          'sagemaker:CreateProcessingJob',
          'sagemaker:CreateTrainingJob',
          'sagemaker:CreateTransformJob',
          'sagemaker:CreateModel',
        ],
        conditions: {
          StringEquals: {
            'aws:RequestTag/Domain': domainName,
          },
          ArnEquals: {
            'sagemaker:VolumeKmsKey': keyArn,
          },
        },
      });
    };

    const createAdditionalJobs = (domainName: string) => {
      return new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [
          'sagemaker:CreateExperiment',
          'sagemaker:CreateModelCard',
          'sagemaker:CreateModelPackage',
          'sagemaker:CreateModelPackageGroup',
          'sagemaker:CreatePipeline',
          'sagemaker:CreateTrial',
          'sagemaker:CreateTrialComponent',
        ],
        conditions: {
          StringEquals: {
            'aws:RequestTag/Domain': domainName,
          },
        },
      });
    };

    const describeOrDeleteJobs = (domainName: string) => {
      return new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [
          'sagemaker:BatchDescribeModelPackage',
          'sagemaker:DescribeDataQualityJobDefinition',
          'sagemaker:DescribeExperiment',
          'sagemaker:DescribeHyperParameterTuningJob',
          'sagemaker:DescribeInferenceExperiment',
          'sagemaker:DescribeModel',
          'sagemaker:GetModelPackageGroupPolicy',
          'sagemaker:DescribeModelPackage',
          'sagemaker:DescribeModelPackageGroup',
          'sagemaker:DescribeModelQualityJobDefinition',
          'sagemaker:DescribeMonitoringSchedule',
          'sagemaker:DescribePipeline',
          'sagemaker:DescribeProcessingJob',
          'sagemaker:DescribeTrainingJob',
          'sagemaker:DescribeTransformJob',
          'sagemaker:DescribeTrial',
          'sagemaker:DescribeTrialComponent',
          'sagemaker:DescribeArtifact',
          'sagemaker:ListModelCardExportJobs',
          'sagemaker:ListModelCardVersions',
          'sagemaker:ListModelPackages',
          'sagemaker:DeleteDataQualityJobDefinition',
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
        conditions: {
          StringEquals: {
            'aws:ResourceTag/Domain': domainName,
          },
        },
      });
    };

    const listAdditionalJobs = () => {
      return new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [
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
          'sagemaker:ListTraninigJobsForHyperParameterTuningJob',
          'sagemaker:ListTrialComponents',
          'sagemaker:ListTrials',
          'sagemaker:ListAssociations',
        ],
      });
    };

    const updateJobs = (domainName: string) => {
      return new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [
          'sagemaker:StartMonitoringSchedule',
          'sagemaker:StartPipelineExecution',
          'sagemaker:StopHyperParameterTuningJob',
          'sagemaker:StopPipelineExecution',
          'sagemaker:StopProcessingJob',
          'sagemaker:StopTrainingJob',
          'sagemaker:StopTransformJob',
          'sagemaker:UpdateExperiment',
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

        conditions: {
          StringEquals: {
            'aws:ResourceTag/Domain': domainName,
          },
        },
      });
    };

    const kmsPolicy = new iam.PolicyStatement({
      actions: [
        'kms:Decrypt',
        'kms:Encrypt',
        'kms:DescribeKey',
        'kms:ReEncrypt*',
        'kms:GenerateDataKey*',
        'kms:CreateGrant',
        'kms:RetireGrant',
      ],
      resources: [props.kmsKey.keyArn],
      sid: 'sagemakerkmsPolicy',
    });

    const kmsListPolicy = new iam.PolicyStatement({
      actions: ['kms:ListAliases'],
      resources: ['*'],
      sid: 'sagemakerkmsListPolicy',
    });

    const ec2Policy = new iam.PolicyStatement({
      actions: [
        'ec2:CreateNetworkInterface',
        'ec2:CreateNetworkInterfacePermission',
        'ec2:DeleteNetworkInterface',
        'ec2:DeleteNetworkInterfacePermission',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DescribeVpcs',
        'ec2:DescribeDhcpOptions',
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeVpcEndpoints',
      ],
      resources: ['*'],
      sid: 'sagemakerEc2policy',
    });

    new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: ['*'],
      sid: 'sagemakerS3policy',
    });

    const iamPassPolicy = new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: ['*'],
      sid: 'sagemakerPassRolepolicy',
      conditions: {
        StringEquals: {
          'iam:PassedToService': 'sagemaker.amazonaws.com',
        },
      },
    });

    new iam.PolicyStatement({
      actions: [
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
      resources: ['arn:aws:ecr:*:*:repository/*'],
      sid: 'sagemakerEcrPolicy',
    });

    const denySageMakerPolicy = new iam.PolicyStatement({
      actions: [
        'sagemaker:CreateDomain',
        'sagemaker:UpdateDomain',
        'sagemaker:CreateUserProfile',
        'sagemaker:UpdateUserProfile',
      ],
      resources: ['*'],
      sid: 'denySageMakerPolicy',
    });

    const executionRole = new iam.Role(this, 'SageMakerStudioExecutionRole', {
      assumedBy: new iam.CompositePrincipal(
        new ServicePrincipal('sagemaker.amazonaws.com'),
        new ServicePrincipal('events.amazonaws.com')
      ),
      roleName: `${props.domainName}-sagemaker-role`,
    });

    const allowAssumeRoleOrganizationAccount = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: ['sts:AssumeRole'],
      conditions: {
        StringEquals: {
          'aws:ResourceOrgID': '${aws:PrincipalOrgID}',
        },
      },
    });

    const denyAssumeRoleSameAccount = new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      resources: ['*'],
      actions: ['sts:AssumeRole'],
      conditions: {
        StringEquals: {
          'aws:ResourceAccount': '${aws:PrincipalAccount}',
        },
      },
    });

    const notebookSchedulerPolicy = new iam.PolicyStatement({
      actions: [
        'events:DeletRule',
        'events:PutTargets',
        'events:RemoveTargets',
        'events:DescribeRule',
        'events:EnableRule',
        'events:DisableRule',
        'events:PutRule',
      ],
      resources: ['*'],
      sid: 'notebookSchedulerPolicy',
    });

    executionRole.addToPolicy(cwLogsPolicy);
    executionRole.addToPolicy(createDeleteAppPolicy);
    executionRole.addToPolicy(
      createJobs(props.domainName, props.kmsKey.keyArn)
    );
    executionRole.addToPolicy(createAdditionalJobs(props.domainName));
    executionRole.addToPolicy(describeOrDeleteJobs(props.domainName));
    executionRole.addToPolicy(listAdditionalJobs());
    executionRole.addToPolicy(updateJobs(props.domainName));
    executionRole.addToPolicy(kmsPolicy);
    executionRole.addToPolicy(kmsListPolicy);
    executionRole.addToPolicy(ec2Policy);
    executionRole.addToPolicy(iamPassPolicy);
    executionRole.addToPolicy(denySageMakerPolicy);
    executionRole.addToPolicy(allowAssumeRoleOrganizationAccount);
    executionRole.addToPolicy(denyAssumeRoleSameAccount);
    executionRole.addToPolicy(notebookSchedulerPolicy);

    this.executionRoleArn = executionRole.roleArn;
    this.executionRole = executionRole;
  }

  public getRole() {
    return this.executionRole;
  }
}
