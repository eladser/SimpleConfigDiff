export const SAMPLE_LEFT = `# service config — staging
server:
  host: api.staging.internal
  port: 8080
  tls: false
  timeouts:
    read: 15s
    write: 30s

database:
  pool_size: 10
  log_queries: true

features:
  rate_limiting: false
  beta:
    - search-v2
    - bulk-export

logging:
  level: debug
  retention_days: 7
`;

export const SAMPLE_RIGHT = `# service config — production
server:
  host: api.example.com
  port: 443
  tls: true
  max_connections: 500
  timeouts:
    read: 15s
    write: 60s

database:
  pool_size: 50
  log_queries: false

features:
  rate_limiting: true
  beta:
    - search-v2

logging:
  level: warn
  retention_days: 90
`;
