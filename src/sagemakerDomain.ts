import {
  Connections,
  ISubnet,
  IVpc,
  Port,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { CfnDomain } from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

import { loadLifeCycleConfig } from './utils';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LifeCycleConfigHandler } from './lifeCycleConfigHandler';
import { Annotations } from 'aws-cdk-lib';

export interface SagemakerDomainProps {
  vpc: IVpc;
  account: string;
  region: string;
  kmsKey: IKey;
  domainName: string;
}

/**
 * A  high level construct that creates sagemaker domain within a VPC and provisions lifecycleconfig to initialize jupyterlab and kernelgateway apps.
 *
 */
export class SagemakerDomain extends Construct {
  private sagemakerDomainSecurityGroup: SecurityGroup;
  private domainId: string;

  constructor(scope: Construct, id: string, props: SagemakerDomainProps) {
    super(scope, id);

    //VPC
    const vpc = props.vpc;
    //Subnets
    const subnetIds: string[] = this.getIsolatedSubnetIds(vpc.isolatedSubnets);

    if (props.domainName === undefined) {
      Annotations.of(this).addError(
        `Domain name is not defined ${props.domainName}`
      );
    }

    //Sagemaker Security group
    const sagemakerDomainSG = new SecurityGroup(
      this,
      `SagemakerSecurityGroup-${props.domainName}`,
      {
        vpc,
        description: `Security group for SageMaker notebook instance, training jobs and hosting endpoint for ${props.domainName}`,
        securityGroupName: `${props.domainName}-sagemakerstudio-domain-sg`,
      }
    );

    // Security group using peering security group as source
    sagemakerDomainSG.connections.allowFrom(
      new Connections({ securityGroups: [sagemakerDomainSG] }),
      Port.allTraffic(),
      `Security group for SageMaker notebook instance, training jobs and hosting endpoint for ${props.domainName}`
    );

    //Studio Role
    const sagemakerStudioRole = new Role(
      this,
      'DefaultExecutionRoleForSagemakerStudio',
      {
        assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
        roleName: `${props.domainName}-sagemaker-studio-role`,
        managedPolicies: [],
      }
    );

    const jupyterLabImageAccount = this.getJuypterLabHostingAccountByRegion(
      props.region
    );

    //Sagemaker Domain
    const sagemakerStudioDomain = new CfnDomain(this, 'SagemakerStudioDomain', {
      authMode: 'IAM',
      defaultUserSettings: {
        executionRole: sagemakerStudioRole.roleArn,
        securityGroups: [sagemakerDomainSG.securityGroupId],
        jupyterServerAppSettings: {
          defaultResourceSpec: {
            sageMakerImageArn: `arn:aws:sagemaker:${props.region}:${jupyterLabImageAccount}:image/jupyter-server-3`,
          },
        },
        kernelGatewayAppSettings: {
          defaultResourceSpec: {
            instanceType: 'ml.t3.medium',
          },
        },
      },
      domainName: props.domainName,
      subnetIds: subnetIds,
      vpcId: vpc.vpcId,
      appNetworkAccessType: 'VpcOnly',
      domainSettings: {
        securityGroupIds: [sagemakerDomainSG.securityGroupId],
      },
      kmsKeyId: props.kmsKey.keyId,
    });

    const { jupyterServerLifecycleScript, kernelGatewayLifecycleScript } =
      this.getLifeCycleScripts();

    //Lifecycle Config that uses custom resources
    const jupyterServerlifeCycleHandler = new LifeCycleConfigHandler(
      this,
      'JupyterServerLifeCycleHandler',
      {
        account: props.account,
        region: props.region,
        lifecycleConfigName: `${props.domainName}-on-jupyter-server-start`,
        lifecycleScript: jupyterServerLifecycleScript,
        lifecycleAppType: 'JupyterServer',
        sagemakerDomainId: sagemakerStudioDomain.attrDomainId,
        domainName: props.domainName,
      }
    );

    const kernelgatewaylifeCycleHandler = new LifeCycleConfigHandler(
      this,
      'KernelGatewayLifeCycleHandler',
      {
        account: props.account,
        region: props.region,
        lifecycleConfigName: `${props.domainName}-on-kernel-gateway-start`,
        lifecycleScript: kernelGatewayLifecycleScript,
        lifecycleAppType: 'KernelGateway',
        sagemakerDomainId: sagemakerStudioDomain.attrDomainId,
        domainName: props.domainName,
      }
    );

    jupyterServerlifeCycleHandler.node.addDependency(sagemakerStudioDomain);
    kernelgatewaylifeCycleHandler.node.addDependency(sagemakerStudioDomain);
    kernelgatewaylifeCycleHandler.node.addDependency(
      jupyterServerlifeCycleHandler
    );

    this.sagemakerDomainSecurityGroup = sagemakerDomainSG;
    this.domainId = sagemakerStudioDomain.attrDomainId;
  }

  getIsolatedSubnetIds(subnets: ISubnet[]) {
    return subnets.map((subnet) => subnet.subnetId);
  }

  public getSecurityGroupId(): string {
    return this.sagemakerDomainSecurityGroup.securityGroupId;
  }

  public getDomainId(): string {
    return this.domainId;
  }

  private getJuypterLabHostingAccountByRegion(
    region: string
  ): string | undefined {
    const regionToAccountMap: Record<string, string> = {
      'us-east-1': '081325390199',
      'us-east-2': '429704687514',
      'us-west-1': '742091327244',
      'us-west-2': '236514542706',
      'af-south-1': '559312083959',
      'ap-east-1': '493642496378',
      'ap-south-1': '394103062818',
      'ap-northeast-2': '806072073708',
      'ap-southeast-1': '492261229750',
      'ap-southeast-2': '452832661640',
      'ap-northeast-1': '102112518831',
      'ca-central-1': '310906938811',
      'eu-central-1': '936697816551',
      'eu-west-1': '470317259841',
      'eu-west-2': '712779665605',
      'eu-west-3': '615547856133',
      'eu-north-1': '243637512696',
      'eu-south-1': '592751261982',
      'sa-east-1': '782484402741',
      'cn-north-1': '390048526115',
      'cn-northwest-1': '390780980154',
    };

    return regionToAccountMap[region];
  }

  public getLifeCycleScripts() {
    const jupyterlabScriptPayload = loadLifeCycleConfig(
      './config/jupyterlab-server-start.sh'
    );
    const kernelGatewayScriptPayload = loadLifeCycleConfig(
      './config/kernel-gateway-start.sh'
    );

    return {
      jupyterServerLifecycleScript: jupyterlabScriptPayload,
      kernelGatewayLifecycleScript: kernelGatewayScriptPayload,
    };
  }
}
