import React from 'react';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import type { TaxonomyNode, TreeNodeUI } from '@/types';
import { NODE_TYPE_COLORS, STATUS_COLORS } from '@/types';
import { Badge } from '@/components/ui';

// ---------------------------------------------------------------------------
// TreeRow
// ---------------------------------------------------------------------------

interface TreeRowProps {
  node: TreeNodeUI;
  allNodes: TaxonomyNode[];
  expandedIds: Set<string>;
  selectedNodeId: string | null;
  onSelect: (node: TaxonomyNode) => void;
  onToggleExpand: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onEdit?: (node: TaxonomyNode) => void;
  onDelete?: (node: TaxonomyNode) => void;
}

const TreeRow: React.FC<TreeRowProps> = ({
  node,
  allNodes,
  expandedIds,
  selectedNodeId,
  onSelect,
  onToggleExpand,
  onAddChild,
  onEdit,
  onDelete,
}) => {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const depth = node.depth ?? 0;

  const indentPx = depth * 16 + 8;

  return (
    <>
      <div
        className={[
          'group flex items-center h-9 text-sm cursor-pointer select-none transition-colors relative',
          isSelected
            ? 'bg-brand-600/20 border-l-2 border-brand-500'
            : 'hover:bg-slate-800/60 border-l-2 border-transparent',
        ].join(' ')}
        style={{ paddingLeft: `${indentPx}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand / collapse toggle */}
        <span
          className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-slate-500 hover:text-slate-300 mr-1"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700 inline-block" />
          )}
        </span>

        {/* Node type badge */}
        <Badge
          label={node.node_type}
          className={[
            NODE_TYPE_COLORS[node.node_type],
            'mr-1.5 hidden sm:inline-flex',
          ].join(' ')}
        />

        {/* Code */}
        <span className="font-mono text-xs text-slate-400 mr-1.5 flex-shrink-0 hidden md:inline">
          {node.code}
        </span>

        {/* Name */}
        <span
          className={[
            'flex-1 min-w-0 truncate',
            isSelected ? 'text-brand-200' : 'text-slate-200',
          ].join(' ')}
        >
          {node.name}
        </span>

        {/* Status badge */}
        <Badge
          label={node.status}
          dot
          className={[STATUS_COLORS[node.status], 'mx-2 flex-shrink-0 hidden sm:inline-flex'].join(' ')}
        />

        {/* Action buttons — appear on hover */}
        <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onAddChild && (
            <button
              title="Add child"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node.id);
              }}
              className="p-1 rounded text-slate-500 hover:text-green-400 hover:bg-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {onEdit && (
            <button
              title="Edit node"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node);
              }}
              className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              title="Delete node"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node);
              }}
              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            allNodes={allNodes}
            expandedIds={expandedIds}
            selectedNodeId={selectedNodeId}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      }
    </>
  );
};

// ---------------------------------------------------------------------------
// TreeView
// ---------------------------------------------------------------------------

export interface TreeViewProps {
  nodes: TreeNodeUI[];
  allNodes: TaxonomyNode[];
  expandedIds: Set<string>;
  selectedNodeId: string | null;
  onSelect: (node: TaxonomyNode) => void;
  onToggleExpand: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onEdit?: (node: TaxonomyNode) => void;
  onDelete?: (node: TaxonomyNode) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  nodes,
  allNodes,
  expandedIds,
  selectedNodeId,
  onSelect,
  onToggleExpand,
  onAddChild,
  onEdit,
  onDelete,
}) => {
  if (!nodes.length) {
    return (
      <div className="py-12 text-center text-slate-500 text-sm">
        No nodes to display.
      </div>
    );
  }

  return (
    <div className="w-full">
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          allNodes={allNodes}
          expandedIds={expandedIds}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// NodeBreadcrumb
// ---------------------------------------------------------------------------

export interface NodeBreadcrumbProps {
  node: TaxonomyNode | null;
  allNodes: TaxonomyNode[];
}

export const NodeBreadcrumb: React.FC<NodeBreadcrumbProps> = ({ node, allNodes }) => {
  if (!node) return null;

  // Build ancestor chain
  const chain: TaxonomyNode[] = [];
  let current: TaxonomyNode | undefined = node;
  while (current) {
    chain.unshift(current);
    current = current.parent_id
      ? allNodes.find((n) => n.id === current!.parent_id)
      : undefined;
  }

  return (
    <nav className="flex items-center gap-1 text-xs text-slate-400 flex-wrap">
      {chain.map((n, idx) => {
        const isLast = idx === chain.length - 1;
        return (
          <React.Fragment key={n.id}>
            {idx > 0 && <span className="text-slate-600">/</span>}
            <span className={isLast ? 'text-white font-medium' : 'text-slate-400'}>
              {n.name}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default TreeView;
