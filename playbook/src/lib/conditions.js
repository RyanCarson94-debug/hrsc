/**
 * Evaluates whether a step should be shown given the adviser's intake answers.
 *
 * Condition JSON shapes:
 *   {"always": true}                              → always show
 *   {"country": "DE"}                             → exact match
 *   {"termination_type": ["Voluntary","Involuntary"]} → any of
 *   {"country": "DE", "termination_type": "Involuntary"} → all must match
 *
 * Special case: {"notice_waived": "true"} — boolean fields stored as "true"/"false" strings
 * because form values are always strings.
 */
export function evaluateConditions(conditions, intakeData) {
  if (!conditions) return true
  let parsed = conditions
  if (typeof conditions === 'string') {
    try { parsed = JSON.parse(conditions) } catch { return true }
  }
  if (parsed.always === true) return true

  return Object.entries(parsed).every(([key, expected]) => {
    if (key === 'always') return expected === true
    const actual = intakeData[key]
    if (Array.isArray(expected)) return expected.includes(actual)
    return String(actual) === String(expected)
  })
}
