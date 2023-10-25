#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { InfrastructureStack } from './infrastructureStack';
import {
  SageMakerStackProps,
  SagemakerStudioStack,
} from './sagemakerStudioStack';
import { SagemakerLoginStack } from './sagemakerLoginStack';
import { CognitoUserProps, CognitoUserStack } from './cognitoUserStack';

//This is the standard callback url is for OAuth postman client.
export const postmanDemoCallbackUrl =
  'https://oauth.pstmn.io/v1/browser-callback';

const main = (app: App): void => {
  const account = app.node.tryGetContext('account');
  const region = app.node.tryGetContext('region');
  const domainName = app.node.tryGetContext('domain-name');
  const userName = app.node.tryGetContext('user');
  const userPassword = app.node.tryGetContext('password');

  const infrastructureStack = new InfrastructureStack(
    app,
    'infrastructure-stack',
    {
      env: { account, region },
    }
  );

  const vpc = infrastructureStack.getVpc();

  const loginStack = new SagemakerLoginStack(app, 'sagemaker-login-stack', {
    env: { account, region },
    vpc: infrastructureStack.getVpc(),
    callbackUrls: [postmanDemoCallbackUrl],
  });

  const sageMakerStackProps: SageMakerStackProps = {
    vpc,
    domainName,
    userDataBucketName: `user-data-bucket-${domainName}`,
    env: { account, region },
    cognitoUserPoolId: loginStack.getCognitoUserPoolId(),
    userProfileName: userName,
  };

  const sageMakerStack = new SagemakerStudioStack(
    app,
    'sagemaker-studio-stack',
    sageMakerStackProps
  );
  sageMakerStack.addDependency(infrastructureStack);
  sageMakerStack.addDependency(loginStack);

  const cognitoDemoUserProps: CognitoUserProps = {
    env: { account, region },
    userPoolId: loginStack.getCognitoUserPoolId(),
    groupName: sageMakerStack.getCognitoGroupName(),
    userName,
    userPassword,
  };
  const cognitoDemoUsersStack = new CognitoUserStack(
    app,
    'cognitoDemoUsers',
    cognitoDemoUserProps
  );
  cognitoDemoUsersStack.node.addDependency(sageMakerStack);
  cognitoDemoUsersStack.node.addDependency(infrastructureStack);
  cognitoDemoUsersStack.node.addDependency(loginStack);
};

export default main;

if (require.main === module) {
  const app = new App();
  main(app);
}
