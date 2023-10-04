import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { LifeCycleConfigHandler, LifeCycleConfigProps } from '../src/lifeCycleConfigHandler';

describe('Lifecycle config handler test suites', () => {
  let lifeCycleConfigStack: Stack;

  //initializes stack during each test. Region is eu-central-1
  beforeEach(() => {
    lifeCycleConfigStack = new Stack(new App(), 'TestStackForLifeCycleHandler', {
      env: { account: '11111111111', region: 'eu-central-1' },
    });

  });

  //helper function to create lifecycle config handler
  function createLifeCycleConfigHandler(props: LifeCycleConfigProps): Template {
    new LifeCycleConfigHandler(lifeCycleConfigStack, 'LifeCycleConfigHandler', props);
    const template = Template.fromStack(lifeCycleConfigStack);
    return template;
  }

  //Tests
  test('Test Sagemaker LifeCycleHandler creates 2 custom resources for creating and updating lifecycle config', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - 2 custom resources are created
    template.resourceCountIs('Custom::AWS', 2);
  });

  test('Test number of lambdas created are correct', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - 2 lambdas are created. Custome resource and for Loge retention
    template.resourceCountIs('AWS::Lambda::Function', 2);
  });

  test('Test Sagemaker lifecycle handler calls SDK with proper parameters', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - Creation of lifecycle config using the AWS Custom resource via SDK calls
    template.hasResourceProperties('Custom::AWS', {
      ServiceToken: { 'Fn::GetAtt': [Match.anyValue(), 'Arn'] },
      //SDK call to create lifecycle config
      Create:
        '{"service":"SageMaker","action":"createStudioLifecycleConfig","parameters":{"StudioLifecycleConfigAppType":"JupyterServer","StudioLifecycleConfigContent":"echo hello world","StudioLifecycleConfigName":"jupyter-server-config"},"physicalResourceId":{"id":"demo123"}}',
      Delete:
        '{"service":"SageMaker","action":"deleteStudioLifecycleConfig","parameters":{"StudioLifecycleConfigName":"jupyter-server-config"},"physicalResourceId":{"id":"jupyter-server-config"}}',
    });
  });

  test('Test Sagemaker lifecycle handler dependencies', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - Custom resource for UpdateDomain depends on CreateLifecycleConfig
    template.hasResource('Custom::AWS', {
      DependsOn: [Match.stringLikeRegexp('^LifeCycleConfigHandler*')],
      DeletionPolicy: 'Delete',
    });
  });

  test('Test Sagemaker lifecycle handler update domain SDK call for JupyterServer', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'ca12345',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - Creation of lifecycle config using the AWS Custom resource via SDK calls
    template.hasResourceProperties('Custom::AWS', {
      //SDK call to update domain and attach lifecycle config. Asserts parameters like DomainId, DefaultUserSettings are passed correctly
      Update: {
        'Fn::Join': [
          '',
          [
            '{"service":"SageMaker","action":"updateDomain","parameters":{"DomainId":"ca12345","DefaultUserSettings":{"JupyterServerAppSettings":{"DefaultResourceSpec":{"InstanceType":"system","LifecycleConfigArn":"',
            {
              'Fn::GetAtt': [Match.anyValue(), 'StudioLifecycleConfigArn'],
            },
            '"},"LifecycleConfigArns":["',
            {
              'Fn::GetAtt': [Match.anyValue(), 'StudioLifecycleConfigArn'],
            },
            '"]}}},"physicalResourceId":{"id":"jupyter-server-config"}}',
          ],
        ],
      },
    });
  });

  test('Test Sagemaker lifecycle handler update domain SDK call for Kernelgateway', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'kernel-gateway-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'KernelGateway',
      sagemakerDomainId: 'ca12345',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - Creation of lifecycle config using the AWS Custom resource via SDK calls
    template.hasResourceProperties('Custom::AWS', {
      //SDK call to update domain and attach lifecycle config. Asserts parameters like DomainId, DefaultUserSettings are passed correctly
      Update: {
        'Fn::Join': [
          '',
          [
            '{"service":"SageMaker","action":"updateDomain","parameters":{"DomainId":"ca12345","DefaultUserSettings":{"KernelGatewayAppSettings":{"DefaultResourceSpec":{"InstanceType":"ml.t3.medium","LifecycleConfigArn":"',
            {
              'Fn::GetAtt': [Match.anyValue(), 'StudioLifecycleConfigArn'],
            },
            '"},"LifecycleConfigArns":["',
            {
              'Fn::GetAtt': [Match.anyValue(), 'StudioLifecycleConfigArn'],
            },
            '"]}}},"physicalResourceId":{"id":"kernel-gateway-config"}}',
          ],
        ],
      },
    });
  });

  test('Test lambda associated with custom-resource uses proper assume role permission', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - 2 Roles created one for Custom resource role and another for LogRetention (implicitly)
    template.resourceCountIs('AWS::IAM::Role', 2);

    // Assertions - Custom resource role has correct permissions and could only be assumed by lambda service
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: `ca1234-jupyterserver-lc-handler-role`,
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
          },
        ],
      },
    });

    // Assertions - Custom resource role has correct permission to invoke a specific lambda function
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('^LifeCycleConfigHandler*'),
      PolicyDocument: {
        Statement: [
          {
            Action: 'lambda:InvokeFunction',
            Effect: 'Allow',
            Resource: 'arn:aws:lambda:eu-central-1:111111111:function:ca1234-*-lc',
          },
          {
            Action: 'sagemaker:*',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
      },
      Roles: [{ Ref: Match.stringLikeRegexp('^LifeCycleConfigHandler*') }],
    });
  });

  test('Test custom resource role and permissions to create lifecycle config policy', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'd-9999',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - Custom resource role has correct permission to create lifecycle config
    template.hasResourceProperties('AWS::IAM::Policy', {
      // PolicyName: Match.stringLikeRegexp('^LifeCycleConfigHandler*'),
      PolicyDocument: {
        Statement: [
          {
            Action: 'sagemaker:CreateStudioLifecycleConfig',
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: 'sagemaker:DescribeStudioLifecycleConfig',
            Effect: 'Allow',
            Resource: '*',
          },
          {
            Action: 'sagemaker:DeleteStudioLifecycleConfig',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
      },
    });
  });

  test('Test custom resource role and permissions to update domain and attach lifecycle policy', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'jupyter-server-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - Custom resource role has correct permission to update specific domain
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('^LifeCycleConfigHandler*'),
      PolicyDocument: {
        Statement: [{ Action: 'sagemaker:UpdateDomain', Effect: 'Allow', Resource: '*' }],
      },
      Roles: [{ Ref: Match.stringLikeRegexp('^LifeCycleConfigHandler*') }],
    });
  });

  test('Test Sagemaker lifecycle handler calls SDK with proper parameters for kernelgateway', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'kernel-gateway-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'KernelGateway',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - Creation of lifecycle config using the AWS Custom resource via SDK calls
    template.hasResourceProperties('Custom::AWS', {
      ServiceToken: { 'Fn::GetAtt': [Match.anyValue(), 'Arn'] },
      //SDK call to create lifecycle config
      Create:
        '{"service":"SageMaker","action":"createStudioLifecycleConfig","parameters":{"StudioLifecycleConfigAppType":"KernelGateway","StudioLifecycleConfigContent":"echo hello world","StudioLifecycleConfigName":"kernel-gateway-config"},"physicalResourceId":{"id":"demo123"}}',
      Delete:
        '{"service":"SageMaker","action":"deleteStudioLifecycleConfig","parameters":{"StudioLifecycleConfigName":"kernel-gateway-config"},"physicalResourceId":{"id":"kernel-gateway-config"}}',
    });
  });

  test('Test lambda associated with custom-resource uses proper assume role permission for kernel gateway', () => {
    const lifecycleConfigProps: LifeCycleConfigProps = {
      lifecycleConfigName: 'kernel-gateway-config',
      lifecycleScript: 'echo hello world',
      lifecycleAppType: 'KernelGateway',
      sagemakerDomainId: 'demo123',
      account: '111111111',
      region: 'eu-central-1',
      domainName: 'ca1234',
    };
    const template = createLifeCycleConfigHandler(lifecycleConfigProps);

    // Assertions - 2 Roles created one for Custom resource role and another for LogRetention (implicitly)
    template.resourceCountIs('AWS::IAM::Role', 2);

    // Assertions - Custom resource role has correct permissions and could only be assumed by lambda service
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: `ca1234-kernelgateway-lc-handler-role`,
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
          },
        ],
      },
    });
  });
});
