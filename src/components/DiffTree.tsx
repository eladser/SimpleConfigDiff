import { useState } from 'react';
import { DiffChange } from '@/types';
import { ChevronDown, ChevronRight, Plus, Minus, RefreshCw, Folder, FolderOpen } from 'lucide-react';
import { formatValue } from '@/utils/generateDiff';

interface DiffTreeProps {
  changes: DiffChange[];
  viewMode: 'tree' | 'flat';
}

interface TreeNode {
  path: string;
  key: string;
  children: TreeNode[];
  change?: DiffChange;
  isFolder: boolean;
}

export function DiffTree({ changes, viewMode }: DiffTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };
  
  const buildTree = (changes: DiffChange[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();
    
    // Create root nodes for each change
    changes.forEach(change => {
      const pathParts = change.path.split('.');
      let currentPath = '';
      
      pathParts.forEach((part, index) => {
        const isLast = index === pathParts.length - 1;
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}.${part}` : part;
        
        if (!nodeMap.has(currentPath)) {
          const node: TreeNode = {
            path: currentPath,
            key: part,
            children: [],
            change: isLast ? change : undefined,
            isFolder: !isLast
          };
          
          nodeMap.set(currentPath, node);
          
          if (parentPath) {
            const parent = nodeMap.get(parentPath);
            if (parent) {
              parent.children.push(node);
            }
          } else {
            tree.push(node);
          }
        } else if (isLast) {
          // Update existing node with change
          const node = nodeMap.get(currentPath)!;
          node.change = change;
          node.isFolder = false;
        }
      });
    });
    
    return tree;
  };
  
  const getChangeIcon = (type: DiffChange['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'changed':
        return <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };
  
  const getChangeClass = (type: DiffChange['type']) => {
    switch (type) {
      case 'added':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500';
      case 'changed':
        return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500';
      default:
        return '';
    }
  };
  
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.path);
    const hasChildren = node.children.length > 0;
    
    return (
      <div key={node.path} className="select-none">
        <div
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
            node.change ? getChangeClass(node.change.type) : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleNode(node.path)}
              className="flex items-center justify-center w-4 h-4 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              )}
            </button>
          )}
          
          {!hasChildren && <div className="w-4" />}
          
          {node.isFolder ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            ) : (
              <Folder className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )
          ) : (
            node.change && getChangeIcon(node.change.type)
          )}
          
          <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
            {node.key}
          </span>
          
          {node.change && (
            <div className="flex items-center gap-2 ml-auto">
              {node.change.type === 'changed' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-600 dark:text-red-400 font-mono">
                    {formatValue(node.change.oldValue)}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">→</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatValue(node.change.newValue)}
                  </span>
                </div>
              )}
              
              {node.change.type === 'added' && (
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {formatValue(node.change.newValue)}
                </span>
              )}
              
              {node.change.type === 'removed' && (
                <span className="text-red-600 dark:text-red-400 font-mono text-sm">
                  {formatValue(node.change.oldValue)}
                </span>
              )}
            </div>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };
  
  const renderFlatView = () => {
    return (
      <div className="space-y-2">
        {changes.map((change, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 p-3 rounded-lg ${getChangeClass(change.type)}`}
          >
            {getChangeIcon(change.type)}
            
            <div className="flex-1">
              <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                {change.path}
              </div>
              
              <div className="flex items-center gap-2 mt-1 text-sm">
                {change.type === 'changed' && (
                  <>
                    <span className="text-red-600 dark:text-red-400 font-mono">
                      {formatValue(change.oldValue)}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">→</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatValue(change.newValue)}
                    </span>
                  </>
                )}
                
                {change.type === 'added' && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatValue(change.newValue)}
                  </span>
                )}
                
                {change.type === 'removed' && (
                  <span className="text-red-600 dark:text-red-400 font-mono">
                    {formatValue(change.oldValue)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  if (viewMode === 'flat') {
    return renderFlatView();
  }
  
  const tree = buildTree(changes);
  
  return (
    <div className="space-y-1">
      {tree.map(node => renderTreeNode(node))}
    </div>
  );
}