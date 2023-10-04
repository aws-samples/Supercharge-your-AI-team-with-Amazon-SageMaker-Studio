import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  Connections,
  InterfaceVpcEndpointAwsService,
  IpAddresses,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Provisions vpc, subnets and vpc endpoints
 */
export class InfrastructureStack extends Stack {
  private readonly vpc: Vpc;
  private readonly securityGroupId: string;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'sagemaker-demo-vpc', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 0,
      maxAzs: 2,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          name: 'isolated-subnet-1',
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
        {
          name: 'isolated-subnet-2',
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    const sgDomainSG = new SecurityGroup(this, 'sgDomainSG', {
      vpc,
      allowAllOutbound: true,
      description: 'security group for a sagemaker studio',
    });

    sgDomainSG.connections.allowFrom(
      new Connections({ securityGroups: [sgDomainSG] }),
      Port.allTraffic(),
      'all traffice from peering sg'
    );

    const sgEndpoint = new SecurityGroup(this, 'EndpointSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });

    sgEndpoint.connections.allowFrom(
      new Connections({ securityGroups: [sgDomainSG] }),
      Port.tcp(443),
      'all htttps traffic from sg domain'
    );

    sgEndpoint.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.allTraffic(), 'allow all traffic from vpc');

    vpc.addGatewayEndpoint('sagemaker-s3-endpoint', {
      service: InterfaceVpcEndpointAwsService.S3,
    });

    vpc.addInterfaceEndpoint('sagemaker-api-endpoint', {
      service: InterfaceVpcEndpointAwsService.SAGEMAKER_API,
      privateDnsEnabled: true,
      subnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [sgEndpoint],
    });

    vpc.addInterfaceEndpoint('sagemaker-runtime-endpoint', {
      service: InterfaceVpcEndpointAwsService.SAGEMAKER_RUNTIME,
      subnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [sgEndpoint],
    });

    vpc.addInterfaceEndpoint('sagemaker-studio-endpoint', {
      service: InterfaceVpcEndpointAwsService.SAGEMAKER_STUDIO,
      privateDnsEnabled: true,
      subnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [sgEndpoint],
    });

    vpc.addInterfaceEndpoint('sagemaker-notebook-endpoint', {
      service: InterfaceVpcEndpointAwsService.SAGEMAKER_NOTEBOOK,
      privateDnsEnabled: true,
      subnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [sgEndpoint],
    });

    new CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });

    this.securityGroupId = sgDomainSG.securityGroupId;

    this.vpc = vpc;
  }

  public getVpc(): Vpc {
    return this.vpc;
  }

  public getSecurityGroupId() {
    return this.securityGroupId;
  }
}
