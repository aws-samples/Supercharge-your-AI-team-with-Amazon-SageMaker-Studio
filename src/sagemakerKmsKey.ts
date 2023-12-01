import { RemovalPolicy } from 'aws-cdk-lib';
import {
  ArnPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface SagemakerKmsKeyProps {
  readonly domainName: string;
  readonly account: string;
}

/**
 * The construct creates KMS key for use within Sagemaker domain.
 * For each domain there is a separate KMS key.
 *
 */
export class SagemakerKmsKey extends Construct {
  private key: Key;

  constructor(scope: Construct, id: string, props: SagemakerKmsKeyProps) {
    super(scope, id);

    const policy = new PolicyDocument();
    const adminRoleArn = `arn:aws:iam::${props.account}:root`;
    policy.addStatements(this.grantAdminAccess(adminRoleArn));

    this.key = new Key(this, 'SagemakerKmsKey', {
      alias: props.domainName,
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.RETAIN,
      policy,
    });
  }

  public getkey(): Key {
    return this.key;
  }

  private grantAdminAccess = (roleArn: string) => {
    const arnPrincipal = new ArnPrincipal(roleArn);
    return new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['kms:*'],
      resources: ['*'],
      principals: [arnPrincipal],
    });
  };

  public grantAccessToUserRole(roleArn: string) {
    const arnPrincipal = new ArnPrincipal(roleArn);
    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:Encrypt',
        'kms:ReEncrypt*',
        'kms:GenerateDataKey*',
        'kms:DescribeKey',
      ],
      resources: ['*'],
      principals: [arnPrincipal],
    });
    this.key.addToResourcePolicy(policy);
  }
}
