import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { IpAddresses, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { SagemakerStudioStack } from '../src/sagemakerStudioStack';
describe('Sagemaker Domain Stack test', () => {
  //Tests
  test('Test Sagemaker stack', () => {
    const app = new App();
    const stack = new Stack(app, 'InfraStack', {
      env: {
        region: 'eu-central-1',
        account: '123456789012',
      },
    });
    const vpc = new Vpc(stack, 'TestVpc', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          name: 'isolated-subnet-1',
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      natGateways: 0,
    });

    const studioStack = new SagemakerStudioStack(app, 'SagemakerDomainStack', {
      vpc: vpc,
      domainName: 'test1',
      env: {
        region: 'eu-central-1',
        account: '123456789012',
      },
      cognitoUserPoolId: 'test1-userpool',
      userProfileName: 'test1-userprofile',
    });

    // Assertions -4 (2 custom resource, 1 execution role, 1 log retention)
    Template.fromStack(studioStack).resourceCountIs('AWS::IAM::Role', 5);

    // Assertions -1 Key Alias
    Template.fromStack(studioStack).resourceCountIs('AWS::KMS::Alias', 1);

    //S3 bucket creation
    Template.fromStack(studioStack).hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });

    //Cognito User Group
    Template.fromStack(studioStack).hasResourceProperties(
      'AWS::Cognito::UserPoolGroup',
      {
        GroupName: 'test1',
      }
    );

    //Sagemaker User Profile
    Template.fromStack(studioStack).hasResourceProperties(
      'AWS::SageMaker::UserProfile',
      {
        UserProfileName: 'test1-userprofile',
      }
    );
  });
});
