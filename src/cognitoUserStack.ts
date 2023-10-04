import { Annotations, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnUserPoolUser, CfnUserPoolUserToGroupAttachment } from 'aws-cdk-lib/aws-cognito';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';

export interface CognitoUserProps extends StackProps {
  env: { account: string; region: string };
  userPoolId: string;
  groupName: string;
  userName: string;
  userPassword: string;
}

/**
 * High level construct that creates demo user in cognito user pool for testing purposes
 */
export class CognitoUserStack extends Stack {
  constructor(scope: Construct, id: string, props: CognitoUserProps) {
    super(scope, id, props);

    if (props.userName === undefined || props.userPassword === undefined || props.groupName === undefined) {
      Annotations.of(this).addError('One of the required parameters user, password or domain-name is not set');
    }
    const demoUser = new CfnUserPoolUser(this, 'DemoUser', {
      userPoolId: props.userPoolId,
      messageAction: 'SUPPRESS',
      userAttributes: [
        {
          name: 'name',
          value: props.userName,
        },
      ],
      username: props.userName,
    });

    const passwordParams = {
      UserPoolId: props.userPoolId,
      Username: props.userName,
      Permanent: true,
      Password: props.userPassword,
    };

    const demoUserPassword = new AwsCustomResource(this, 'demoUserPassword', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: passwordParams,
        physicalResourceId: PhysicalResourceId.of(`demoUserPassword-${props.userPassword}`),
      },
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: passwordParams,
        physicalResourceId: PhysicalResourceId.of(`demoUserPassword-${props.userPassword}`),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: AwsCustomResourcePolicy.ANY_RESOURCE }),
      installLatestAwsSdk: false,
    });

    //attaches user to cognito group which corresponds to the domain name (team1, team2...)
    const demoUserGroup = new CfnUserPoolUserToGroupAttachment(this, 'attachUserToGroup', {
      userPoolId: props.userPoolId,
      groupName: props.groupName,
      username: props.userName,
    });

    demoUserGroup.node.addDependency(demoUser);
    demoUserPassword.node.addDependency(demoUser);
  }
}
