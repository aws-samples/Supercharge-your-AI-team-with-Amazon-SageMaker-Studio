import {
  CreatePresignedDomainUrlCommand,
  CreateUserProfileCommand,
  DescribeDomainCommand,
  DescribeUserProfileCommand,
  ListDomainsCommand,
} from '@aws-sdk/client-sagemaker';

import { sagemakerDomainNotFound, unrecoverableErrorFromAwsAPI, UserInfo, userNotIncludedInGroupForAsset } from './preSignedUrlLogic';
import SagemakerClientAdapter, { sagemakerResourceNotFound, unrecoverableErrrorFromSagemakerStudioClient } from './sagemakerClientAdapter';

export interface PresignedUrlServiceInterface {
  assertUserIsContainedInCognitoGroupForCA(userInfo: UserInfo, domainName: string): undefined;
  findDomainWithName(domainName: string): Promise<string>;
  assureUserExistsAndIsReady(userName: string, domainId: string): Promise<undefined>;
  doesUserExist(userProfileName: string, domainId: string): Promise<boolean | undefined>;
  createPresignedUrl(domainId: string, userName: string): Promise<string>;
}
/**
 * The service class that uses the SagemakerClientAdapter to check if the user exists, create user and user profile for the Sagemaker domain.
 *
 */
export default class PresignedUrlService implements PresignedUrlServiceInterface {
  private client: SagemakerClientAdapter;

  constructor(private accountId: string, private region: string) {
    this.client = SagemakerClientAdapter.create(region);
  }

  public assertUserIsContainedInCognitoGroupForCA(userInfo: UserInfo, domainName: string): undefined {
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

    const domainForCa = domains.find(domain => domain.DomainName === domainName);

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
   * Checks if user exists and belongs to the cognito group. Creates user profile for Sagemaker domain
   * if not created previously.
   *
   */
  public async assureUserExistsAndIsReady(userName: string, domainId: string) {
    const doesUserExistResponse = await this.doesUserExist(userName, domainId);
    if (!doesUserExistResponse) {
      this.createUser(userName, domainId);
    }
    return undefined;
  }

  /**
   * Checks if userprofile for the Sagemaker domain already exists.
   * @param userProfileName
   *
   * @param domainId
   * @returns
   */
  public async doesUserExist(userProfileName: string, domainId: string) {
    try {
      const response = await this.client.describeUserProfile(
        new DescribeUserProfileCommand({
          DomainId: domainId,
          UserProfileName: userProfileName,
        })
      );
      if (response != undefined) {
        return response.Status === 'InService';
      }
    } catch (error) {
      switch (error) {
        case sagemakerResourceNotFound:
          console.log('Catching sagemakerResourceNotFound', error);
          return false;
        case unrecoverableErrrorFromSagemakerStudioClient:
          console.log('Catching unrecoverableErrrorFromSagemakerStudioClient', error);
          throw new Error(unrecoverableErrorFromAwsAPI);
        default:
          console.log('Catching default', error);
          return false;
      }
    }
  }

  /**
   * Creates user profile for the Sagemaker domain.
   *
   * @param userProfileName
   * @param domainId
   * @returns
   */
  private async createUser(userProfileName: string, domainId: string): Promise<undefined> {
    const domain = await this.client.describeDomain(
      new DescribeDomainCommand({
        DomainId: domainId,
      })
    );

    const defaultUserSettings = domain.DefaultUserSettings;
    const userProfile = await this.client.createUserProfile(
      new CreateUserProfileCommand({
        DomainId: domainId,
        UserProfileName: userProfileName,
        UserSettings: {
          ExecutionRole: `arn:aws:iam::${this.accountId}:role/${domain.DomainName}-sagemaker-role`,
          SecurityGroups: defaultUserSettings?.SecurityGroups,
          SharingSettings: defaultUserSettings?.SharingSettings,
          JupyterServerAppSettings: defaultUserSettings?.JupyterServerAppSettings,
          KernelGatewayAppSettings: defaultUserSettings?.KernelGatewayAppSettings,
          TensorBoardAppSettings: defaultUserSettings?.TensorBoardAppSettings,
          RStudioServerProAppSettings: defaultUserSettings?.RStudioServerProAppSettings,
          RSessionAppSettings: defaultUserSettings?.RSessionAppSettings,
          CanvasAppSettings: defaultUserSettings?.CanvasAppSettings,
        },
        Tags: [{ Key: 'Domain', Value: domain.DomainName }],
      })
    );

    console.log('Created UserProfile', userProfile);
    return undefined;
  }

  /**
   * Generates preSigned url to access Sagemaker Studio. The generated URL is sent to the client.
   * The client can use the URL to access Sagemaker Studio.
   *
   * @param domainId
   * @param userName
   * @returns
   */
  public async createPresignedUrl(domainId: string, userName: string): Promise<string> {
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
