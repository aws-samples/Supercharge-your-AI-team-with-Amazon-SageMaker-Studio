import { Duration } from 'aws-cdk-lib';
import {
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  AwsSdkCall,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface LifeCycleConfigTag {
  Key: string;
  Value: string;
}

export interface LifeCycleConfigProps {
  lifecycleConfigName: string;
  lifecycleScript: string;
  lifecycleAppType: 'JupyterServer' | 'KernelGateway';
  sagemakerDomainId: string;
  account: string;
  region: string;
  domainName: string;
}

/**
 * A custom resource construct for handling LifeCycleConfig for Sagemaker domains
 *
 */
export class LifeCycleConfigHandler extends Construct {
  private lifecycle_arn: string;

  constructor(scope: Construct, id: string, props: LifeCycleConfigProps) {
    super(scope, id);

    const appType = props.lifecycleAppType.toLowerCase();

    const createLifeCycleConfig: AwsSdkCall = {
      service: 'SageMaker',
      action: 'createStudioLifecycleConfig',
      parameters: {
        StudioLifecycleConfigAppType: props.lifecycleAppType,
        StudioLifecycleConfigContent: props.lifecycleScript,
        StudioLifecycleConfigName: props.lifecycleConfigName,
        // Tags: { DomainName: props.domainName },
      },

      physicalResourceId: PhysicalResourceId.of(props.sagemakerDomainId),
    };

    const describeLifecycleConfig: AwsSdkCall = {
      service: 'SageMaker',
      action: 'describeStudioLifecycleConfig',
      outputPaths: ['StudioLifecycleConfigArn'],
      parameters: {
        StudioLifecycleConfigName: props.lifecycleConfigName,
      },

      physicalResourceId: PhysicalResourceId.of(props.lifecycleConfigName),
    };

    const deleteLifeCycleConfig: AwsSdkCall = {
      service: 'SageMaker',
      action: 'deleteStudioLifecycleConfig',
      parameters: {
        StudioLifecycleConfigName: props.lifecycleConfigName,
      },
      physicalResourceId: PhysicalResourceId.of(props.lifecycleConfigName),
    };

    const lambdaRole = new Role(this, `LifeCycleHandlerRole-${appType}`, {
      roleName: `${props.domainName}-${appType}-lc-handler-role`,
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    lambdaRole.addToPolicy(
      new PolicyStatement({
        resources: [
          `arn:aws:lambda:${props.region}:${props.account}:function:${props.domainName}-*-lc`,
        ],
        actions: ['lambda:InvokeFunction'],
      })
    );

    lambdaRole.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['sagemaker:*'],
      })
    );

    //LifeCycle Config custom resource
    const createLifeCycleHandler = new AwsCustomResource(
      this,
      `CreateLifeCycleConfig-${appType}`,
      {
        functionName: `${props.domainName}-${appType}-create-lifecycle-config`,
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
        onCreate: createLifeCycleConfig,
        onUpdate: describeLifecycleConfig,
        onDelete: deleteLifeCycleConfig,
        role: lambdaRole,
        logRetention: RetentionDays.ONE_MONTH,
        timeout: Duration.minutes(5),
        installLatestAwsSdk: false,
      }
    );

    this.lifecycle_arn = createLifeCycleHandler.getResponseField(
      'StudioLifecycleConfigArn'
    );

    const defaultUserSettings = this.getDefaultSettings(
      props.lifecycleAppType,
      this.getStudioLifeCycleArn()
    );

    const updateDomain: AwsSdkCall = {
      service: 'SageMaker',
      action: 'updateDomain',
      parameters: {
        DomainId: props.sagemakerDomainId,
        DefaultUserSettings: defaultUserSettings,
      },
      physicalResourceId: PhysicalResourceId.of(props.lifecycleConfigName),
    };

    const updateDomainCR = new AwsCustomResource(
      this,
      `UpdateDomain-${appType}`,
      {
        functionName: `${props.domainName}-${appType}-update-lc`,
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
        onCreate: updateDomain,
        onUpdate: updateDomain,
        role: lambdaRole,
        logRetention: RetentionDays.ONE_MONTH,
        timeout: Duration.minutes(5),
        installLatestAwsSdk: false,
      }
    );
    updateDomainCR.node.addDependency(createLifeCycleHandler);
  }

  public getStudioLifeCycleArn() {
    return this.lifecycle_arn;
  }

  private getDefaultSettings(appType: string, arn: string) {
    if (appType === 'JupyterServer') {
      return {
        JupyterServerAppSettings: {
          DefaultResourceSpec: {
            InstanceType: 'system',
            LifecycleConfigArn: arn,
          },
          LifecycleConfigArns: [arn],
        },
      };
    } else if (appType === 'KernelGateway') {
      return {
        KernelGatewayAppSettings: {
          DefaultResourceSpec: {
            InstanceType: 'ml.t3.medium',
            LifecycleConfigArn: arn,
          },
          LifecycleConfigArns: [arn],
        },
      };
    } else {
      throw new Error('Invalid app type');
    }
  }
}
