import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SagemakerKmsKey } from './sagemakerKmsKey';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SagemakerDomain } from './sagemakerDomain';
import { CfnUserPoolGroup } from 'aws-cdk-lib/aws-cognito';
import { Bucket, StorageClass } from 'aws-cdk-lib/aws-s3';
import { Annotations, Duration, Tags } from 'aws-cdk-lib';
import { CfnUserProfile } from 'aws-cdk-lib/aws-sagemaker';
import { SageMakerExecutionRole } from './sagemakerExecutionRole';

export interface SageMakerStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  domainName: string;
  userDataBucketName: string;
  env: { account: string; region: string };
  cognitoUserPoolId: string;
  userProfileName: string;
}

export class SagemakerStudioStack extends cdk.Stack {
  private readonly cognitoGroupName: string;
  constructor(scope: Construct, id: string, props: SageMakerStackProps) {
    super(scope, id, props);

    Annotations.of(this).addInfo(`Domain name ${props.domainName}`);
    //Added tags thats inherited by all resources in the stack
    Tags.of(this).add('DomainName', props.domainName);

    // **********************************************************************************************************************
    //  KMS key for Sagemaker domain
    // **********************************************************************************************************************
    const sagemakerKms = new SagemakerKmsKey(this, 'SagemakerCMKForDomain', {
      domainName: props.domainName,
      account: props.env.account,
    });

    // **********************************************************************************************************************
    // Create a data bucket for the domain users for processing jobs.
    // **********************************************************************************************************************

    new Bucket(this, 'SagemakerDataBucket', {
      bucketName: props.userDataBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: sagemakerKms.getkey(),
      versioned: true,
      serverAccessLogsBucket: new Bucket(
        this,
        '${props.userDataBucketName}-access-logs'
      ),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
    });

    // **********************************************************************************************************************
    // Create cognito user group for this domain
    // **********************************************************************************************************************
    const cognitoGroupName = props.domainName;
    const cognitoUserGroup = new CfnUserPoolGroup(this, 'CognitoUserGroup', {
      userPoolId: props.cognitoUserPoolId,
      description: `Cognito User Group for the Sagemaker Studio users for order with customer ${props.domainName}`,
      groupName: cognitoGroupName,
    });
    cognitoUserGroup.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // **********************************************************************************************************************
    // Sagemaker Studio Domain
    // **********************************************************************************************************************
    const sgDomain = new SagemakerDomain(this, 'SagemakerStudioDomain', {
      domainName: props.domainName,
      vpc: props.vpc,
      account: props.env.account,
      region: props.env.region,
      kmsKey: sagemakerKms.getkey(),
    });

    // **********************************************************************************************************************
    // Sagemaker Execution Role (assumed by the end user)
    // **********************************************************************************************************************
    const sagemakerExecutionRole = new SageMakerExecutionRole(
      this,
      'SagemakerStudioExecutionRole',
      {
        account: props.env.account,
        domainName: props.domainName,
        kmsKey: sagemakerKms.getkey(),
      }
    );

    // **********************************************************************************************************************
    // Sagemaker User Profile
    // **********************************************************************************************************************
    new CfnUserProfile(this, 'UserProfile', {
      domainId: sgDomain.getDomainId(),
      userProfileName: props.userProfileName,
      userSettings: {
        executionRole: sagemakerExecutionRole.getRole().roleArn,
      },
    });

    //Ensures key policy is updated to allow only Sagemaker execution role to perform encrypt decrypt action
    sagemakerKms.updateKeyPolicy(sagemakerExecutionRole.getRole().roleArn);
    this.cognitoGroupName = cognitoGroupName;
  }

  public getCognitoGroupName() {
    return this.cognitoGroupName;
  }
}
