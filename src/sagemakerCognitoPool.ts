import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { OAuthScope, UserPool, UserPoolClient, UserPoolClientIdentityProvider, UserPoolEmail } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface SagemakerCognitoUserPoolProps {
  userPoolName: string;
  email: string;
  cognitoDomainPrefix: string;
  callbackUrls: string[];
  userPoolClientName: string;
}

/**
 * Highl level construct that creates cognito user pool, user pool client and sets authorization scope.
 *
 */
export class SagemakerCognitoUserPool extends Construct {
  private readonly sagemakerUserPool: UserPool;
  constructor(scope: Construct, id: string, props: SagemakerCognitoUserPoolProps) {
    super(scope, id);

    const userPool = new UserPool(this, 'UserPool', {
      userPoolName: props.userPoolName,
      selfSignUpEnabled: false,
      autoVerify: { email: false },
      passwordPolicy: {
        minLength: 8,
      },
      signInAliases: { username: true },
      standardAttributes: {
        phoneNumber: { required: false },
      },
      email: UserPoolEmail.withCognito(props.email),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPoolClientName: props.userPoolClientName,
      userPool,
      enableTokenRevocation: true,
      preventUserExistenceErrors: true,
      generateSecret: true,
      authFlows: {
        custom: true,
        userSrp: true,
      },
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],

      oAuth: {
        scopes: [OAuthScope.OPENID],
        flows: {
          authorizationCodeGrant: true,
        },
        callbackUrls: props.callbackUrls,
      },
    });

    userPool.addClient('sagemaker-app-client', userPoolClient);

    const userPoolDomain = userPool.addDomain('user-pool-domain', {
      cognitoDomain: {
        domainPrefix: props.cognitoDomainPrefix,
      },
    });

    // Export values
    new CfnOutput(this, 'UserPoolClientId', {
      exportName: 'ClientId',
      value: userPoolClient.userPoolClientId,
    });

    new CfnOutput(this, 'UserPoolClientSecret', {
      exportName: 'ClientSecret',
      value: userPoolClient.userPoolClientSecret.toString(),
    });

    new CfnOutput(this, 'CognitoSigninDomain', {
      exportName: 'CognitoSigninDomain',
      value: `https://${userPoolDomain.domainName}.auth.${Stack.of(this).region}.amazoncognito.com/oauth2`,
    });
    this.sagemakerUserPool = userPool;
  }

  public getUserPool() {
    return this.sagemakerUserPool;
  }
}
