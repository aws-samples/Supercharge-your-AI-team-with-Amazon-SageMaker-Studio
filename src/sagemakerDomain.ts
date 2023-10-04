import { Connections, ISubnet, IVpc, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { CfnDomain } from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

import { loadLifeCycleConfig } from './utils';
import { SageMakerExecutionRole } from './sagemakerExecutionRole';
import { Role } from 'aws-cdk-lib/aws-iam';
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
  private sagemakerExecutionRole: Role;

  constructor(scope: Construct, id: string, props: SagemakerDomainProps) {
    super(scope, id);

    //VPC
    const vpc = props.vpc;
    //Subnets
    const subnetIds: string[] = this.getIsolatedSubnetIds(vpc.isolatedSubnets);

    if (props.domainName === undefined) {
      Annotations.of(this).addError(`Domain name is not defined ${props.domainName}`)
    }

    //Sagemaker Security group
    const sagemakerDomainSG = new SecurityGroup(this, `SagemakerSecurityGroup-${props.domainName}`, {
      vpc,
      description: `Security group for SageMaker notebook instance, training jobs and hosting endpoint for ${props.domainName}`,
      securityGroupName: `${props.domainName}-sagemakerstudio-domain-sg`,
    });

    // Security group using peering security group as source
    sagemakerDomainSG.connections.allowFrom(
      new Connections({ securityGroups: [sagemakerDomainSG] }),
      Port.allTraffic(),
      `Security group for SageMaker notebook instance, training jobs and hosting endpoint for ${props.domainName}`
    );

    //Execution Role
    const sagemakerExecutionRole = new SageMakerExecutionRole(this, 'SagemakerStudioExecutionRole', {
      ...props,
    });

    //Sagemaker Domain
    const sagemakerStudioDomain = new CfnDomain(this, 'SagemakerStudioDomain', {
      authMode: 'IAM',
      defaultUserSettings: {
        executionRole: sagemakerExecutionRole.getRole().roleArn,
        securityGroups: [sagemakerDomainSG.securityGroupId],
        jupyterServerAppSettings: {
          defaultResourceSpec: {
            sageMakerImageArn: 'arn:aws:sagemaker:eu-central-1:936697816551:image/jupyter-server-3',
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

    const { jupyterServerLifecycleScript, kernelGatewayLifecycleScript } = this.getLifeCycleScripts();

    //Lifecycle Config that uses custom resources
    const jupyterServerlifeCycleHandler = new LifeCycleConfigHandler(this, 'JupyterServerLifeCycleHandler', {
      account: props.account,
      region: props.region,
      lifecycleConfigName: `${props.domainName}-on-jupyter-server-start`,
      lifecycleScript: jupyterServerLifecycleScript,
      lifecycleAppType: 'JupyterServer',
      sagemakerDomainId: sagemakerStudioDomain.attrDomainId,
      domainName: props.domainName,
    });

    const kernelgatewaylifeCycleHandler = new LifeCycleConfigHandler(this, 'KernelGatewayLifeCycleHandler', {
      account: props.account,
      region: props.region,
      lifecycleConfigName: `${props.domainName}-on-kernel-gateway-start`,
      lifecycleScript: kernelGatewayLifecycleScript,
      lifecycleAppType: 'KernelGateway',
      sagemakerDomainId: sagemakerStudioDomain.attrDomainId,
      domainName: props.domainName,
    });

    jupyterServerlifeCycleHandler.node.addDependency(sagemakerStudioDomain);
    kernelgatewaylifeCycleHandler.node.addDependency(sagemakerStudioDomain);
    kernelgatewaylifeCycleHandler.node.addDependency(jupyterServerlifeCycleHandler);

    this.sagemakerDomainSecurityGroup = sagemakerDomainSG;
    this.domainId = sagemakerStudioDomain.attrDomainId;
    this.sagemakerExecutionRole = sagemakerExecutionRole.getRole();
  }

  getIsolatedSubnetIds(subnets: ISubnet[]) {
    return subnets.map(subnet => subnet.subnetId);
  }

  public getSecurityGroupId(): string {
    return this.sagemakerDomainSecurityGroup.securityGroupId;
  }

  public getDomainId(): string {
    return this.domainId;
  }

  public getLifeCycleScripts() {
    const jupyterlabScriptPayload = loadLifeCycleConfig('./config/jupyterlab-server-start.sh');
    const kernelGatewayScriptPayload = loadLifeCycleConfig('./config/kernel-gateway-start.sh');

    return {
      jupyterServerLifecycleScript: jupyterlabScriptPayload,
      kernelGatewayLifecycleScript: kernelGatewayScriptPayload,
    };
  }

  public getSagemakerExecutionRole() {
    return this.sagemakerExecutionRole;
  }
}
