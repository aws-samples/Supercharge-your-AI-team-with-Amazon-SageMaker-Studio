import {
  PresignedUrl,
  TokenHeader,
  UserInfo,
  createPresignedUrlForUser,
  domainNameMissing,
  noAuthorization,
  sagemakerDomainNotFound,
  unrecoverableErrorFromAwsAPI,
  userNameMissing,
  userNotIncludedInGroupForAsset,
} from './preSignedUrlLogic';
import { APIGatewayEvent, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Context } from 'vm';

/**
 * Exntry point for lambda. Extracts user info and domain name from the event and calls the service layer.
 * The service layer creates the presigned url and returns it. Uses hexagonm architecture pattern.
 *
 * @param event
 * @param context
 * @returns
 */
export const handle = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userInfo = extractUserInfo(event);
  const domainName = getDomainName(event);
  const arnRegex = /^arn:aws:lambda:(.*?):(\d+):/;
  const match = context.invokedFunctionArn.match(arnRegex);
  const region = match ? match[1] : null;
  const accountId = match ? match[2] : null;

  const responseFromApi = await createPresignedUrlForUser(userInfo, domainName, accountId, region);
  return convertToHttpResponse(responseFromApi);
};

/**
 * The method extracts user info from requestContext which contains authorizer object with claims.
 * The claims contain the user name and the cognito groups the user is in and is passed by Cognito as part of the JWT token.
 * For the claims to contain the cognito group information,you need to add the scope 'openid' in the Cognito User Pool App Client.
 *
 * @param event
 * @returns
 */
function extractUserInfo(event: APIGatewayProxyEvent): UserInfo {
  const authorizer = event.requestContext.authorizer;
  console.log('Authorizer object', authorizer);
  if (authorizer === undefined || authorizer === null) {
    console.error('No authorizer in the header.');
    throw new Error(noAuthorization);
  }
  const claims = authorizer['claims'] as TokenHeader | undefined;
  if (claims === undefined) {
    throw new Error(noAuthorization);
  }

  const userName = claims['username'];
  if (userName === undefined) {
    throw new Error(userNameMissing);
  }

  const groups = claims['cognito:groups'];

  if (groups === undefined) {
    throw new Error(userNotIncludedInGroupForAsset);
  }

  const userInfo: UserInfo = {
    userName,
    groups,
  };
  return userInfo;
}

/**
 * Extracts the sagemaker domain name from the path parameters of the event.
 * @param event
 * @returns
 */
function getDomainName(event: APIGatewayProxyEvent): string {
  const pathParameters = event.pathParameters;
  if (pathParameters === null) {
    throw new Error(domainNameMissing);
  }

  const domainName = pathParameters['domainName'];
  if (domainName === undefined) {
    throw new Error(domainNameMissing);
  }

  return domainName;
}

/**
 * Set the response header and status code.
 *
 * @param statusCode
 * @param body
 * @param isBase64Encoded
 * @param customHeaders
 * @returns
 */
export function getResponse(
  statusCode: number,
  body: string,
  isBase64Encoded: boolean | undefined = undefined,
  customHeaders: { [header: string]: string | number | boolean } | undefined = undefined
): APIGatewayProxyResult {
  return {
    statusCode: statusCode,
    body: body,
    isBase64Encoded: isBase64Encoded,
    headers: customHeaders ?? {
      'Access-Control-Allow-Origin': '*',
    },
  };
}

function convertToHttpResponse(result: string): APIGatewayProxyResult {
  if (result !== undefined && result !== null) {
    return createGetUrlResponse(result);
  }

  const error = result;
  switch (error) {
    case noAuthorization:
      return getResponse(401, JSON.stringify({ message: 'No authorization given.' }));
    case userNameMissing:
      return getResponse(400, JSON.stringify({ message: 'No user name in token given.' }));
    case domainNameMissing:
      return getResponse(400, JSON.stringify({ message: 'No customer domain name provided.' }));
    case userNotIncludedInGroupForAsset:
      return getResponse(
        403,
        JSON.stringify({
          message: 'User not included in cognito group for requested customer asset.',
        })
      );
    case sagemakerDomainNotFound:
      return getResponse(
        404,
        JSON.stringify({
          message: 'Could not find sagemaker domain.',
        })
      );
    case unrecoverableErrorFromAwsAPI:
      return getResponse(
        500,
        JSON.stringify({
          message: 'Received unrecoverable error from AWS API.',
        })
      );
    default:
      throw new Error(`Unknown error: ${error}`);
  }
}

function createGetUrlResponse(url: string): APIGatewayProxyResult {
  const presignedUrl: PresignedUrl = {
    url: url,
  };
  return getResponse(200, JSON.stringify(presignedUrl));
}
