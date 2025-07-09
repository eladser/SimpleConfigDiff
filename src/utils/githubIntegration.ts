import { ConfigFile, ComparisonResult, DiffOptions } from '@/types';
import { detectFormat, parseConfig } from './parsers';
import { generateDiff } from './generateDiff';

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  node_id: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  url: string;
  html_url: string;
}

export interface GitHubComparisonOptions {
  owner: string;
  repo: string;
  leftRef: string;  // branch, tag, or commit SHA
  rightRef: string; // branch, tag, or commit SHA
  path?: string;    // specific file path
  recursive?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  diffOptions?: DiffOptions;
}

export interface GitHubComparisonResult {
  repository: {
    owner: string;
    name: string;
    full_name: string;
    html_url: string;
  };
  comparison: {
    base_commit: GitHubCommit;
    head_commit: GitHubCommit;
    ahead_by: number;
    behind_by: number;
    total_commits: number;
    html_url: string;
  };
  files: Array<{
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
    blob_url: string;
    raw_url: string;
    contents_url: string;
    patch?: string;
    result?: ComparisonResult;
  }>;
  summary: {
    totalFiles: number;
    filesWithDifferences: number;
    totalAdditions: number;
    totalDeletions: number;
    configFiles: number;
    processingTime: number;
  };
}

export class GitHubIntegration {
  private apiBase = 'https://api.github.com';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.apiBase}${endpoint}`;
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SimpleConfigDiff-App',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${error.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.makeRequest(`/repos/${owner}/${repo}/branches`);
  }

  async getTags(owner: string, repo: string): Promise<Array<{ name: string; commit: { sha: string } }>> {
    return this.makeRequest(`/repos/${owner}/${repo}/tags`);
  }

  async getCommits(owner: string, repo: string, ref?: string, limit: number = 30): Promise<GitHubCommit[]> {
    const params = new URLSearchParams();
    if (ref) params.append('sha', ref);
    params.append('per_page', limit.toString());

    return this.makeRequest(`/repos/${owner}/${repo}/commits?${params}`);
  }

  async getFile(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFile> {
    const params = ref ? `?ref=${ref}` : '';
    return this.makeRequest(`/repos/${owner}/${repo}/contents/${path}${params}`);
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const file = await this.getFile(owner, repo, path, ref);
    
    if (file.type !== 'file' || !file.content) {
      throw new Error(`File not found or is not a regular file: ${path}`);
    }

    if (file.encoding === 'base64') {
      return atob(file.content);
    }

    return file.content;
  }

  async getDirectoryContents(owner: string, repo: string, path: string = '', ref?: string): Promise<GitHubFile[]> {
    const params = ref ? `?ref=${ref}` : '';
    const contents = await this.makeRequest(`/repos/${owner}/${repo}/contents/${path}${params}`);
    
    return Array.isArray(contents) ? contents : [contents];
  }

  async compareRefs(owner: string, repo: string, base: string, head: string): Promise<any> {
    return this.makeRequest(`/repos/${owner}/${repo}/compare/${base}...${head}`);
  }

  async compareFiles(options: GitHubComparisonOptions): Promise<GitHubComparisonResult> {
    const startTime = performance.now();
    
    // Get repository information
    const repoInfo = await this.makeRequest(`/repos/${options.owner}/${options.repo}`);
    
    // Get comparison from GitHub
    const comparison = await this.compareRefs(options.owner, options.repo, options.leftRef, options.rightRef);
    
    // Filter files based on patterns and config file extensions
    const configExtensions = ['.json', '.yaml', '.yml', '.xml', '.ini', '.toml', '.env', '.hcl', '.tf', '.properties', '.csv', '.config', '.conf'];
    let filesToProcess = comparison.files.filter((file: any) => {
      // Check if it's a config file
      const isConfigFile = configExtensions.some(ext => file.filename.toLowerCase().endsWith(ext));
      if (!isConfigFile) return false;
      
      // Apply include patterns
      if (options.includePatterns && options.includePatterns.length > 0) {
        const matches = options.includePatterns.some(pattern => 
          this.matchPattern(file.filename, pattern)
        );
        if (!matches) return false;
      }
      
      // Apply exclude patterns
      if (options.excludePatterns && options.excludePatterns.length > 0) {
        const matches = options.excludePatterns.some(pattern => 
          this.matchPattern(file.filename, pattern)
        );
        if (matches) return false;
      }
      
      // Filter by specific path if provided
      if (options.path && !file.filename.startsWith(options.path)) {
        return false;
      }
      
      return true;
    });

    // Process each file
    const processedFiles = await Promise.all(
      filesToProcess.map(async (file: any) => {
        try {
          let result: ComparisonResult | undefined;
          
          // Only process modified files for detailed comparison
          if (file.status === 'modified') {
            result = await this.compareFileVersions(
              options.owner,
              options.repo,
              file.filename,
              options.leftRef,
              options.rightRef,
              options.diffOptions
            );
          }
          
          return {
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            blob_url: file.blob_url,
            raw_url: file.raw_url,
            contents_url: file.contents_url,
            patch: file.patch,
            result
          };
        } catch (error) {
          console.error(`Error processing file ${file.filename}:`, error);
          return {
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            blob_url: file.blob_url,
            raw_url: file.raw_url,
            contents_url: file.contents_url,
            patch: file.patch,
            result: undefined
          };
        }
      })
    );

    // Calculate summary
    const summary = {
      totalFiles: processedFiles.length,
      filesWithDifferences: processedFiles.filter(f => f.result && f.result.changes.length > 0).length,
      totalAdditions: processedFiles.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: processedFiles.reduce((sum, f) => sum + f.deletions, 0),
      configFiles: processedFiles.length,
      processingTime: performance.now() - startTime
    };

    return {
      repository: {
        owner: options.owner,
        name: options.repo,
        full_name: repoInfo.full_name,
        html_url: repoInfo.html_url
      },
      comparison: {
        base_commit: comparison.base_commit,
        head_commit: comparison.head_commit,
        ahead_by: comparison.ahead_by,
        behind_by: comparison.behind_by,
        total_commits: comparison.total_commits,
        html_url: comparison.html_url
      },
      files: processedFiles,
      summary
    };
  }

  private async compareFileVersions(
    owner: string,
    repo: string,
    path: string,
    leftRef: string,
    rightRef: string,
    diffOptions: DiffOptions = {} as DiffOptions
  ): Promise<ComparisonResult> {
    // Get file content from both refs
    const [leftContent, rightContent] = await Promise.all([
      this.getFileContent(owner, repo, path, leftRef),
      this.getFileContent(owner, repo, path, rightRef)
    ]);

    // Parse files
    const leftFormat = detectFormat(path, leftContent);
    const rightFormat = detectFormat(path, rightContent);

    const leftParsed = parseConfig(leftContent, leftFormat, path);
    const rightParsed = parseConfig(rightContent, rightFormat, path);

    if (leftParsed.error || rightParsed.error) {
      throw new Error(`Parsing failed: ${leftParsed.error || rightParsed.error}`);
    }

    // Create ConfigFile objects
    const leftFile: ConfigFile = {
      name: `${path}@${leftRef}`,
      content: leftContent,
      format: leftFormat,
      parsedContent: leftParsed.data
    };

    const rightFile: ConfigFile = {
      name: `${path}@${rightRef}`,
      content: rightContent,
      format: rightFormat,
      parsedContent: rightParsed.data
    };

    // Generate diff
    return generateDiff(leftFile, rightFile, diffOptions);
  }

  private matchPattern(filename: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // * matches any characters
      .replace(/\?/g, '.'); // ? matches single character

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(filename);
    } catch {
      return false;
    }
  }

  async searchRepositories(query: string, sort: 'stars' | 'forks' | 'help-wanted-issues' | 'updated' = 'stars'): Promise<any> {
    const params = new URLSearchParams({
      q: query,
      sort,
      order: 'desc'
    });

    return this.makeRequest(`/search/repositories?${params}`);
  }

  async getRepository(owner: string, repo: string): Promise<any> {
    return this.makeRequest(`/repos/${owner}/${repo}`);
  }

  async findConfigFiles(owner: string, repo: string, ref?: string, path: string = ''): Promise<GitHubFile[]> {
    const configExtensions = ['.json', '.yaml', '.yml', '.xml', '.ini', '.toml', '.env', '.hcl', '.tf', '.properties', '.csv', '.config', '.conf'];
    const configFiles: GitHubFile[] = [];

    const processDirectory = async (currentPath: string, depth: number = 0): Promise<void> => {
      if (depth > 5) return; // Prevent infinite recursion

      try {
        const contents = await this.getDirectoryContents(owner, repo, currentPath, ref);

        for (const item of contents) {
          if (item.type === 'file') {
            const isConfigFile = configExtensions.some(ext => 
              item.name.toLowerCase().endsWith(ext)
            );

            if (isConfigFile) {
              configFiles.push(item);
            }
          } else if (item.type === 'dir') {
            // Recursively process subdirectories
            await processDirectory(item.path, depth + 1);
          }
        }
      } catch (error) {
        console.error(`Error processing directory ${currentPath}:`, error);
      }
    };

    await processDirectory(path);
    return configFiles;
  }

  async compareConfigsBetweenBranches(
    owner: string,
    repo: string,
    baseBranch: string,
    headBranch: string,
    options: {
      path?: string;
      recursive?: boolean;
      includePatterns?: string[];
      excludePatterns?: string[];
      diffOptions?: DiffOptions;
    } = {}
  ): Promise<GitHubComparisonResult> {
    return this.compareFiles({
      owner,
      repo,
      leftRef: baseBranch,
      rightRef: headBranch,
      ...options
    });
  }

  async compareConfigsAtCommits(
    owner: string,
    repo: string,
    baseCommit: string,
    headCommit: string,
    options: {
      path?: string;
      recursive?: boolean;
      includePatterns?: string[];
      excludePatterns?: string[];
      diffOptions?: DiffOptions;
    } = {}
  ): Promise<GitHubComparisonResult> {
    return this.compareFiles({
      owner,
      repo,
      leftRef: baseCommit,
      rightRef: headCommit,
      ...options
    });
  }

  async getPullRequestConfigDiff(
    owner: string,
    repo: string,
    pullNumber: number,
    options: {
      diffOptions?: DiffOptions;
      includePatterns?: string[];
      excludePatterns?: string[];
    } = {}
  ): Promise<GitHubComparisonResult> {
    // Get PR information
    const pr = await this.makeRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    
    return this.compareFiles({
      owner,
      repo,
      leftRef: pr.base.sha,
      rightRef: pr.head.sha,
      ...options
    });
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async testAuthentication(): Promise<boolean> {
    try {
      await this.makeRequest('/user');
      return true;
    } catch {
      return false;
    }
  }

  async getRateLimit(): Promise<any> {
    return this.makeRequest('/rate_limit');
  }
}

// Utility functions
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /github\.com\/([^\/]+)\/([^\/]+)\.git/,
    /^([^\/]+)\/([^\/]+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', '')
      };
    }
  }

  return null;
}

export function isValidGitHubRef(ref: string): boolean {
  // Basic validation for GitHub refs (branches, tags, SHAs)
  return /^[a-zA-Z0-9._\-\/]+$/.test(ref) && ref.length > 0 && ref.length <= 250;
}

export function formatGitHubUrl(owner: string, repo: string, ref?: string, path?: string): string {
  let url = `https://github.com/${owner}/${repo}`;
  
  if (ref) {
    url += `/tree/${ref}`;
  }
  
  if (path) {
    url += `/${path}`;
  }
  
  return url;
}

export function getGitHubFileUrl(owner: string, repo: string, path: string, ref?: string): string {
  const baseUrl = `https://github.com/${owner}/${repo}/blob`;
  const refPart = ref || 'main';
  return `${baseUrl}/${refPart}/${path}`;
}

export function getGitHubRawUrl(owner: string, repo: string, path: string, ref?: string): string {
  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}`;
  const refPart = ref || 'main';
  return `${baseUrl}/${refPart}/${path}`;
}