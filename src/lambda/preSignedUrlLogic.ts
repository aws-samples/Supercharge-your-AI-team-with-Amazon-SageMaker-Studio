import PresignedUrlService, {
  PresignedUrlServiceInterface,
} from './preSignedUrlService';

export type CreateLoginPresignedUrlError =
  | typeof noAuthorization
  | typeof userNameMissing
  | typeof domainNameMissing
  | typeof userNotIncludedInGroupForAsset
  | typeof sagemakerDomainNotFound
  | typeof unrecoverableErrorFromAwsAPI;

export const noAuthorization = 'NoAuthorization';
export const userNameMissing = 'UserNameMissing';
export const domainNameMissing = 'DomainNameMissing';
export const userNotIncludedInGroupForAsset = 'UserNotIncludedInGroupForAsset';
export const sagemakerDomainNotFound = 'SagemakerDomainNotFound';
export const unrecoverableErrorFromAwsAPI = 'UnrecoverableErrorFromAwsAPI';

export interface TokenHeader {
  sub: string | undefined;
  'cognito:groups': string | undefined;
  username: string | undefined;
}

export interface UserInfo {
  userName: string;
  groups: string;
}

export interface PresignedUrl {
  url: string;
}

/**
 * Leverages service layer class PresignedUrlService to create presigned URL for the user. Also checks if the user profile for the Sagemaker domain already exists and creates user profile if not previously created.
 *
 * @param userInfo
 * @param domainName
 * @param accountId
 * @param region
 * @returns
 */
export async function createPresignedUrlForUser(
  userInfo: UserInfo,
  domainName: string,
  accountId: string,
  region: string
): Promise<string> {
  const presignedUrlService: PresignedUrlServiceInterface =
    new PresignedUrlService(accountId, region);

  const domainIdForCA = await presignedUrlService.findDomainWithName(
    domainName
  );
  if (domainIdForCA === undefined || domainIdForCA === null) {
    throw new Error('Domain underfined or null');
  }

  const url = await presignedUrlService.createPresignedUrl(
    domainIdForCA,
    userInfo.userName
  );
  if (url === undefined || url === null) {
    throw new Error('Presigned URL is null or undefined');
  }

  return new Promise<string>((resolve) => {
    resolve(url);
  });
}
