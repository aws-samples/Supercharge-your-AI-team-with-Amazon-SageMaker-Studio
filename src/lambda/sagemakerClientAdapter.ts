import {
  CreatePresignedDomainUrlCommand,
  CreatePresignedDomainUrlCommandOutput,
  DescribeDomainCommand,
  DescribeDomainCommandOutput,
  ListDomainsCommand,
  ListDomainsCommandOutput,
  SageMakerClient,
} from '@aws-sdk/client-sagemaker';

/**
 * The class uses adapter pattern to handles all lower level Sagemaker AWS SDK calls needed by the service layer.
 *
 */
export default class SagemakerClientAdapter {
  constructor(private readonly client: SageMakerClient) {}

  public async listDomains(
    listDomainsCommand: ListDomainsCommand
  ): Promise<ListDomainsCommandOutput> {
    try {
      const result = await this.client.send(listDomainsCommand);
      return result;
    } catch {
      throw new Error(unrecoverableErrrorFromSagemakerStudioClient);
    }
  }

  public async createPresignedDomainUrl(
    createPresignedDomainUrlCommand: CreatePresignedDomainUrlCommand
  ): Promise<CreatePresignedDomainUrlCommandOutput> {
    try {
      const result = await this.client.send(createPresignedDomainUrlCommand);
      return result;
    } catch {
      throw new Error(unrecoverableErrrorFromSagemakerStudioClient);
    }
  }

  public async describeDomain(
    createPresignedDomainUrlCommand: DescribeDomainCommand
  ): Promise<DescribeDomainCommandOutput> {
    try {
      const result = await this.client.send(createPresignedDomainUrlCommand);
      return result;
    } catch {
      throw new Error(unrecoverableErrrorFromSagemakerStudioClient);
    }
  }

  public static create(region: string): SagemakerClientAdapter {
    return new SagemakerClientAdapter(new SageMakerClient(region));
  }
}

export type SagemakerStudioClientFacadeError =
  | typeof unrecoverableErrrorFromSagemakerStudioClient
  | typeof sagemakerResourceNotFound;

export type UnrecoverableSagemakerStudioClientFacadeError =
  typeof unrecoverableErrrorFromSagemakerStudioClient;

export const unrecoverableErrrorFromSagemakerStudioClient =
  'unrecoverableErrorFromSagemakerStudioClient';

export const sagemakerResourceNotFound = 'sagemakerResourceNotFound';
