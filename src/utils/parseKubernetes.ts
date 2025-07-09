import { ParsedConfig } from '@/types';
import { parseYAML } from './parseYAML';

export function parseKubernetes(content: string): ParsedConfig {
  try {
    // Kubernetes manifests can be single documents or multiple documents separated by ---
    const documents = content.split(/^---\s*$/m).filter(doc => doc.trim());
    
    if (documents.length === 0) {
      return {
        data: {},
        format: 'yaml',
        error: 'Empty Kubernetes manifest'
      };
    }

    let parsedDocuments: any[] = [];
    let hasError = false;
    let errorMessage = '';

    // Parse each document
    for (const doc of documents) {
      const yamlResult = parseYAML(doc.trim());
      
      if (yamlResult.error) {
        hasError = true;
        errorMessage = yamlResult.error;
        break;
      }
      
      parsedDocuments.push(yamlResult.data);
    }

    if (hasError) {
      return {
        data: {},
        format: 'yaml',
        error: `Kubernetes manifest parsing failed: ${errorMessage}`
      };
    }

    // Process each document with Kubernetes-specific enhancement
    const enhancedDocuments = parsedDocuments.map(doc => enhanceKubernetesResource(doc));
    
    // Structure the data for easier comparison
    const structuredData = structureKubernetesData(enhancedDocuments);
    
    // Add Kubernetes-specific metadata
    const metadata = analyzeKubernetes(enhancedDocuments);
    
    return {
      data: structuredData,
      format: 'yaml',
      kubernetesMetadata: metadata
    };
  } catch (error) {
    return {
      data: {},
      format: 'yaml',
      error: error instanceof Error ? error.message : 'Failed to parse Kubernetes manifest'
    };
  }
}

function enhanceKubernetesResource(resource: any): any {
  if (!resource || typeof resource !== 'object') {
    return resource;
  }

  const enhanced = { ...resource };
  
  // Add metadata for better comparison
  enhanced._k8sMetadata = {
    apiVersion: resource.apiVersion || 'unknown',
    kind: resource.kind || 'unknown',
    name: resource.metadata?.name || 'unnamed',
    namespace: resource.metadata?.namespace || 'default',
    hasLabels: !!(resource.metadata?.labels && Object.keys(resource.metadata.labels).length > 0),
    hasAnnotations: !!(resource.metadata?.annotations && Object.keys(resource.metadata.annotations).length > 0),
    hasOwnerReferences: !!(resource.metadata?.ownerReferences && resource.metadata.ownerReferences.length > 0),
    resourceVersion: resource.metadata?.resourceVersion,
    generation: resource.metadata?.generation,
    creationTimestamp: resource.metadata?.creationTimestamp
  };

  // Enhance specific resource types
  switch (resource.kind) {
    case 'Deployment':
      enhanced._k8sMetadata.deployment = analyzeDeployment(resource);
      break;
    case 'Service':
      enhanced._k8sMetadata.service = analyzeService(resource);
      break;
    case 'ConfigMap':
      enhanced._k8sMetadata.configMap = analyzeConfigMap(resource);
      break;
    case 'Secret':
      enhanced._k8sMetadata.secret = analyzeSecret(resource);
      break;
    case 'Ingress':
      enhanced._k8sMetadata.ingress = analyzeIngress(resource);
      break;
    case 'PersistentVolume':
    case 'PersistentVolumeClaim':
      enhanced._k8sMetadata.storage = analyzeStorage(resource);
      break;
    case 'ServiceAccount':
      enhanced._k8sMetadata.serviceAccount = analyzeServiceAccount(resource);
      break;
    case 'Role':
    case 'ClusterRole':
    case 'RoleBinding':
    case 'ClusterRoleBinding':
      enhanced._k8sMetadata.rbac = analyzeRBAC(resource);
      break;
    case 'NetworkPolicy':
      enhanced._k8sMetadata.networkPolicy = analyzeNetworkPolicy(resource);
      break;
    case 'Pod':
      enhanced._k8sMetadata.pod = analyzePod(resource);
      break;
  }

  return enhanced;
}

function analyzeDeployment(deployment: any): any {
  const spec = deployment.spec || {};
  const template = spec.template || {};
  const containers = template.spec?.containers || [];
  
  return {
    replicas: spec.replicas || 1,
    strategy: spec.strategy?.type || 'RollingUpdate',
    selector: spec.selector,
    containers: containers.length,
    containerNames: containers.map((c: any) => c.name),
    hasVolumes: !!(template.spec?.volumes && template.spec.volumes.length > 0),
    hasSecrets: containers.some((c: any) => c.env?.some((e: any) => e.valueFrom?.secretKeyRef) || c.envFrom?.some((e: any) => e.secretRef)),
    hasConfigMaps: containers.some((c: any) => c.env?.some((e: any) => e.valueFrom?.configMapKeyRef) || c.envFrom?.some((e: any) => e.configMapRef)),
    hasProbes: containers.some((c: any) => c.readinessProbe || c.livenessProbe || c.startupProbe),
    hasResourceLimits: containers.some((c: any) => c.resources?.limits),
    hasResourceRequests: containers.some((c: any) => c.resources?.requests),
    hasSecurityContext: !!(template.spec?.securityContext || containers.some((c: any) => c.securityContext)),
    hasNodeSelector: !!template.spec?.nodeSelector,
    hasTolerations: !!(template.spec?.tolerations && template.spec.tolerations.length > 0),
    hasAffinity: !!template.spec?.affinity
  };
}

function analyzeService(service: any): any {
  const spec = service.spec || {};
  const ports = spec.ports || [];
  
  return {
    type: spec.type || 'ClusterIP',
    ports: ports.length,
    portDetails: ports.map((p: any) => ({
      port: p.port,
      targetPort: p.targetPort,
      protocol: p.protocol || 'TCP',
      name: p.name
    })),
    selector: spec.selector,
    hasLoadBalancer: spec.type === 'LoadBalancer',
    hasNodePort: spec.type === 'NodePort',
    hasExternalIPs: !!(spec.externalIPs && spec.externalIPs.length > 0),
    hasSessionAffinity: spec.sessionAffinity !== 'None'
  };
}

function analyzeConfigMap(configMap: any): any {
  const data = configMap.data || {};
  const binaryData = configMap.binaryData || {};
  
  return {
    dataKeys: Object.keys(data),
    binaryDataKeys: Object.keys(binaryData),
    totalKeys: Object.keys(data).length + Object.keys(binaryData).length,
    hasImmutable: configMap.immutable === true
  };
}

function analyzeSecret(secret: any): any {
  const data = secret.data || {};
  const stringData = secret.stringData || {};
  
  return {
    type: secret.type || 'Opaque',
    dataKeys: Object.keys(data),
    stringDataKeys: Object.keys(stringData),
    totalKeys: Object.keys(data).length + Object.keys(stringData).length,
    hasImmutable: secret.immutable === true,
    isTLSSecret: secret.type === 'kubernetes.io/tls',
    isServiceAccountToken: secret.type === 'kubernetes.io/service-account-token',
    isDockerConfigSecret: secret.type?.includes('dockercfg') || secret.type?.includes('dockerconfigjson')
  };
}

function analyzeIngress(ingress: any): any {
  const spec = ingress.spec || {};
  const rules = spec.rules || [];
  const tls = spec.tls || [];
  
  return {
    ingressClassName: spec.ingressClassName,
    rules: rules.length,
    hosts: rules.map((r: any) => r.host).filter(Boolean),
    paths: rules.flatMap((r: any) => r.http?.paths || []).length,
    hasTLS: tls.length > 0,
    tlsHosts: tls.flatMap((t: any) => t.hosts || []),
    hasDefaultBackend: !!spec.defaultBackend,
    hasAnnotations: !!(ingress.metadata?.annotations && Object.keys(ingress.metadata.annotations).length > 0)
  };
}

function analyzeStorage(storage: any): any {
  const spec = storage.spec || {};
  
  return {
    storageClass: spec.storageClassName,
    capacity: spec.capacity?.storage || (storage.kind === 'PersistentVolumeClaim' ? spec.resources?.requests?.storage : undefined),
    accessModes: spec.accessModes || [],
    volumeMode: spec.volumeMode || 'Filesystem',
    reclaimPolicy: spec.persistentVolumeReclaimPolicy,
    hasSelector: !!spec.selector,
    isBound: storage.status?.phase === 'Bound',
    volumeSource: storage.kind === 'PersistentVolume' ? Object.keys(spec).find(key => 
      !['capacity', 'accessModes', 'persistentVolumeReclaimPolicy', 'storageClassName', 'volumeMode'].includes(key)
    ) : undefined
  };
}

function analyzeServiceAccount(sa: any): any {
  const secrets = sa.secrets || [];
  const imagePullSecrets = sa.imagePullSecrets || [];
  
  return {
    secrets: secrets.length,
    secretNames: secrets.map((s: any) => s.name),
    imagePullSecrets: imagePullSecrets.length,
    imagePullSecretNames: imagePullSecrets.map((s: any) => s.name),
    automountServiceAccountToken: sa.automountServiceAccountToken !== false
  };
}

function analyzeRBAC(rbac: any): any {
  const rules = rbac.rules || [];
  const subjects = rbac.subjects || [];
  
  return {
    rules: rules.length,
    subjects: subjects.length,
    subjectTypes: [...new Set(subjects.map((s: any) => s.kind))],
    apiGroups: [...new Set(rules.flatMap((r: any) => r.apiGroups || []))],
    resources: [...new Set(rules.flatMap((r: any) => r.resources || []))],
    verbs: [...new Set(rules.flatMap((r: any) => r.verbs || []))],
    hasResourceNames: rules.some((r: any) => r.resourceNames && r.resourceNames.length > 0),
    isClusterRole: rbac.kind?.includes('Cluster'),
    roleRef: rbac.roleRef
  };
}

function analyzeNetworkPolicy(np: any): any {
  const spec = np.spec || {};
  const ingress = spec.ingress || [];
  const egress = spec.egress || [];
  
  return {
    podSelector: spec.podSelector,
    policyTypes: spec.policyTypes || [],
    ingressRules: ingress.length,
    egressRules: egress.length,
    hasIngressRules: ingress.length > 0,
    hasEgressRules: egress.length > 0,
    allowsAllIngress: ingress.some((r: any) => !r.from || r.from.length === 0),
    allowsAllEgress: egress.some((r: any) => !r.to || r.to.length === 0)
  };
}

function analyzePod(pod: any): any {
  const spec = pod.spec || {};
  const containers = spec.containers || [];
  const initContainers = spec.initContainers || [];
  
  return {
    containers: containers.length,
    initContainers: initContainers.length,
    containerNames: containers.map((c: any) => c.name),
    initContainerNames: initContainers.map((c: any) => c.name),
    restartPolicy: spec.restartPolicy || 'Always',
    nodeSelector: spec.nodeSelector,
    hasVolumes: !!(spec.volumes && spec.volumes.length > 0),
    hasSecrets: containers.some((c: any) => c.env?.some((e: any) => e.valueFrom?.secretKeyRef) || c.envFrom?.some((e: any) => e.secretRef)),
    hasConfigMaps: containers.some((c: any) => c.env?.some((e: any) => e.valueFrom?.configMapKeyRef) || c.envFrom?.some((e: any) => e.configMapRef)),
    hasProbes: containers.some((c: any) => c.readinessProbe || c.livenessProbe || c.startupProbe),
    hasResourceLimits: containers.some((c: any) => c.resources?.limits),
    hasResourceRequests: containers.some((c: any) => c.resources?.requests),
    hasSecurityContext: !!(spec.securityContext || containers.some((c: any) => c.securityContext)),
    hasTolerations: !!(spec.tolerations && spec.tolerations.length > 0),
    hasAffinity: !!spec.affinity,
    serviceAccountName: spec.serviceAccountName,
    hostNetwork: spec.hostNetwork === true,
    hostPID: spec.hostPID === true,
    hostIPC: spec.hostIPC === true,
    phase: pod.status?.phase
  };
}

function structureKubernetesData(documents: any[]): any {
  const structured: any = {
    _documents: documents,
    _metadata: {
      totalDocuments: documents.length,
      resourceTypes: [...new Set(documents.map(doc => doc.kind))],
      namespaces: [...new Set(documents.map(doc => doc.metadata?.namespace).filter(Boolean))],
      apiVersions: [...new Set(documents.map(doc => doc.apiVersion))]
    }
  };

  // Group by resource type for easier comparison
  const byKind: any = {};
  documents.forEach((doc, index) => {
    const kind = doc.kind || 'Unknown';
    if (!byKind[kind]) {
      byKind[kind] = [];
    }
    byKind[kind].push({
      ...doc,
      _documentIndex: index
    });
  });

  structured._byKind = byKind;

  // Group by namespace
  const byNamespace: any = {};
  documents.forEach((doc, index) => {
    const namespace = doc.metadata?.namespace || 'default';
    if (!byNamespace[namespace]) {
      byNamespace[namespace] = [];
    }
    byNamespace[namespace].push({
      ...doc,
      _documentIndex: index
    });
  });

  structured._byNamespace = byNamespace;

  return structured;
}

function analyzeKubernetes(documents: any[]): any {
  const metadata: any = {
    totalDocuments: documents.length,
    resourceTypes: [...new Set(documents.map(doc => doc.kind))],
    namespaces: [...new Set(documents.map(doc => doc.metadata?.namespace).filter(Boolean))],
    apiVersions: [...new Set(documents.map(doc => doc.apiVersion))],
    resources: []
  };

  // Analyze each resource
  documents.forEach((doc, index) => {
    const resource = {
      index,
      kind: doc.kind,
      apiVersion: doc.apiVersion,
      name: doc.metadata?.name,
      namespace: doc.metadata?.namespace,
      labels: doc.metadata?.labels ? Object.keys(doc.metadata.labels) : [],
      annotations: doc.metadata?.annotations ? Object.keys(doc.metadata.annotations) : [],
      hasStatus: !!doc.status,
      ...doc._k8sMetadata
    };
    
    metadata.resources.push(resource);
  });

  // Calculate summary statistics
  metadata.summary = {
    deployments: documents.filter(doc => doc.kind === 'Deployment').length,
    services: documents.filter(doc => doc.kind === 'Service').length,
    configMaps: documents.filter(doc => doc.kind === 'ConfigMap').length,
    secrets: documents.filter(doc => doc.kind === 'Secret').length,
    ingresses: documents.filter(doc => doc.kind === 'Ingress').length,
    pods: documents.filter(doc => doc.kind === 'Pod').length,
    rbacResources: documents.filter(doc => ['Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding'].includes(doc.kind)).length,
    networkPolicies: documents.filter(doc => doc.kind === 'NetworkPolicy').length,
    persistentVolumes: documents.filter(doc => ['PersistentVolume', 'PersistentVolumeClaim'].includes(doc.kind)).length,
    serviceAccounts: documents.filter(doc => doc.kind === 'ServiceAccount').length
  };

  return metadata;
}

// Kubernetes-specific comparison utilities
export function compareKubernetesData(left: any, right: any): {
  changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    kubernetesContext?: {
      kind: string;
      name: string;
      namespace: string;
      apiVersion: string;
    };
  }>;
  stats: {
    resourcesAdded: number;
    resourcesRemoved: number;
    resourcesChanged: number;
    namespacesAdded: number;
    namespacesRemoved: number;
    kindCounts: Record<string, { added: number; removed: number; changed: number }>;
  };
} {
  const changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    kubernetesContext?: {
      kind: string;
      name: string;
      namespace: string;
      apiVersion: string;
    };
  }> = [];

  const stats = {
    resourcesAdded: 0,
    resourcesRemoved: 0,
    resourcesChanged: 0,
    namespacesAdded: 0,
    namespacesRemoved: 0,
    kindCounts: {} as Record<string, { added: number; removed: number; changed: number }>
  };

  const leftDocs = left._documents || [];
  const rightDocs = right._documents || [];

  // Create lookup maps for easier comparison
  const leftMap = new Map();
  const rightMap = new Map();

  leftDocs.forEach((doc: any) => {
    const key = `${doc.kind}/${doc.metadata?.namespace || 'default'}/${doc.metadata?.name}`;
    leftMap.set(key, doc);
  });

  rightDocs.forEach((doc: any) => {
    const key = `${doc.kind}/${doc.metadata?.namespace || 'default'}/${doc.metadata?.name}`;
    rightMap.set(key, doc);
  });

  // Find added and changed resources
  for (const [key, rightDoc] of rightMap) {
    const leftDoc = leftMap.get(key);
    const context = {
      kind: rightDoc.kind,
      name: rightDoc.metadata?.name,
      namespace: rightDoc.metadata?.namespace || 'default',
      apiVersion: rightDoc.apiVersion
    };

    if (!leftDoc) {
      // Resource added
      changes.push({
        type: 'added',
        path: key,
        newValue: rightDoc,
        kubernetesContext: context
      });
      stats.resourcesAdded++;
      
      if (!stats.kindCounts[rightDoc.kind]) {
        stats.kindCounts[rightDoc.kind] = { added: 0, removed: 0, changed: 0 };
      }
      stats.kindCounts[rightDoc.kind].added++;
    } else {
      // Compare resources
      const resourceChanges = compareKubernetesResource(leftDoc, rightDoc, key);
      if (resourceChanges.length > 0) {
        changes.push(...resourceChanges);
        stats.resourcesChanged++;
        
        if (!stats.kindCounts[rightDoc.kind]) {
          stats.kindCounts[rightDoc.kind] = { added: 0, removed: 0, changed: 0 };
        }
        stats.kindCounts[rightDoc.kind].changed++;
      }
    }
  }

  // Find removed resources
  for (const [key, leftDoc] of leftMap) {
    if (!rightMap.has(key)) {
      const context = {
        kind: leftDoc.kind,
        name: leftDoc.metadata?.name,
        namespace: leftDoc.metadata?.namespace || 'default',
        apiVersion: leftDoc.apiVersion
      };

      changes.push({
        type: 'removed',
        path: key,
        oldValue: leftDoc,
        kubernetesContext: context
      });
      stats.resourcesRemoved++;
      
      if (!stats.kindCounts[leftDoc.kind]) {
        stats.kindCounts[leftDoc.kind] = { added: 0, removed: 0, changed: 0 };
      }
      stats.kindCounts[leftDoc.kind].removed++;
    }
  }

  // Compare namespaces
  const leftNamespaces = new Set(left._metadata?.namespaces || []);
  const rightNamespaces = new Set(right._metadata?.namespaces || []);
  
  stats.namespacesAdded = [...rightNamespaces].filter(ns => !leftNamespaces.has(ns)).length;
  stats.namespacesRemoved = [...leftNamespaces].filter(ns => !rightNamespaces.has(ns)).length;

  return { changes, stats };
}

function compareKubernetesResource(left: any, right: any, resourceKey: string): Array<{
  type: 'added' | 'removed' | 'changed';
  path: string;
  oldValue?: any;
  newValue?: any;
  kubernetesContext?: {
    kind: string;
    name: string;
    namespace: string;
    apiVersion: string;
  };
}> {
  const changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    kubernetesContext?: {
      kind: string;
      name: string;
      namespace: string;
      apiVersion: string;
    };
  }> = [];

  const context = {
    kind: right.kind,
    name: right.metadata?.name,
    namespace: right.metadata?.namespace || 'default',
    apiVersion: right.apiVersion
  };

  // Compare important fields
  const fieldsToCompare = ['apiVersion', 'kind', 'metadata', 'spec', 'data', 'stringData'];
  
  fieldsToCompare.forEach(field => {
    if (field === '_k8sMetadata') return; // Skip metadata
    
    const leftValue = left[field];
    const rightValue = right[field];
    
    if (JSON.stringify(leftValue) !== JSON.stringify(rightValue)) {
      changes.push({
        type: 'changed',
        path: `${resourceKey}.${field}`,
        oldValue: leftValue,
        newValue: rightValue,
        kubernetesContext: context
      });
    }
  });

  return changes;
}