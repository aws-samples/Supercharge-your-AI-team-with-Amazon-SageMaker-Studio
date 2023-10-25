import {
  CreatePresignedDomainUrlCommand,
  ListDomainsCommand,
} from '@aws-sdk/client-sagemaker';

import {
  sagemakerDomainNotFound,
  unrecoverableErrorFromAwsAPI,
  UserInfo,
  userNotIncludedInGroupForAsset,
} from './preSignedUrlLogic';
import SagemakerClientAdapter, {
  unrecoverableErrrorFromSagemakerStudioClient,
} from './sagemakerClientAdapter';

export interface PresignedUrlServiceInterface {
  assertUserIsContainedInCognitoGroupForCA(
    userInfo: UserInfo,
    domainName: string
  ): undefined;
  findDomainWithName(domainName: string): Promise<string>;

  createPresignedUrl(domainId: string, userName: string): Promise<string>;
}
/**
 * The service class that uses the SagemakerClientAdapter to check if the user exists, create user and user profile for the Sagemaker domain.
 *
 */
export default class PresignedUrlService
  implements PresignedUrlServiceInterface
{
  private client: SagemakerClientAdapter;

  constructor(private accountId: string, private region: string) {
    this.client = SagemakerClientAdapter.create(region);
  }

  public assertUserIsContainedInCognitoGroupForCA(
    userInfo: UserInfo,
    domainName: string
  ): undefined {
    if (!userInfo.groups.includes(domainName)) {
      throw new Error(userNotIncludedInGroupForAsset);
    }
    return undefined;
  }

  public async findDomainWithName(domainName: string) {
    const listDomainsResponse = await this.client.listDomains(
      new ListDomainsCommand({
        MaxResults: 10,
      })
    );

    const domains = listDomainsResponse.Domains;

    if (domains === undefined || domains.length === 0) {
      throw new Error(sagemakerDomainNotFound);
    }

    const domainForCa = domains.find(
      (domain) => domain.DomainName === domainName
    );

    if (domainForCa === undefined) {
      throw new Error(sagemakerDomainNotFound);
    }

    const domainId = domainForCa.DomainId;
    if (domainId === undefined) {
      throw new Error(unrecoverableErrorFromAwsAPI);
    }

    return domainId;
  }

  /**
   * Generates preSigned url to access Sagemaker Studio. The generated URL is sent to the client.
   * The client can use the URL to access Sagemaker Studio.
   *
   * @param domainId
   * @param userName
   * @returns
   */
  public async createPresignedUrl(
    domainId: string,
    userName: string
  ): Promise<string> {
    const response = await this.client.createPresignedDomainUrl(
      new CreatePresignedDomainUrlCommand({
        DomainId: domainId,
        UserProfileName: userName,
      })
    );

    const authorizedUrl = response.AuthorizedUrl;
    if (authorizedUrl === undefined) {
      throw new Error(unrecoverableErrrorFromSagemakerStudioClient);
    }
    return authorizedUrl;
  }
}
