import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { TaxonomyNode, NodeType, NodeStatus, NodeFormValues } from '@/types';
import { NODE_TYPE_LABELS } from '@/types';
import { api } from '@/lib/api';
import { Modal, Button, Input, Textarea, Select, Tabs } from '@/components/ui';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NodeEditorProps {
  open: boolean;
  onClose: () => void;
  frameworkId: string;
  node?: TaxonomyNode | null;
  parentId?: string | null;
  allNodes: TaxonomyNode[];
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const nodeTypeOptions = Object.entries(NODE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const statusOptions: { value: string; label: string }[] = [
  { value: 'draft',   label: 'Draft' },
  { value: 'active',  label: 'Active' },
  { value: 'retired', label: 'Retired' },
];

const editorTabs = [
  { id: 'general',       label: 'General' },
  { id: 'governance',    label: 'Governance' },
  { id: 'applicability', label: 'Applicability' },
  { id: 'metadata',      label: 'Metadata' },
];

function parseJsonArray(raw: string): string {
  if (!raw) return '';
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.join(', ');
  } catch {
    // fall through
  }
  return raw;
}

function toJsonArray(csv: string): string {
  if (!csv.trim()) return '[]';
  const items = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

const EMPTY_FORM: NodeFormValues = {
  parent_id: '',
  code: '',
  name: '',
  description: '',
  node_type: 'process' as NodeType,
  status: 'draft' as NodeStatus,
  owner: '',
  steward: '',
  approver: '',
  effective_from: '',
  effective_to: '',
  version_label: '',
  synonyms: '',
  keywords: '',
  region_applicability: '',
  country_applicability: '',
  business_unit_applicability: '',
  notes: '',
  source_reference: '',
  sort_order: '0',
  change_note: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NodeEditor: React.FC<NodeEditorProps> = ({
  open,
  onClose,
  frameworkId,
  node,
  parentId,
  allNodes,
  onSaved,
}) => {
  const isEdit = Boolean(node);
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState<NodeFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NodeFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Populate form when node changes
  useEffect(() => {
    if (!open) return;
    setActiveTab('general');
    setErrors({});
    setSaveError(null);

    if (node) {
      setForm({
        parent_id:                    node.parent_id ?? '',
        code:                         node.code,
        name:                         node.name,
        description:                  node.description ?? '',
        node_type:                    node.node_type,
        status:                       node.status,
        owner:                        node.owner ?? '',
        steward:                      node.steward ?? '',
        approver:                     node.approver ?? '',
        effective_from:               node.effective_from ?? '',
        effective_to:                 node.effective_to ?? '',
        version_label:                node.version_label ?? '',
        synonyms:                     parseJsonArray(node.synonyms),
        keywords:                     parseJsonArray(node.keywords),
        region_applicability:         node.region_applicability ?? '',
        country_applicability:        node.country_applicability ?? '',
        business_unit_applicability:  node.business_unit_applicability ?? '',
        notes:                        node.notes ?? '',
        source_reference:             node.source_reference ?? '',
        sort_order:                   String(node.sort_order ?? 0),
        change_note:                  '',
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        parent_id: parentId ?? '',
      });
    }
  }, [open, node, parentId]);

  const set = (field: keyof NodeFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const validate = (): boolean => {
    const next: Partial<Record<keyof NodeFormValues, string>> = {};
    if (!form.code.trim()) next.code = 'Code is required';
    if (!form.name.trim()) next.name = 'Name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);

    try {
      const payload: Partial<NodeFormValues> = {
        ...form,
        parent_id:   form.parent_id || undefined,
        synonyms:    toJsonArray(form.synonyms),
        keywords:    toJsonArray(form.keywords),
        sort_order:  form.sort_order,
      };

      if (isEdit && node) {
        await api.nodes.update(node.id, payload);
      } else {
        await api.nodes.create(frameworkId, payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Build parent options — flat list of all nodes excluding self
  const parentOptions = allNodes
    .filter((n) => !node || n.id !== node.id)
    .map((n) => ({ value: n.id, label: `${n.code} — ${n.name}` }));

  const showChangeNoteWarning =
    isEdit &&
    node?.status === 'active' &&
    !form.change_note.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Node' : 'Create Node'}
      size="xl"
      footer={
        <>
          {saveError && (
            <span className="flex-1 text-xs text-red-400 mr-2">{saveError}</span>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Node'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Tabs tabs={editorTabs} active={activeTab} onChange={setActiveTab} />

        <div className="pt-1">
          {/* ── GENERAL ─────────────────────────────────────────────────── */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Code *"
                  value={form.code}
                  onChange={set('code')}
                  error={errors.code}
                  className="font-mono"
                  placeholder="e.g. HR-001"
                />
                <Input
                  label="Name *"
                  value={form.name}
                  onChange={set('name')}
                  error={errors.name}
                  placeholder="Node name"
                />
              </div>

              <Textarea
                label="Description"
                value={form.description}
                onChange={set('description')}
                placeholder="Optional description…"
              />

              <Select
                label="Parent Node"
                value={form.parent_id}
                onChange={set('parent_id')}
                options={parentOptions}
                placeholder="— None (root node) —"
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Node Type"
                  value={form.node_type}
                  onChange={set('node_type')}
                  options={nodeTypeOptions}
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={set('status')}
                  options={statusOptions}
                />
              </div>

              <Input
                label="Sort Order"
                type="number"
                value={form.sort_order}
                onChange={set('sort_order')}
                placeholder="0"
                className="w-32"
              />
            </div>
          )}

          {/* ── GOVERNANCE ──────────────────────────────────────────────── */}
          {activeTab === 'governance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Owner"
                  value={form.owner}
                  onChange={set('owner')}
                  placeholder="Owner name or team"
                />
                <Input
                  label="Steward"
                  value={form.steward}
                  onChange={set('steward')}
                  placeholder="Data steward"
                />
                <Input
                  label="Approver"
                  value={form.approver}
                  onChange={set('approver')}
                  placeholder="Approver"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Effective From"
                  type="date"
                  value={form.effective_from}
                  onChange={set('effective_from')}
                />
                <Input
                  label="Effective To"
                  type="date"
                  value={form.effective_to}
                  onChange={set('effective_to')}
                />
              </div>

              <Input
                label="Version Label"
                value={form.version_label}
                onChange={set('version_label')}
                placeholder="e.g. v1.0.0"
              />

              <div>
                <Textarea
                  label="Change Note"
                  value={form.change_note}
                  onChange={set('change_note')}
                  placeholder="Describe what changed and why…"
                  hint={showChangeNoteWarning ? undefined : 'Summarise the reason for this change'}
                />
                {showChangeNoteWarning && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      A change note is recommended when editing an active node.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── APPLICABILITY ───────────────────────────────────────────── */}
          {activeTab === 'applicability' && (
            <div className="space-y-4">
              <Input
                label="Region Applicability"
                value={form.region_applicability}
                onChange={set('region_applicability')}
                hint="e.g. Global, EMEA, APAC"
                placeholder="Global"
              />
              <Input
                label="Country Applicability"
                value={form.country_applicability}
                onChange={set('country_applicability')}
                hint="e.g. US, UK, DE"
                placeholder="All"
              />
              <Input
                label="Business Unit Applicability"
                value={form.business_unit_applicability}
                onChange={set('business_unit_applicability')}
                hint="e.g. All, Corporate"
                placeholder="All"
              />
            </div>
          )}

          {/* ── METADATA ────────────────────────────────────────────────── */}
          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <Input
                label="Synonyms"
                value={form.synonyms}
                onChange={set('synonyms')}
                hint="Comma-separated, e.g. Hire, Recruit, Onboard"
                placeholder="term one, term two"
              />
              <Input
                label="Keywords"
                value={form.keywords}
                onChange={set('keywords')}
                hint="Comma-separated"
                placeholder="keyword one, keyword two"
              />
              <Textarea
                label="Notes"
                value={form.notes}
                onChange={set('notes')}
                placeholder="Internal notes…"
              />
              <Input
                label="Source Reference"
                value={form.source_reference}
                onChange={set('source_reference')}
                placeholder="URL or document reference"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default NodeEditor;
