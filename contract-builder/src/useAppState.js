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

export function useAppState() {
  const [state, setState] = useState({
    settings:  DEFAULT_SETTINGS,
    templates: DEFAULT_TEMPLATES,
    clauses:   DEFAULT_CLAUSES,
    rules:     DEFAULT_RULES,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.getSettings(),
      api.getTemplates(),
      api.getClauses(),
      api.getRules(),
    ])
      .then(([settings, templates, clauses, rules]) => {
        setState({
          settings:  settings  || DEFAULT_SETTINGS,
          templates: templates.length ? templates : DEFAULT_TEMPLATES,
          clauses:   clauses.length   ? clauses   : DEFAULT_CLAUSES,
          rules:     rules.length     ? rules     : DEFAULT_RULES,
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Settings ─────────────────────────────────────────────────────────────────
  const saveSettings = useCallback(async (newSettings) => {
    await api.saveSettings(newSettings);
    setState(s => ({ ...s, settings: newSettings }));
  }, []);

  // ── Templates ────────────────────────────────────────────────────────────────
  const saveTemplate = useCallback(async (tmpl, isNew) => {
    if (isNew) {
      await api.createTemplate(tmpl);
      setState(s => ({ ...s, templates: [...s.templates, tmpl] }));
    } else {
      await api.updateTemplate(tmpl.id, tmpl);
      setState(s => ({ ...s, templates: s.templates.map(t => t.id === tmpl.id ? tmpl : t) }));
    }
  }, []);

  const removeTemplate = useCallback(async (id) => {
    await api.deleteTemplate(id);
    setState(s => ({ ...s, templates: s.templates.filter(t => t.id !== id) }));
  }, []);

  // ── Clauses ──────────────────────────────────────────────────────────────────
  const saveClause = useCallback(async (clause, isNew) => {
    if (isNew) {
      await api.createClause(clause);
      setState(s => ({ ...s, clauses: [...s.clauses, clause] }));
    } else {
      await api.updateClause(clause.id, clause);
      setState(s => ({ ...s, clauses: s.clauses.map(c => c.id === clause.id ? clause : c) }));
    }
  }, []);

  const removeClause = useCallback(async (id) => {
    await api.deleteClause(id);
    setState(s => ({ ...s, clauses: s.clauses.filter(c => c.id !== id) }));
  }, []);

  // ── Rules ────────────────────────────────────────────────────────────────────
  const saveRule = useCallback(async (rule, isNew) => {
    if (isNew) {
      await api.createRule(rule);
      setState(s => ({ ...s, rules: [...s.rules, rule] }));
    } else {
      await api.updateRule(rule.id, rule);
      setState(s => ({ ...s, rules: s.rules.map(r => r.id === rule.id ? rule : r) }));
    }
  }, []);

  const removeRule = useCallback(async (id) => {
    await api.deleteRule(id);
    setState(s => ({ ...s, rules: s.rules.filter(r => r.id !== id) }));
  }, []);

  const toggleRule = useCallback(async (id) => {
    const rule = state.rules.find(r => r.id === id);
    if (!rule) return;
    const updated = { ...rule, active: !rule.active };
    await api.updateRule(id, updated);
    setState(s => ({ ...s, rules: s.rules.map(r => r.id === id ? updated : r) }));
  }, [state.rules]);

  return {
    state,
    loading,
    error,
    // direct setter for legacy inline state mutations (Settings tab)
    setState,
    // typed helpers
    saveSettings,
    saveTemplate,  removeTemplate,
    saveClause,    removeClause,
    saveRule,      removeRule,    toggleRule,
  };
}
