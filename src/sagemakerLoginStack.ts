import { Annotations, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  AnyPrincipal,
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { SagemakerCognitoUserPool } from './sagemakerCognitoPool';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  EndpointType,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { OAuthScope } from 'aws-cdk-lib/aws-cognito';

export interface SagemakerLoginStackProps extends StackProps {
  vpc: Vpc;
  env: { account: string; region: string };
  callbackUrls: string[];
}
export class SagemakerLoginStack extends Stack {
  private readonly cognitoUserPoolId: string;

  constructor(scope: Construct, id: string, props: SagemakerLoginStackProps) {
    super(scope, id, props);

    Annotations.of(this).addInfo(`Account Id : ${props.env.account}`);
    Annotations.of(this).addInfo(`Region  : ${props.env.region}`);

    if (props.env.account === undefined || props.env.region === undefined) {
      Annotations.of(this).addError(
        'One of the require parameters account, region or callbackUrls is not set'
      );
    }

    const cognitoDomainPrefix = `sagemaker-login-${props.env.account}`;

    //Creates user pool
    const sagemakerCognitoUserPool = new SagemakerCognitoUserPool(
      this,
      'UserPool',
      {
        userPoolName: 'sagemaker-user-pool',
        email: 'noreply@sagemaker-demo.com',
        cognitoDomainPrefix: cognitoDomainPrefix,
        callbackUrls: props.callbackUrls,
        userPoolClientName: 'sagemaker-demo-client',
      }
    );

    this.cognitoUserPoolId = sagemakerCognitoUserPool.getUserPool().userPoolId;

    // **********************************************************
    // Create role and policy to allow creation of a presigned url
    // **********************************************************
    const createLoginPresignedUrlForUserRole = new Role(
      this,
      'CreatePresignedUrlRole',
      {
        roleName: 'create-presigned-url-role',
        description: 'Role to create a presigned url for login for a user',
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole'
          ),
        ],
      }
    );

    const presignedUrlPolicy = new ManagedPolicy(
      this,
      'create-presigned-url-policy',
      {
        managedPolicyName: 'create-presigned-url-policy',
        statements: [
          new PolicyStatement({
            sid: 'CreatePresignedUrl',
            resources: ['*'],
            actions: [
              'sagemaker:CreatePresignedDomainUrl',
              'sagemaker:ListDomains',
              'sagemaker:DescribeDomain',
              'sagemaker:CreateUserProfile',
              'sagemaker:DescribeUserProfile',
              'sagemaker:ListTags',
              'sagemaker:AddTags',
            ],
            effect: Effect.ALLOW,
          }),
          new PolicyStatement({
            sid: 'AssumeDefaultSagemakerStudioRoles',
            resources: ['*'],
            actions: ['iam:PassRole'],
            effect: Effect.ALLOW,
            conditions: {
              StringEquals: {
                'iam:PassedToService': 'sagemaker.amazonaws.com',
              },
            },
          }),
        ],
      }
    );

    createLoginPresignedUrlForUserRole.addManagedPolicy(presignedUrlPolicy);

    // ************************************************************************************
    // Lambda that generates presignedUrl and creates userprofile by calling sagemaker SDK api
    // ***************************************************************************************

    const preSignedUrlLambda = new Function(this, 'CreatePresignedUrlHandler', {
      functionName: 'create-presigned-url-handler',
      runtime: Runtime.NODEJS_18_X,
      handler: 'preSignedUrlHandler.handle',
      code: Code.fromAsset('./dist/lambda'),
      timeout: Duration.minutes(5),
      role: createLoginPresignedUrlForUserRole,
    });

    // ****************************************************************
    // API gateway to expose the lambda
    // ****************************************************************
    const apiResourcePolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          sid: 'apiGatewayRole',
          effect: Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          principals: [new AnyPrincipal()],
          resources: ['execute-api:/*/*/getPresignedUrl'],
        }),
        new PolicyStatement({
          sid: 'apiGatewayRole',
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          principals: [new AnyPrincipal()],
          resources: ['lambda.amazonaws.com'],
        }),
      ],
    });

    //API gateway - for demo purpose uses regional endpoint. Replace this with private api gateway
    // to restrict access within the corporate network
    const presignedUrlRestApi = new RestApi(this, 'PreSignedURLApi', {
      restApiName: 'create-presigned-url',
      policy: apiResourcePolicy,
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    const validator = presignedUrlRestApi.addRequestValidator(
      'validate-request',
      {
        requestValidatorName: 'general-request-validator',
        validateRequestBody: true,
        validateRequestParameters: true,
      }
    );

    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      authorizerName: 'PresignedUrlApiAuthorizer',
      cognitoUserPools: [sagemakerCognitoUserPool.getUserPool()],
      identitySource: 'method.request.header.Authorization',
    });

    //REST Api path is /domainName/{domainName}/getPresignedUrl
    const domainNamePath = presignedUrlRestApi.root
      .addResource('domainName')
      .addResource('{domainName}');
    domainNamePath
      .addResource('getPresignedUrl')
      .addMethod('GET', new LambdaIntegration(preSignedUrlLambda), {
        requestParameters: {
          'method.request.path.domainName': true,
        },
        requestValidator: validator,
        authorizationScopes: [OAuthScope.OPENID.scopeName],
        authorizationType: AuthorizationType.COGNITO,
        authorizer: authorizer,
      });
  }

  public getCognitoUserPoolId() {
    return this.cognitoUserPoolId;
  }
}
