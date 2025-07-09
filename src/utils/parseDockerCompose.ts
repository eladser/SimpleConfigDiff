import { ParsedConfig } from '@/types';
import { parseYAML } from './parseYAML';

export function parseDockerCompose(content: string): ParsedConfig {
  try {
    // First, parse as YAML since Docker Compose files are YAML-based
    const yamlResult = parseYAML(content);
    
    if (yamlResult.error) {
      return {
        data: {},
        format: 'yaml',
        error: `Docker Compose parsing failed: ${yamlResult.error}`
      };
    }

    // Enhance the parsed data with Docker Compose specific processing
    const enhancedData = enhanceDockerComposeData(yamlResult.data);
    
    // Add Docker Compose specific metadata
    const metadata = analyzeDockerCompose(enhancedData);
    
    return {
      data: enhancedData,
      format: 'yaml',
      lineMap: yamlResult.lineMap,
      dockerComposeMetadata: metadata
    };
  } catch (error) {
    return {
      data: {},
      format: 'yaml',
      error: error instanceof Error ? error.message : 'Failed to parse Docker Compose file'
    };
  }
}

function enhanceDockerComposeData(data: any): any {
  const enhanced = { ...data };
  
  // Process services
  if (enhanced.services) {
    enhanced.services = Object.keys(enhanced.services).reduce((acc, serviceName) => {
      const service = enhanced.services[serviceName];
      acc[serviceName] = enhanceServiceDefinition(service, serviceName);
      return acc;
    }, {} as any);
  }
  
  // Process networks
  if (enhanced.networks) {
    enhanced.networks = Object.keys(enhanced.networks).reduce((acc, networkName) => {
      const network = enhanced.networks[networkName];
      acc[networkName] = enhanceNetworkDefinition(network, networkName);
      return acc;
    }, {} as any);
  }
  
  // Process volumes
  if (enhanced.volumes) {
    enhanced.volumes = Object.keys(enhanced.volumes).reduce((acc, volumeName) => {
      const volume = enhanced.volumes[volumeName];
      acc[volumeName] = enhanceVolumeDefinition(volume, volumeName);
      return acc;
    }, {} as any);
  }
  
  // Process secrets
  if (enhanced.secrets) {
    enhanced.secrets = Object.keys(enhanced.secrets).reduce((acc, secretName) => {
      const secret = enhanced.secrets[secretName];
      acc[secretName] = enhanceSecretDefinition(secret, secretName);
      return acc;
    }, {} as any);
  }
  
  // Process configs
  if (enhanced.configs) {
    enhanced.configs = Object.keys(enhanced.configs).reduce((acc, configName) => {
      const config = enhanced.configs[configName];
      acc[configName] = enhanceConfigDefinition(config, configName);
      return acc;
    }, {} as any);
  }
  
  return enhanced;
}

function enhanceServiceDefinition(service: any, serviceName: string): any {
  const enhanced = { ...service };
  
  // Add metadata
  enhanced._metadata = {
    serviceName,
    type: 'service',
    hasHealthcheck: !!service.healthcheck,
    hasEnvironment: !!service.environment || !!service.env_file,
    hasVolumes: !!service.volumes,
    hasNetworks: !!service.networks,
    hasSecrets: !!service.secrets,
    hasConfigs: !!service.configs,
    hasPorts: !!service.ports,
    hasRestart: !!service.restart,
    hasResourceLimits: !!service.deploy?.resources
  };
  
  // Normalize environment variables
  if (service.environment) {
    enhanced.environment = normalizeEnvironment(service.environment);
  }
  
  // Normalize ports
  if (service.ports) {
    enhanced.ports = normalizePorts(service.ports);
  }
  
  // Normalize volumes
  if (service.volumes) {
    enhanced.volumes = normalizeVolumes(service.volumes);
  }
  
  // Normalize networks
  if (service.networks) {
    enhanced.networks = normalizeNetworks(service.networks);
  }
  
  return enhanced;
}

function enhanceNetworkDefinition(network: any, networkName: string): any {
  const enhanced = { ...network };
  
  enhanced._metadata = {
    networkName,
    type: 'network',
    isExternal: !!network.external,
    driver: network.driver || 'bridge',
    hasIPAM: !!network.ipam
  };
  
  return enhanced;
}

function enhanceVolumeDefinition(volume: any, volumeName: string): any {
  const enhanced = { ...volume };
  
  enhanced._metadata = {
    volumeName,
    type: 'volume',
    isExternal: !!volume.external,
    driver: volume.driver || 'local',
    hasDriverOpts: !!volume.driver_opts
  };
  
  return enhanced;
}

function enhanceSecretDefinition(secret: any, secretName: string): any {
  const enhanced = { ...secret };
  
  enhanced._metadata = {
    secretName,
    type: 'secret',
    isExternal: !!secret.external,
    hasFile: !!secret.file,
    hasEnvironment: !!secret.environment
  };
  
  return enhanced;
}

function enhanceConfigDefinition(config: any, configName: string): any {
  const enhanced = { ...config };
  
  enhanced._metadata = {
    configName,
    type: 'config',
    isExternal: !!config.external,
    hasFile: !!config.file,
    hasEnvironment: !!config.environment
  };
  
  return enhanced;
}

function normalizeEnvironment(env: any): any {
  if (Array.isArray(env)) {
    // Convert array format to object format
    const normalized: any = {};
    env.forEach((item: string) => {
      const [key, ...valueParts] = item.split('=');
      normalized[key] = valueParts.join('=') || '';
    });
    return normalized;
  }
  return env;
}

function normalizePorts(ports: any[]): any[] {
  return ports.map(port => {
    if (typeof port === 'string') {
      const parts = port.split(':');
      if (parts.length === 2) {
        return {
          host: parts[0],
          container: parts[1],
          protocol: 'tcp'
        };
      } else if (parts.length === 3) {
        return {
          host: parts[1],
          container: parts[2],
          protocol: parts[0]
        };
      }
      return { container: port, protocol: 'tcp' };
    }
    return port;
  });
}

function normalizeVolumes(volumes: any[]): any[] {
  return volumes.map(volume => {
    if (typeof volume === 'string') {
      const parts = volume.split(':');
      if (parts.length >= 2) {
        return {
          source: parts[0],
          target: parts[1],
          readonly: parts[2] === 'ro'
        };
      }
      return { target: volume };
    }
    return volume;
  });
}

function normalizeNetworks(networks: any): any {
  if (Array.isArray(networks)) {
    // Convert array format to object format
    const normalized: any = {};
    networks.forEach((network: string) => {
      normalized[network] = {};
    });
    return normalized;
  }
  return networks;
}

function analyzeDockerCompose(data: any): any {
  const metadata: any = {
    version: data.version || '3.8',
    services: [],
    networks: [],
    volumes: [],
    secrets: [],
    configs: [],
    hasXExtensions: false
  };
  
  // Analyze services
  if (data.services) {
    metadata.services = Object.keys(data.services).map(serviceName => {
      const service = data.services[serviceName];
      return {
        name: serviceName,
        image: service.image,
        build: !!service.build,
        ports: service.ports ? service.ports.length : 0,
        volumes: service.volumes ? service.volumes.length : 0,
        environment: service.environment ? Object.keys(service.environment).length : 0,
        networks: service.networks ? Object.keys(service.networks).length : 0,
        dependsOn: service.depends_on ? Object.keys(service.depends_on).length : 0,
        restart: service.restart || 'no',
        healthcheck: !!service.healthcheck,
        deploy: !!service.deploy
      };
    });
  }
  
  // Analyze networks
  if (data.networks) {
    metadata.networks = Object.keys(data.networks).map(networkName => ({
      name: networkName,
      driver: data.networks[networkName].driver || 'bridge',
      external: !!data.networks[networkName].external
    }));
  }
  
  // Analyze volumes
  if (data.volumes) {
    metadata.volumes = Object.keys(data.volumes).map(volumeName => ({
      name: volumeName,
      driver: data.volumes[volumeName].driver || 'local',
      external: !!data.volumes[volumeName].external
    }));
  }
  
  // Analyze secrets
  if (data.secrets) {
    metadata.secrets = Object.keys(data.secrets).map(secretName => ({
      name: secretName,
      external: !!data.secrets[secretName].external,
      file: !!data.secrets[secretName].file
    }));
  }
  
  // Analyze configs
  if (data.configs) {
    metadata.configs = Object.keys(data.configs).map(configName => ({
      name: configName,
      external: !!data.configs[configName].external,
      file: !!data.configs[configName].file
    }));
  }
  
  // Check for x-extensions
  metadata.hasXExtensions = Object.keys(data).some(key => key.startsWith('x-'));
  
  return metadata;
}

// Docker Compose specific comparison utilities
export function compareDockerComposeData(left: any, right: any): {
  changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    dockerComposeContext?: {
      section: 'services' | 'networks' | 'volumes' | 'secrets' | 'configs';
      serviceName?: string;
      resourceName?: string;
    };
  }>;
  stats: {
    servicesAdded: number;
    servicesRemoved: number;
    servicesChanged: number;
    networksAdded: number;
    networksRemoved: number;
    networksChanged: number;
    volumesAdded: number;
    volumesRemoved: number;
    volumesChanged: number;
  };
} {
  const changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    dockerComposeContext?: {
      section: 'services' | 'networks' | 'volumes' | 'secrets' | 'configs';
      serviceName?: string;
      resourceName?: string;
    };
  }> = [];
  
  const stats = {
    servicesAdded: 0,
    servicesRemoved: 0,
    servicesChanged: 0,
    networksAdded: 0,
    networksRemoved: 0,
    networksChanged: 0,
    volumesAdded: 0,
    volumesRemoved: 0,
    volumesChanged: 0
  };
  
  // Compare services
  if (left.services || right.services) {
    const leftServices = left.services || {};
    const rightServices = right.services || {};
    
    const allServiceNames = new Set([...Object.keys(leftServices), ...Object.keys(rightServices)]);
    
    for (const serviceName of allServiceNames) {
      const leftService = leftServices[serviceName];
      const rightService = rightServices[serviceName];
      
      if (!leftService && rightService) {
        changes.push({
          type: 'added',
          path: `services.${serviceName}`,
          newValue: rightService,
          dockerComposeContext: {
            section: 'services',
            serviceName
          }
        });
        stats.servicesAdded++;
      } else if (leftService && !rightService) {
        changes.push({
          type: 'removed',
          path: `services.${serviceName}`,
          oldValue: leftService,
          dockerComposeContext: {
            section: 'services',
            serviceName
          }
        });
        stats.servicesRemoved++;
      } else if (leftService && rightService) {
        // Compare service properties
        const serviceChanges = compareServiceDefinition(leftService, rightService, serviceName);
        changes.push(...serviceChanges);
        if (serviceChanges.length > 0) {
          stats.servicesChanged++;
        }
      }
    }
  }
  
  // Compare networks, volumes, secrets, configs similarly...
  // (Implementation would be similar to services comparison)
  
  return { changes, stats };
}

function compareServiceDefinition(left: any, right: any, serviceName: string): Array<{
  type: 'added' | 'removed' | 'changed';
  path: string;
  oldValue?: any;
  newValue?: any;
  dockerComposeContext?: {
    section: 'services' | 'networks' | 'volumes' | 'secrets' | 'configs';
    serviceName?: string;
    resourceName?: string;
  };
}> {
  const changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    dockerComposeContext?: {
      section: 'services' | 'networks' | 'volumes' | 'secrets' | 'configs';
      serviceName?: string;
      resourceName?: string;
    };
  }> = [];
  
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
  
  for (const key of allKeys) {
    if (key.startsWith('_metadata')) continue; // Skip metadata
    
    const leftValue = left[key];
    const rightValue = right[key];
    
    if (leftValue === undefined && rightValue !== undefined) {
      changes.push({
        type: 'added',
        path: `services.${serviceName}.${key}`,
        newValue: rightValue,
        dockerComposeContext: {
          section: 'services',
          serviceName
        }
      });
    } else if (leftValue !== undefined && rightValue === undefined) {
      changes.push({
        type: 'removed',
        path: `services.${serviceName}.${key}`,
        oldValue: leftValue,
        dockerComposeContext: {
          section: 'services',
          serviceName
        }
      });
    } else if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
      changes.push({
        type: 'changed',
        path: `services.${serviceName}.${key}`,
        oldValue: leftValue,
        newValue: rightValue,
        dockerComposeContext: {
          section: 'services',
          serviceName
        }
      });
    }
  }
  
  return changes;
}