import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { IpAddresses, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { SagemakerKmsKey } from '../src/sagemakerKmsKey';
import { SagemakerDomain, SagemakerDomainProps } from '../src/sagemakerDomain';

describe('Sagemaker Domain test suite', () => {
  let sagemakerDomainStack: Stack;
  let vpc: Vpc;
  let kmsKey: IKey;

  //initializes stack during each test. Region is eu-central-1
  beforeEach(() => {
    sagemakerDomainStack = new Stack(new App(), 'SagemakerDomainStack');
    kmsKey = new SagemakerKmsKey(sagemakerDomainStack, 'SagemakerKmsKey', {
      domainName: 'team1',
      account: '123232322324232',
    }).getkey();

    vpc = new Vpc(sagemakerDomainStack, 'TestVpc', {
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
  });

  //helper function to create Sagemaker domain
  function createSagemakerDomain(props: SagemakerDomainProps): Template {
    const sagemakerDomain = new SagemakerDomain(sagemakerDomainStack, 'SagemakerDomain', props);
    jest.spyOn(sagemakerDomain, 'getIsolatedSubnetIds').mockReturnValue(['subnet-123456789']);

    const template = Template.fromStack(sagemakerDomainStack);
    return template;
  }

  //Tests
  test('Test Sagemaker domain has DefaultExecutionRole', () => {
    const sagemakerDomainProps: SagemakerDomainProps = {
      domainName: 'demo123',
      vpc,
      account: '11111111111',
      region: 'eu-central-1',
      kmsKey,
    };
    const template = createSagemakerDomain(sagemakerDomainProps);

    // Assertions - 4 roles are created. DefaultExecution role, CustomResource related role and Cloudwatch logRetentio used by custome resoruce
    template.resourceCountIs('AWS::IAM::Role', 4);

    // Assertions - DefaultExecutionRole has correct properties and no managed polices
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'demo123-sagemaker-role',
      AssumeRolePolicyDocument: {},
    });
  });

  test('Test Sagemaker domain security group ingress and egress rules', () => {
    const sagemakerDomainProps: SagemakerDomainProps = {
      domainName: 'ca12345',
      vpc,
      account: '11111111111',
      region: 'eu-central-1',
      kmsKey,
    };
    const template = createSagemakerDomain(sagemakerDomainProps);

    // Assertions - 2 security groups are created one for sagemaker domain
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);

    // Assertions - Security group egress rules for sagemaker
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupName: 'ca12345-sagemakerstudio-domain-sg',
      SecurityGroupEgress: [
        Match.objectLike({
          CidrIp: '0.0.0.0/0',
          Description: 'Allow all outbound traffic by default',
          IpProtocol: '-1',
        }),
      ],
    });

    // Assertions - Security group ingress rules is self referencing for sagemaker
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      SourceSecurityGroupId: { 'Fn::GetAtt': [Match.anyValue(), 'GroupId'] },
      GroupId: { 'Fn::GetAtt': [Match.anyValue(), 'GroupId'] },
      IpProtocol: '-1',
    });
  });

  test('Test Sagemaker domain default settings', () => {
    const sagemakerDomainProps: SagemakerDomainProps = {
      domainName: 'ca12345',
      vpc,
      account: '11111111111',
      region: 'eu-central-1',
      kmsKey,
    };
    const template = createSagemakerDomain(sagemakerDomainProps);

    // Assertions DomainName, AuthMode and NetworkAcessType are correct. VpcId and SubnetIds are not checked if they are referenced correctly
    template.hasResourceProperties('AWS::SageMaker::Domain', {
      AuthMode: 'IAM',
      DomainName: 'ca12345',
      AppNetworkAccessType: 'VpcOnly',
      VpcId: Match.objectLike({ Ref: Match.anyValue() }),
      SubnetIds: Match.arrayWith([Match.objectLike({ Ref: Match.anyValue() })]),
    });
  });

  test('Test Sagemaker user settings', () => {
    const sagemakerDomainProps: SagemakerDomainProps = {
      domainName: 'ca12345',
      vpc,
      account: '11111111111',
      region: 'eu-central-1',
      kmsKey,
    };
    const template = createSagemakerDomain(sagemakerDomainProps);

    // Assertions - Instance type is set to ml.t3.medium
    template.hasResourceProperties('AWS::SageMaker::Domain', {
      DefaultUserSettings: {
        ExecutionRole: { 'Fn::GetAtt': [Match.anyValue(), 'Arn'] },
        JupyterServerAppSettings: {
          DefaultResourceSpec: {
            SageMakerImageArn: 'arn:aws:sagemaker:eu-central-1:936697816551:image/jupyter-server-3',
          },
        },
        KernelGatewayAppSettings: {
          DefaultResourceSpec: { InstanceType: 'ml.t3.medium' },
        },
        SecurityGroups: [{ 'Fn::GetAtt': [Match.anyValue(), 'GroupId'] }],
      },
    });
  });

  test('Test Sagemaker lifecycle handler config', () => {
    const sagemakerDomainProps: SagemakerDomainProps = {
      domainName: 'ca12345',
      vpc,
      account: '11111111111',
      region: 'eu-central-1',
      kmsKey,
    };
    const template = createSagemakerDomain(sagemakerDomainProps);

    // Assertions - 4 lifecycle handler configs are created. More elaborate test on LifeCycleConfigHandler.spec.ts
    template.resourceCountIs('Custom::AWS', 4);
  });
});
