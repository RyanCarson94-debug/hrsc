/**
 * useAppState
 *
 * Loads all data from /api on mount.
 * Exposes the state object plus typed save/delete helpers.
 * Each helper calls the API then updates local state so the UI
 * stays snappy without a full refetch.
 */

import { useState, useEffect, useCallback } from "react";
import * as api from "./api";
import { DEFAULT_SETTINGS, DEFAULT_CLAUSES, DEFAULT_TEMPLATES, DEFAULT_RULES } from "./defaults";

function getCurrentUser() {
  return localStorage.getItem("hrsc_user_name") || "Unknown";
}

function audit(action, recordType, recordName, detail = {}) {
  api.logAudit({
    action,
    recordType,
    recordName,
    detail,
    userName: getCurrentUser(),
    timestamp: new Date().toISOString(),
  }).catch(() => {}); // fire-and-forget, never block UI
}

export function useAppState() {
  const [state, setState] = useState({
    settings:  DEFAULT_SETTINGS,
    templates: DEFAULT_TEMPLATES,
    clauses:   DEFAULT_CLAUSES,
    rules:     DEFAULT_RULES,
  });
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    Promise.all([
      api.getSettings(),
      api.getTemplates(),
      api.getClauses(),
      api.getRules(),
      api.getUsers().catch(() => []),
    ])
      .then(([settings, templates, clauses, rules, users]) => {
        setState({
          settings:  settings  || DEFAULT_SETTINGS,
          templates: templates.length ? templates : DEFAULT_TEMPLATES,
          clauses:   clauses.length   ? clauses   : DEFAULT_CLAUSES,
          rules:     rules.length     ? rules     : DEFAULT_RULES,
        });
        setUsers(Array.isArray(users) ? users : []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = useCallback(async (newSettings) => {
    await api.saveSettings(newSettings);
    setState(s => ({ ...s, settings: newSettings }));
    audit("update", "settings", "Settings", {});
  }, []);

  const saveTemplate = useCallback(async (tmpl, isNew) => {
    if (isNew) {
      await api.createTemplate(tmpl);
      setState(s => ({ ...s, templates: [...s.templates, tmpl] }));
      audit("create", "template", tmpl.name, { country: tmpl.country, entityId: tmpl.entityId });
    } else {
      await api.updateTemplate(tmpl.id, tmpl);
      setState(s => ({ ...s, templates: s.templates.map(t => t.id === tmpl.id ? tmpl : t) }));
      audit("update", "template", tmpl.name, { country: tmpl.country, entityId: tmpl.entityId });
    }
  }, []);

  const removeTemplate = useCallback(async (id, name) => {
    await api.deleteTemplate(id);
    setState(s => ({ ...s, templates: s.templates.filter(t => t.id !== id) }));
    audit("delete", "template", name || id, {});
  }, []);

  const saveClause = useCallback(async (clause, isNew) => {
    if (isNew) {
      await api.createClause(clause);
      const { _savedBy: _, ...clean } = clause;
      setState(s => ({ ...s, clauses: [...s.clauses, clean] }));
      audit("create", "clause", clause.name, { global: clause.global, tags: clause.tags });
    } else {
      await api.updateClause(clause.id, clause);
      const { _savedBy: _, ...clean } = clause;
      setState(s => ({ ...s, clauses: s.clauses.map(c => c.id === clause.id ? clean : c) }));
      audit("update", "clause", clause.name, { global: clause.global, tags: clause.tags });
    }
  }, []);

  const removeClause = useCallback(async (id, name) => {
    await api.deleteClause(id);
    setState(s => ({ ...s, clauses: s.clauses.filter(c => c.id !== id) }));
    audit("delete", "clause", name || id, {});
  }, []);

  const duplicateClause = useCallback(async (clause) => {
    const copy = {
      ...JSON.parse(JSON.stringify(clause)),
      id:   Math.random().toString(36).slice(2, 10),
      name: `${clause.name} (copy)`,
    };
    await api.createClause(copy);
    setState(s => ({ ...s, clauses: [...s.clauses, copy] }));
    audit("create", "clause", copy.name, { global: copy.global, tags: copy.tags });
    return copy;
  }, []);

  const saveRule = useCallback(async (rule, isNew) => {
    if (isNew) {
      await api.createRule(rule);
      setState(s => ({ ...s, rules: [...s.rules, rule] }));
      audit("create", "rule", rule.name, { country: rule.country, priority: rule.priority });
    } else {
      await api.updateRule(rule.id, rule);
      setState(s => ({ ...s, rules: s.rules.map(r => r.id === rule.id ? rule : r) }));
      audit("update", "rule", rule.name, { country: rule.country, priority: rule.priority });
    }
  }, []);

  const removeRule = useCallback(async (id, name) => {
    await api.deleteRule(id);
    setState(s => ({ ...s, rules: s.rules.filter(r => r.id !== id) }));
    audit("delete", "rule", name || id, {});
  }, []);

  const duplicateRule = useCallback(async (rule) => {
    const copy = {
      ...JSON.parse(JSON.stringify(rule)),
      id:       Math.random().toString(36).slice(2, 10),
      name:     `${rule.name} (copy)`,
      priority: rule.priority + 1,
    };
    await api.createRule(copy);
    setState(s => ({ ...s, rules: [...s.rules, copy] }));
    audit("create", "rule", copy.name, { country: copy.country, priority: copy.priority });
    return copy;
  }, []);

  const toggleRule = useCallback(async (id) => {
    const rule = state.rules.find(r => r.id === id);
    if (!rule) return;
    const updated = { ...rule, active: !rule.active };
    await api.updateRule(id, updated);
    setState(s => ({ ...s, rules: s.rules.map(r => r.id === id ? updated : r) }));
    audit(updated.active ? "enable" : "disable", "rule", rule.name, {});
  }, [state.rules]);

  const saveUser = useCallback(async (user, isNew) => {
    if (isNew) {
      const created = await api.createUser(user);
      setUsers(u => [...u, { ...user, id: created.id || user.id }]);
      audit("create", "settings", `User: ${user.name}`, { role: user.role });
    } else {
      await api.updateUser(user.id, user);
      setUsers(u => u.map(x => x.id === user.id ? user : x));
      audit("update", "settings", `User: ${user.name}`, { role: user.role });
    }
  }, []);

  const removeUser = useCallback(async (id) => {
    const user = users.find(u => u.id === id);
    await api.deleteUser(id);
    setUsers(u => u.filter(x => x.id !== id));
    if (user) audit("delete", "settings", `User: ${user.name}`, {});
  }, [users]);

  const duplicateTemplate = useCallback(async (tmpl) => {
    const copy = JSON.parse(JSON.stringify(tmpl));
    copy.id   = Math.random().toString(36).slice(2, 10);
    copy.name = `${tmpl.name} (copy)`;
    copy.sections = copy.sections.map(s => ({ ...s, id: Math.random().toString(36).slice(2, 10) }));
    await api.createTemplate(copy);
    setState(s => ({ ...s, templates: [...s.templates, copy] }));
    audit("create", "template", copy.name, { country: copy.country, entityId: copy.entityId });
    return copy;
  }, []);

  return {
    state, users, loading, error, setState,
    saveSettings,
    saveTemplate, duplicateTemplate, removeTemplate,
    saveClause,   duplicateClause,  removeClause,
    saveRule,     duplicateRule,    removeRule, toggleRule,
    saveUser,     removeUser,
  };
}
