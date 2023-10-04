import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SagemakerKmsKey } from '../src/sagemakerKmsKey';

describe('Sagemaker KMS test suite', () => {
  //initializes stack during each test. Region is eu-central-1

  test('Sagemaker KMS key is created along with alias', () => {
    const stack = new Stack(new App(), 'test-stack');

    const kmsKey = new SagemakerKmsKey(stack, 'test', {
      domainName: 'test1',
      account: '123456789012',
    });

    kmsKey.updateKeyPolicy('arn:aws:iam::123456789012:role/test1-some-user');
    expect(kmsKey.getkey()).toBeDefined();

    Template.fromStack(stack).hasResourceProperties('AWS::KMS::Alias', {
      AliasName: 'alias/test1',
      TargetKeyId: { 'Fn::GetAtt': [Match.stringLikeRegexp('^testSagemakerKmsKey*'), 'Arn'] },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
      KeyPolicy: {
        Statement: Match.arrayWith([
          {
            Action: 'kms:*',
            Effect: 'Allow',
            Principal: { AWS: 'arn:aws:iam::123456789012:root' },
            Resource: '*',
          },
          {
            Action: ['kms:Decrypt', 'kms:Encrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
            Effect: 'Allow',
            Resource: '*',
            Principal: {
              AWS: 'arn:aws:iam::123456789012:role/test1-some-user',
            },
          },
        ]),
      },
    });
  });
});
