/**
 * ruleEngine.js
 * Pure rule evaluation logic — no React, no side effects.
 * Shared by GenerateTab, RulesTab (tester), and BulkGenerate.
 */

export function evalCond(c, data) {
  const v = String(data[c.field] || ""), cv = c.value;
  switch (c.operator) {
    case "equals":     return v.toLowerCase() === String(cv).toLowerCase();
    case "not_equals": return v.toLowerCase() !== String(cv).toLowerCase();
    case "gte":        return parseFloat(v) >= parseFloat(cv);
    case "lte":        return parseFloat(v) <= parseFloat(cv);
    case "in":         return Array.isArray(cv) ? cv.map(x => x.toLowerCase()).includes(v.toLowerCase()) : false;
    default:           return false;
  }
}

export function evalRule(r, data) {
  if (!r.active) return false;
  const res = r.conditions.map(c => evalCond(c, data));
  return r.conditionLogic === "AND" ? res.every(Boolean) : res.some(Boolean);
}

export function resolveTemplate(tmpl, rules, data, disabledRuleIds = new Set()) {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  let sections = JSON.parse(JSON.stringify(tmpl.sections));
  sorted.forEach(rule => {
    if (disabledRuleIds.has(rule.id)) return;
    if (rule.action.targetTemplateId && rule.action.targetTemplateId !== tmpl.id) return;
    if (!evalRule(rule, data)) return;
    const { type, targetSectionId, clauseId } = rule.action;
    if (type === "replace_clause" && targetSectionId) sections = sections.map(s => s.id === targetSectionId ? { ...s, clauseId } : s);
    if (type === "use_clause"     && targetSectionId) sections = sections.map(s => s.id === targetSectionId ? { ...s, clauseId, content: undefined } : s);
    if (type === "remove_clause"  && targetSectionId) sections = sections.filter(s => s.id !== targetSectionId);
    if (type === "add_clause") {
      if (!sections.some(s => s.clauseId === clauseId)) {
        sections.push({ id: `inj-${clauseId}`, name: "Additional Clause", clauseId, level: 1, required: false, ruleSlot: false });
      }
    }
  });
  return sections;
}

/**
 * Compute all set_variable values for a given data set.
 * Returns { computedVars, unresolved } where unresolved is an array
 * of { key, label } for computed vars with no rule match AND no default.
 */
export function computeVariables(rules, sections, clauses, data, disabledRuleIds = new Set()) {
  const computedAccum = {};
  rules
    .filter(r => r.active && r.action.type === "set_variable" && !disabledRuleIds.has(r.id) && evalRule(r, data))
    .forEach(r => {
      const key = r.action.variableKey;
      if (!key) return;
      if (!computedAccum[key]) computedAccum[key] = [];
      computedAccum[key].push(r.action.variableValue || "0");
    });

  const computedVars = {};
  Object.entries(computedAccum).forEach(([key, values]) => {
    const nums = values.map(v => parseFloat(v));
    computedVars[key] = nums.every(n => !isNaN(n))
      ? String(nums.reduce((a, b) => a + b, 0))
      : values.join(" ");
  });

  const allComputedKeys = new Set();
  sections.forEach(s => {
    const cl = s.clauseId ? clauses.find(c => c.id === s.clauseId) : null;
    if (cl) cl.variables.filter(v => v.type === "computed").forEach(v => allComputedKeys.add({ key: v.key, defaultValue: v.defaultValue, label: v.label }));
  });

  const unresolved = [];
  allComputedKeys.forEach(({ key, defaultValue, label }) => {
    if (!(key in computedVars)) {
      if (defaultValue !== undefined && defaultValue !== "") {
        computedVars[key] = defaultValue;
      } else {
        unresolved.push(label || key);
      }
    }
  });

  return { computedVars, unresolved };
}

/**
 * Detect conflicting rules: two active rules targeting the same
 * template+section but with different clauseIds.
 * Returns array of { ruleA, ruleB, templateId, sectionId }.
 */
export function detectConflicts(rules) {
  const conflicts = [];
  const active = rules.filter(r => r.active && ["replace_clause", "use_clause"].includes(r.action.type));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (
        a.action.targetTemplateId === b.action.targetTemplateId &&
        a.action.targetSectionId  === b.action.targetSectionId  &&
        a.action.targetSectionId  !== "" &&
        a.action.clauseId !== b.action.clauseId
      ) {
        conflicts.push({ ruleA: a, ruleB: b, templateId: a.action.targetTemplateId, sectionId: a.action.targetSectionId });
      }
    }
  }
  return conflicts;
}
