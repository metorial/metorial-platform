import {
  AllocateAddressCommand,
  AssociateRouteTableCommand,
  AttachInternetGatewayCommand,
  CreateInternetGatewayCommand,
  CreateNatGatewayCommand,
  CreateRouteCommand,
  CreateRouteTableCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  ModifyVpcAttributeCommand
} from '@aws-sdk/client-ec2';
import { delay } from '@metorial/delay';
import { awsEc2 } from './aws';

export interface VpcResources {
  vpcId: string;
  publicSubnetId: string;
  privateSubnetId: string;
  internetGatewayId: string;
  natGatewayId: string;
}

let ensureVpcRaw = async (name: string): Promise<VpcResources> => {
  let existingVpcs = await awsEc2.send(
    new DescribeVpcsCommand({
      Filters: [{ Name: 'tag:Name', Values: [name] }]
    })
  );

  if (existingVpcs.Vpcs && existingVpcs.Vpcs.length > 0) {
    let vpcId = existingVpcs.Vpcs[0].VpcId!;
    let subnetsResult = await awsEc2.send(
      new DescribeSubnetsCommand({
        Filters: [{ Name: 'vpc-id', Values: [vpcId] }]
      })
    );

    let publicSubnet = subnetsResult.Subnets?.find(s =>
      s.Tags?.some(t => t.Key === 'Name' && t.Value === `${name}-public-subnet`)
    );
    let privateSubnet = subnetsResult.Subnets?.find(s =>
      s.Tags?.some(t => t.Key === 'Name' && t.Value === `${name}-private-subnet`)
    );

    let igwResult = await awsEc2.send(
      new DescribeInternetGatewaysCommand({
        Filters: [{ Name: 'attachment.vpc-id', Values: [vpcId] }]
      })
    );

    let natGatewaysResult = await awsEc2.send(
      new DescribeNatGatewaysCommand({
        Filter: [
          { Name: 'vpc-id', Values: [vpcId] },
          { Name: 'state', Values: ['available'] }
        ]
      })
    );

    return {
      vpcId,
      publicSubnetId: publicSubnet?.SubnetId!,
      privateSubnetId: privateSubnet?.SubnetId!,
      internetGatewayId: igwResult.InternetGateways?.[0]?.InternetGatewayId!,
      natGatewayId: natGatewaysResult.NatGateways?.[0]?.NatGatewayId!
    };
  }

  let vpcResult = await awsEc2.send(
    new CreateVpcCommand({
      CidrBlock: '10.0.0.0/16',
      TagSpecifications: [
        {
          ResourceType: 'vpc',
          Tags: [{ Key: 'Name', Value: name }]
        }
      ]
    })
  );

  let vpcId = vpcResult.Vpc!.VpcId!;

  await awsEc2.send(
    new ModifyVpcAttributeCommand({
      VpcId: vpcId,
      EnableDnsHostnames: { Value: true }
    })
  );

  let igwResult = await awsEc2.send(
    new CreateInternetGatewayCommand({
      TagSpecifications: [
        {
          ResourceType: 'internet-gateway',
          Tags: [{ Key: 'Name', Value: `${name}-igw` }]
        }
      ]
    })
  );

  let internetGatewayId = igwResult.InternetGateway!.InternetGatewayId!;

  await awsEc2.send(
    new AttachInternetGatewayCommand({
      VpcId: vpcId,
      InternetGatewayId: internetGatewayId
    })
  );

  let publicSubnetResult = await awsEc2.send(
    new CreateSubnetCommand({
      VpcId: vpcId,
      CidrBlock: '10.0.1.0/24',
      TagSpecifications: [
        {
          ResourceType: 'subnet',
          Tags: [{ Key: 'Name', Value: `${name}-public-subnet` }]
        }
      ]
    })
  );

  let publicSubnetId = publicSubnetResult.Subnet!.SubnetId!;

  let privateSubnetResult = await awsEc2.send(
    new CreateSubnetCommand({
      VpcId: vpcId,
      CidrBlock: '10.0.2.0/24',
      TagSpecifications: [
        {
          ResourceType: 'subnet',
          Tags: [{ Key: 'Name', Value: `${name}-private-subnet` }]
        }
      ]
    })
  );

  let privateSubnetId = privateSubnetResult.Subnet!.SubnetId!;

  let publicRouteTableResult = await awsEc2.send(
    new CreateRouteTableCommand({
      VpcId: vpcId,
      TagSpecifications: [
        {
          ResourceType: 'route-table',
          Tags: [{ Key: 'Name', Value: `${name}-public-rt` }]
        }
      ]
    })
  );

  let publicRouteTableId = publicRouteTableResult.RouteTable!.RouteTableId!;

  await awsEc2.send(
    new CreateRouteCommand({
      RouteTableId: publicRouteTableId,
      DestinationCidrBlock: '0.0.0.0/0',
      GatewayId: internetGatewayId
    })
  );

  await awsEc2.send(
    new AssociateRouteTableCommand({
      RouteTableId: publicRouteTableId,
      SubnetId: publicSubnetId
    })
  );

  let eipResult = await awsEc2.send(
    new AllocateAddressCommand({
      Domain: 'vpc',
      TagSpecifications: [
        {
          ResourceType: 'elastic-ip',
          Tags: [{ Key: 'Name', Value: `${name}-nat-eip` }]
        }
      ]
    })
  );

  let allocationId = eipResult.AllocationId!;

  let natGatewayResult = await awsEc2.send(
    new CreateNatGatewayCommand({
      SubnetId: publicSubnetId,
      AllocationId: allocationId,
      TagSpecifications: [
        {
          ResourceType: 'natgateway',
          Tags: [{ Key: 'Name', Value: `${name}-nat` }]
        }
      ]
    })
  );

  let natGatewayId = natGatewayResult.NatGateway!.NatGatewayId!;

  let natGatewayAvailable = false;
  while (!natGatewayAvailable) {
    await delay(5000);
    let natGatewayStatus = await awsEc2.send(
      new DescribeNatGatewaysCommand({
        NatGatewayIds: [natGatewayId]
      })
    );
    let state = natGatewayStatus.NatGateways![0].State;
    if (state === 'available') {
      natGatewayAvailable = true;
    } else if (state === 'failed') {
      throw new Error('NAT Gateway creation failed');
    }
  }

  let privateRouteTableResult = await awsEc2.send(
    new CreateRouteTableCommand({
      VpcId: vpcId,
      TagSpecifications: [
        {
          ResourceType: 'route-table',
          Tags: [{ Key: 'Name', Value: `${name}-private-rt` }]
        }
      ]
    })
  );

  let privateRouteTableId = privateRouteTableResult.RouteTable!.RouteTableId!;

  await awsEc2.send(
    new CreateRouteCommand({
      RouteTableId: privateRouteTableId,
      DestinationCidrBlock: '0.0.0.0/0',
      NatGatewayId: natGatewayId
    })
  );

  await awsEc2.send(
    new AssociateRouteTableCommand({
      RouteTableId: privateRouteTableId,
      SubnetId: privateSubnetId
    })
  );

  return {
    vpcId,
    publicSubnetId,
    privateSubnetId,
    internetGatewayId,
    natGatewayId
  };
};

let vpcPromiseCache = new Map<string, ReturnType<typeof ensureVpcRaw>>();

export let ensureVpc = async (name: string): Promise<VpcResources> => {
  let promise = vpcPromiseCache.get(name);

  if (!promise) {
    promise = ensureVpcRaw(name);
    vpcPromiseCache.set(name, promise);
  }

  return await promise;
};
