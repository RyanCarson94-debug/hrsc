import { useState } from "react";

// ─── Policy ───────────────────────────────────────────────────────────────────
const CSP_TIERS = [
  { minYears: 0, maxYears: 1,        fullDays: 15,  halfDays: 15  },
  { minYears: 1, maxYears: 5,        fullDays: 60,  halfDays: 60  },
  { minYears: 5, maxYears: Infinity, fullDays: 130, halfDays: 130 },
];

function getTier(completedYears) {
  return CSP_TIERS.find(t => completedYears >= t.minYears && completedYears < t.maxYears);
}

function completedYearsAt(startDate, refDate) {
  let years = refDate.getFullYear() - startDate.getFullYear();
  const m = refDate.getMonth() - startDate.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < startDate.getDate())) years--;
  return Math.max(0, years);
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// England & Wales bank holidays 2024–2027 (sourced from gov.uk)
const UK_BANK_HOLIDAYS = new Set([
  // 2024
  "2024-01-01","2024-03-29","2024-04-01","2024-05-06","2024-05-27","2024-08-26","2024-12-25","2024-12-26",
  // 2025
  "2025-01-01","2025-04-18","2025-04-21","2025-05-05","2025-05-26","2025-08-25","2025-12-25","2025-12-26",
  // 2026
  "2026-01-01","2026-04-03","2026-04-06","2026-05-04","2026-05-25","2026-08-31","2026-12-25","2026-12-28",
  // 2027
  "2027-01-01","2027-03-26","2027-03-29","2027-05-03","2027-05-31","2027-08-30","2027-12-27","2027-12-28",
  // 2028
  "2028-01-03","2028-04-14","2028-04-17","2028-05-01","2028-05-29","2028-08-28","2028-12-25","2028-12-26",
  // 2029
  "2029-01-01","2029-03-30","2029-04-02","2029-05-07","2029-05-28","2029-08-27","2029-12-25","2029-12-26",
  // 2030
  "2030-01-01","2030-04-19","2030-04-22","2030-05-06","2030-05-27","2030-08-26","2030-12-25","2030-12-26",
]);

function isBankHoliday(date) {
  return UK_BANK_HOLIDAYS.has(date.toISOString().slice(0, 10));
}

function isNonWorkingDay(date) {
  return isWeekend(date) || isBankHoliday(date);
}

// Add n working days to a date (skipping weekends and UK bank holidays)
function addWorkingDays(date, n) {
  let d = new Date(date);
  let added = 0;
  while (added < n) {
    d = addDays(d, 1);
    if (!isNonWorkingDay(d)) added++;
  }
  return d;
}

// Next working day after date (skipping weekends and bank holidays)
function nextWorkingDay(date) {
  let d = addDays(date, 1);
  while (isNonWorkingDay(d)) d = addDays(d, 1);
  return d;
}

// Count working days between two dates (inclusive)
function workingDaysBetween(from, to) {
  let count = 0;
  let d = new Date(from);
  while (d <= to) {
    if (!isWeekend(d)) count++;
    d = addDays(d, 1);
  }
  return count;
}

// ─── Parse absence data ───────────────────────────────────────────────────────
function parseAbsenceData(raw) {
  const lines = raw.trim().split("\n");
  const sickMap = new Map();
  const leaveMap = new Map();

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 6) continue;

    const type = (cols[3] || "").trim().toLowerCase();
    const rawDate = (cols[1] || "").trim();
    const qty = parseFloat((cols[4] || "0").trim());
    const unit = (cols[5] || "").trim().toLowerCase();

    const parts = rawDate.split("/");
    if (parts.length !== 3) continue;
    const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (isNaN(dateObj)) continue;
    if (isWeekend(dateObj)) continue;
    const key = dateObj.toISOString().slice(0, 10);

    if (type.includes("sickness")) {
      if (unit === "hours" || unit === "hour") continue;
      sickMap.set(key, (sickMap.get(key) || 0) + qty);
    } else if (type.includes("annual leave")) {
      leaveMap.set(key, (leaveMap.get(key) || 0) + qty);
    }
  }

  const sickDays = Array.from(sickMap.entries())
    .filter(([, net]) => net > 0)
    .map(([key]) => new Date(key))
    .sort((a, b) => a - b);

  const annualLeaveSet = new Set(
    Array.from(leaveMap.entries())
      .filter(([, net]) => net > 0)
      .map(([key]) => key)
  );

  return { sickDays, annualLeaveSet };
}

// ─── Group sick days into episodes ───────────────────────────────────────────
// Two sick days are in the same episode if every working day between them
// is covered by: weekends, bank holidays, or annual leave.
function groupEpisodes(sickDays, annualLeaveSet) {
  if (sickDays.length === 0) return [];
  const episodes = [];
  let current = [sickDays[0]];

  for (let i = 1; i < sickDays.length; i++) {
    const prev = current[current.length - 1];
    const next = sickDays[i];

    // Walk every day in the gap — if every working day is AL or bank holiday, same episode
    let gapIsContinuous = true;
    let d = addDays(prev, 1);
    while (d < next) {
      const key = d.toISOString().slice(0, 10);
      if (!isNonWorkingDay(d) && !annualLeaveSet.has(key)) {
        gapIsContinuous = false;
        break;
      }
      d = addDays(d, 1);
    }

    if (gapIsContinuous) {
      current.push(next);
    } else {
      episodes.push(current);
      current = [next];
    }
  }
  episodes.push(current);
  return episodes;
}

// ─── Core calculation ─────────────────────────────────────────────────────────
function calculate(startDate, queryDate, sickDays, annualLeaveSet) {
  const windowStart = addDays(queryDate, -364);

  // All sick days in rolling window
  const windowSickDays = sickDays.filter(d => d >= windowStart && d <= queryDate);

  // Group into episodes (all-time, so we can check re-eligibility history)
  const allEpisodes = groupEpisodes(sickDays, annualLeaveSet);

  // For each episode, lock the tier on the first day
  // Then walk through window episodes accumulating consumption
  // We need to track: running consumed days within the window, per episode

  // Build a timeline of episodes that overlap with window
  const windowEpisodes = [];
  for (const ep of allEpisodes) {
    const epDaysInWindow = ep.filter(d => d >= windowStart && d <= queryDate);
    if (epDaysInWindow.length === 0) continue;
    const firstDay = ep[0]; // tier locked on first day of episode (may be before window)
    const years = completedYearsAt(startDate, firstDay);
    const tier = getTier(years);
    windowEpisodes.push({
      firstDay,
      days: epDaysInWindow,
      count: epDaysInWindow.length,
      tier,
      allDays: ep,
    });
  }

  // Walk episodes in order. Each episode's tier is locked on its first day.
  // We track consumed full and half days as independent running buckets.
  // When a new episode starts at a higher tier, the larger buckets simply
  // absorb the historical consumption — e.g. 30 full + 10 half consumed,
  // then tier upgrades to 50/50: full remaining = 50-30 = 20, half remaining = 50-10 = 40.
  // Nil pay days are any days beyond the current episode's total entitlement.

  const currentYears = completedYearsAt(startDate, queryDate);

  // Current tier = locked on first day of the most recent episode in window,
  // or service years at query date if no sick in window.
  const mostRecentEpisode = windowEpisodes.length > 0
    ? windowEpisodes[windowEpisodes.length - 1]
    : null;
  const currentTier = mostRecentEpisode
    ? getTier(completedYearsAt(startDate, mostRecentEpisode.allDays[0]))
    : getTier(currentYears);
  const { fullDays: entFullDays, halfDays: entHalfDays } = currentTier;
  const totalCSP = entFullDays + entHalfDays;

  // Running buckets — consumed full and half days accumulate independently
  let consumedFull = 0;  // days that fell within the full pay bucket at time of consumption
  let consumedHalf = 0;  // days that fell within the half pay bucket at time of consumption
  let consumedNil  = 0;  // days beyond the episode's total entitlement
  let cumulativeSick = 0;

  const episodeDetails = [];

  for (const ep of windowEpisodes) {
    const epTier = ep.tier;
    const epFullDays = epTier.fullDays;
    const epHalfDays = epTier.halfDays;
    const epTotal = epFullDays + epHalfDays;
    const epCount = ep.count;
    let epFullUsed = 0, epHalfUsed = 0, epNilUsed = 0;

    for (let i = 0; i < epCount; i++) {
      // Current total consumed (before this day)
      const soFar = consumedFull + consumedHalf + consumedNil;
      if (soFar < epFullDays) {
        consumedFull++;
        epFullUsed++;
      } else if (soFar < epTotal) {
        consumedHalf++;
        epHalfUsed++;
      } else {
        consumedNil++;
        epNilUsed++;
      }
    }

    cumulativeSick += epCount;

    episodeDetails.push({
      ...ep,
      epFullUsed,
      epHalfUsed,
      epNilUsed,
      runningAfter: cumulativeSick,
      tierLabel: `${epTier.fullDays / 5}w full / ${epTier.halfDays / 5}w half`,
    });
  }

  // Total window consumption by bucket
  const fullPayDays = consumedFull;
  const halfPayDays = consumedHalf;
  const nilPayDays  = consumedNil;

  // Current pay status is determined by remaining balances, not historical bucket consumption.
  // consumedHalf > 0 just means some past days fell in the half bucket — if full days
  // remain today, the employee is currently on full pay.
  const daysRemainingFull = Math.max(0, entFullDays - consumedFull);
  const daysRemainingHalf = Math.max(0, entHalfDays - consumedHalf);
  let payStatus;
  if (daysRemainingFull > 0) payStatus = "FULL PAY";
  else if (daysRemainingHalf > 0) payStatus = "HALF PAY";
  else payStatus = "NIL PAY";



  // Re-eligibility: check if exhausted and returned
  // Find last episode that hit nil pay
  let reEligibilityDate = null;
  let reEligibilityStatus = null;

  if (payStatus === "NIL PAY" || nilPayDays > 0) {
    // Find the last nil-pay episode's last day
    for (let i = episodeDetails.length - 1; i >= 0; i--) {
      if (episodeDetails[i].epNilUsed > 0) {
        const lastNilEp = episodeDetails[i];
        const lastNilDay = lastNilEp.allDays[lastNilEp.allDays.length - 1];
        // Check if employee has returned (i.e. there are working days after this episode up to query date)
        const returnDate = nextWorkingDay(lastNilDay);
        if (returnDate <= queryDate) {
          // They have returned — count 3 months from return date
          const threeMonthMark = addMonths(returnDate, 3);
          // Check no sick days between returnDate and queryDate
          const sickAfterReturn = sickDays.filter(d => d >= returnDate && d <= queryDate);
          if (sickAfterReturn.length === 0 && queryDate >= threeMonthMark) {
            reEligibilityStatus = "RE-ELIGIBLE";
            reEligibilityDate = threeMonthMark;
          } else if (sickAfterReturn.length === 0) {
            reEligibilityStatus = "SERVING_3_MONTHS";
            reEligibilityDate = threeMonthMark;
          } else {
            reEligibilityStatus = "CLOCK_RESET";
            // Clock restarted from last sick day
            const lastSickAfterReturn = sickAfterReturn[sickAfterReturn.length - 1];
            const newReturn = nextWorkingDay(lastSickAfterReturn);
            reEligibilityDate = addMonths(newReturn, 3);
          }
        } else {
          reEligibilityStatus = "STILL_ABSENT";
        }
        break;
      }
    }
  }

  // Roll-off dates: when do current window sick days drop off?
  const rollOffEvents = windowSickDays.map(d => ({
    sickDate: d,
    rollOffDate: addDays(d, 365),
  })).filter(e => e.rollOffDate > queryDate);

  // Find when pay status would improve (assuming no new absence)
  let fullPayRestoreDate = null;
  let halfPayRestoreDate = null;

  if (payStatus === "NIL PAY" || payStatus === "HALF PAY") {
    let simRunning = cumulativeSick;
    for (const ev of rollOffEvents.sort((a, b) => a.rollOffDate - b.rollOffDate)) {
      simRunning--;
      if (!halfPayRestoreDate && payStatus === "NIL PAY" && simRunning <= totalCSP) {
        halfPayRestoreDate = ev.rollOffDate;
      }
      if (!fullPayRestoreDate && simRunning <= entFullDays) {
        fullPayRestoreDate = ev.rollOffDate;
        break;
      }
    }
  }

  // Projected dates: if employee goes off sick from the day after query date (next working day),
  // when would they hit half pay and nil pay?
  // We project forward from queryDate adding working days, accounting for the rolling window
  // (old days drop off as new ones are added — simplified: assume worst case, no roll-off
  // during the projection period since we want dates not days).
  // Half pay starts after daysRemainingFull more sick days.
  // Nil pay starts after daysRemainingFull + daysRemainingHalf more sick days.
  // +1 because the date shown is the FIRST day on the new pay rate,
  // i.e. the sick day after the last full/half pay day is exhausted.
  const projectedHalfPayDate = payStatus === "FULL PAY" && daysRemainingFull > 0
    ? addWorkingDays(queryDate, daysRemainingFull + 1)
    : payStatus === "HALF PAY" ? queryDate
    : null;
  const projectedNilPayDate = payStatus !== "NIL PAY" && (daysRemainingFull + daysRemainingHalf) > 0
    ? addWorkingDays(queryDate, daysRemainingFull + daysRemainingHalf + 1)
    : payStatus === "NIL PAY" ? queryDate
    : null;

  return {
    windowStart,
    queryDate,
    startDate,
    currentYears,
    currentTier,
    entFullDays,
    entHalfDays,
    totalCSP,
    totalSickInWindow: cumulativeSick,
    consumedFull,
    consumedHalf,
    consumedNil,
    fullPayDays,
    halfPayDays,
    nilPayDays,
    payStatus,
    daysRemainingFull,
    daysRemainingHalf,
    episodeDetails,
    windowSickDays,
    reEligibilityStatus,
    reEligibilityDate,
    fullPayRestoreDate,
    halfPayRestoreDate,
    projectedHalfPayDate,
    projectedNilPayDate,
    daysToHalfPay: payStatus === "FULL PAY" ? daysRemainingFull : 0,
    daysToNilPay: payStatus === "FULL PAY"
      ? daysRemainingFull + daysRemainingHalf
      : payStatus === "HALF PAY"
      ? daysRemainingHalf
      : 0,
  };
}

// ─── UI ───────────────────────────────────────────────────────────────────────
// CSL Brand: Red #FC1921 | Black #231F20 | White #FFFFFF | Gray1 #F1EFEA | Gray2 #E2DFDA | Gray3 #808284
// Font: Montserrat Bold (headlines) / Montserrat Regular (body)

const B = {
  red:    "#FC1921",
  black:  "#231F20",
  white:  "#FFFFFF",
  gray1:  "#F1EFEA",
  gray2:  "#E2DFDA",
  gray3:  "#808284",
  green:  "#00A28A",  // CSL Teal for positive/full pay
  amber:  "#F06125",  // CSL Orange for warning/half pay
  red2:   "#DA2877",  // CSL Pink for nil pay
};

export default function CSPCalculator() {
  const [startDateStr, setStartDateStr] = useState("");
  const [queryDateStr, setQueryDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [rawData, setRawData] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("setup");

  const handleCalculate = () => {
    setError("");
    setResult(null);
    if (!startDateStr) return setError("Please enter the employee's start date.");
    if (!queryDateStr) return setError("Please enter the query date.");
    if (!rawData.trim()) return setError("Please paste the employee's absence record.");
    const startDate = new Date(startDateStr);
    const queryDate = new Date(queryDateStr);
    if (isNaN(startDate) || isNaN(queryDate)) return setError("Invalid date entered.");
    if (queryDate < startDate) return setError("Query date cannot be before start date.");
    const { sickDays, annualLeaveSet } = parseAbsenceData(rawData);
    const res = calculate(startDate, queryDate, sickDays, annualLeaveSet);
    setResult(res);
    setActiveTab("results");
  };

  const STATUS = {
    "FULL PAY": { bg: "#E8F7F4", border: B.green,  text: B.green,  label: "Full Pay"  },
    "HALF PAY": { bg: "#FEF3EC", border: B.amber,  text: B.amber,  label: "Half Pay"  },
    "NIL PAY":  { bg: "#FDEEF4", border: B.red2,   text: B.red2,   label: "Nil Pay"   },
  };
  const sc = result ? STATUS[result.payStatus] : null;

  const Field = ({ label, value, onChange, type = "date" }) => (
    <div>
      <div style={{ fontSize: 10, color: B.gray3, marginBottom: 5, fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.06em" }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={{
        width: "100%", padding: "10px 12px", borderRadius: 4, border: `1px solid ${B.gray2}`,
        background: B.white, color: B.black, fontSize: 13, fontFamily: "Montserrat, sans-serif",
        boxSizing: "border-box", outline: "none",
      }} />
    </div>
  );

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ padding: "14px", borderRadius: 4, background: B.white, border: `1px solid ${B.gray2}` }}>
      <div style={{ fontSize: 9, color: B.gray3, fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || B.black, fontFamily: "Montserrat, sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: B.gray3, marginTop: 3, fontFamily: "Montserrat, sans-serif" }}>{sub}</div>}
    </div>
  );

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 9, fontFamily: "Montserrat, sans-serif", fontWeight: 700, letterSpacing: "0.1em", color: B.gray3, marginBottom: 8, textTransform: "uppercase" }}>{children}</div>
  );

  return (
    <div style={{ fontFamily: "Montserrat, sans-serif", background: B.gray1, minHeight: "100vh", color: B.black }}>

      {/* Header */}
      <div style={{ background: B.black, padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 6, height: 36, background: B.red, borderRadius: 2 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: B.white, letterSpacing: "0.04em", fontFamily: "Montserrat, sans-serif" }}>
                Company Sick Pay Calculator
              </div>
              <div style={{ fontSize: 10, color: B.gray3, letterSpacing: "0.06em", marginTop: 1, fontFamily: "Montserrat, sans-serif" }}>
                HR Service Centre · Rolling Year Tool
              </div>
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: B.red, fontFamily: "Montserrat, sans-serif", letterSpacing: "-0.02em" }}>CSL</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: 16 }}>
          {["setup", "results"].map(tab => (
            <button key={tab} onClick={() => (tab === "setup" || result) && setActiveTab(tab)} style={{
              padding: "9px 22px", border: "none", cursor: tab === "results" && !result ? "default" : "pointer",
              background: "transparent", fontFamily: "Montserrat, sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: activeTab === tab ? B.white : tab === "results" && !result ? "#444" : B.gray3,
              borderBottom: activeTab === tab ? `3px solid ${B.red}` : "3px solid transparent",
              transition: "color 0.15s",
            }}>
              {tab === "setup" ? "Setup" : "Results"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 860, margin: "0 auto" }}>

        {/* ── SETUP TAB ── */}
        {activeTab === "setup" && (
          <>
            <div style={{ background: B.white, borderRadius: 6, padding: "20px", marginBottom: 16, border: `1px solid ${B.gray2}` }}>
              <SectionLabel>Employee Details</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="START DATE (appointment anniversary)" value={startDateStr} onChange={setStartDateStr} />
                <Field label="QUERY DATE (date of review)" value={queryDateStr} onChange={setQueryDateStr} />
              </div>
            </div>

            <div style={{ background: B.white, borderRadius: 6, padding: "20px", marginBottom: 16, border: `1px solid ${B.gray2}` }}>
              <SectionLabel>Absence Record — Paste from Workday</SectionLabel>
              <div style={{ fontSize: 11, color: B.gray3, marginBottom: 10, lineHeight: 1.6 }}>
                Copy the full Time Off Requests table from Workday (including header rows) and paste below. Corrections, partial days, and non-sickness types are handled automatically.
              </div>
              <textarea value={rawData} onChange={e => setRawData(e.target.value)} rows={10}
                placeholder={"Time Off Requests\nTime Off\tDate\tDay of the Week\tType\tRequested\tUnit of Time\tComment\nAbsence Request: [NAME]\t01/01/2025\tWednesday\tSickness\t1\tDays\t"}
                style={{
                  width: "100%", padding: "11px 12px", borderRadius: 4, border: `1px solid ${B.gray2}`,
                  background: B.gray1, color: B.black, fontSize: 11, fontFamily: "Montserrat, sans-serif",
                  resize: "vertical", lineHeight: 1.7, boxSizing: "border-box", outline: "none",
                }} />
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 4, background: "#FDEEF4", border: `1px solid ${B.red2}`, color: B.red2, fontSize: 11, marginBottom: 14, fontFamily: "Montserrat, sans-serif" }}>
                ⚠ {error}
              </div>
            )}

            <button onClick={handleCalculate} style={{
              width: "100%", padding: "13px", borderRadius: 4, border: "none",
              background: B.red, color: B.white, fontSize: 12, fontFamily: "Montserrat, sans-serif",
              letterSpacing: "0.08em", fontWeight: 700, cursor: "pointer", textTransform: "uppercase",
            }}>
              Calculate CSP Status →
            </button>

            {/* Policy reference */}
            <div style={{ background: B.white, borderRadius: 6, padding: "20px", marginTop: 16, border: `1px solid ${B.gray2}` }}>
              <SectionLabel>Policy Reference — England &amp; Wales</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
                {CSP_TIERS.map((t, i) => (
                  <div key={i} style={{ padding: "12px", borderRadius: 4, background: B.gray1, borderLeft: `3px solid ${B.red}` }}>
                    <div style={{ fontSize: 10, color: B.gray3, fontWeight: 700, marginBottom: 4 }}>{["0–1 Years", "1–5 Years", "5+ Years"][i]}</div>
                    <div style={{ fontSize: 12, color: B.black, fontWeight: 700 }}>
                      <span style={{ color: B.green }}>{t.fullDays / 5}w</span> full · <span style={{ color: B.amber }}>{t.halfDays / 5}w</span> half
                    </div>
                    <div style={{ fontSize: 10, color: B.gray3, marginTop: 2 }}>{t.fullDays + t.halfDays} days total</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: B.gray3, lineHeight: 1.7 }}>
                Rolling 364-day window. Tier locked on first day of each absence episode. Weekends, bank holidays and annual leave bridge episodes. Partial days (hours) excluded. Re-eligibility after exhaustion requires 3 months full attendance.
              </div>
            </div>
          </>
        )}

        {/* ── RESULTS TAB ── */}
        {activeTab === "results" && result && (
          <>
            {/* Status banner */}
            <div style={{
              padding: "20px 24px", borderRadius: 6, marginBottom: 16,
              background: sc.bg, borderLeft: `5px solid ${sc.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              border: `1px solid ${sc.border}`,
            }}>
              <div>
                <div style={{ fontSize: 10, color: sc.text, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.7 }}>CURRENT PAY STATUS</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: sc.text, marginTop: 2, fontFamily: "Montserrat, sans-serif" }}>{result.payStatus}</div>
                <div style={{ fontSize: 10, color: sc.text, opacity: 0.6, marginTop: 4 }}>
                  As of {fmtDate(result.queryDate)} · Window: {fmtDate(result.windowStart)} – {fmtDate(result.queryDate)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: sc.text, opacity: 0.6, fontWeight: 700, letterSpacing: "0.06em" }}>SICK DAYS IN WINDOW</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: sc.text, fontFamily: "Montserrat, sans-serif" }}>{result.totalSickInWindow}</div>
                <div style={{ fontSize: 10, color: sc.text, opacity: 0.5 }}>
                  {result.consumedFull}d full · {result.consumedHalf}d half · {result.consumedNil}d nil
                </div>
              </div>
            </div>

            {/* Entitlement bar */}
            <div style={{ background: B.white, borderRadius: 6, padding: "16px 20px", marginBottom: 16, border: `1px solid ${B.gray2}` }}>
              <SectionLabel>Entitlement Usage — {result.totalSickInWindow} / {result.totalCSP} Days · {result.currentTier.fullDays / 5}w Full + {result.currentTier.halfDays / 5}w Half Tier</SectionLabel>
              <div style={{ height: 20, borderRadius: 3, background: B.gray2, display: "flex", overflow: "hidden" }}>
                <div style={{
                  width: `${(Math.min(result.consumedFull, result.entFullDays) / result.totalCSP) * 100}%`,
                  background: B.green, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, color: B.white, fontWeight: 700, letterSpacing: "0.06em",
                }}>
                  {result.consumedFull >= result.entFullDays * 0.2 ? "FULL" : ""}
                </div>
                {result.consumedHalf > 0 && (
                  <div style={{
                    width: `${(result.consumedHalf / result.totalCSP) * 100}%`,
                    background: B.amber, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: B.white, fontWeight: 700,
                  }}>
                    {result.consumedHalf >= result.entHalfDays * 0.2 ? "HALF" : ""}
                  </div>
                )}
                {result.consumedNil > 0 && (
                  <div style={{
                    width: `${(result.consumedNil / result.totalCSP) * 100}%`,
                    background: B.red2, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: B.white, fontWeight: 700,
                  }}>NIL</div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: B.gray3 }}>
                <span>0</span>
                <span style={{ color: B.green }}>{result.entFullDays}d → half pay</span>
                <span style={{ color: B.amber }}>{result.totalCSP}d → nil pay</span>
              </div>
            </div>

            {/* Stats + projections */}
            <div style={{ background: B.white, borderRadius: 6, padding: "20px", marginBottom: 16, border: `1px solid ${B.gray2}` }}>
              <SectionLabel>Entitlement Summary</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
                <StatCard label="SERVICE" value={`${result.currentYears}yr${result.currentYears !== 1 ? "s" : ""}`} sub={`${result.currentTier.fullDays / 5}w + ${result.currentTier.halfDays / 5}w tier`} />
                <StatCard label="FULL PAY USED" value={`${result.consumedFull}d`} sub={`of ${result.entFullDays}d`} color={B.gray3} />
                <StatCard label="HALF PAY USED" value={`${result.consumedHalf}d`} sub={`of ${result.entHalfDays}d`} color={B.gray3} />
                <StatCard label="FULL PAY LEFT" value={`${result.daysRemainingFull}d`} sub={result.daysRemainingFull > 0 ? `≈ ${Math.ceil(result.daysRemainingFull / 5)}w` : "Exhausted"} color={result.daysRemainingFull > 0 ? B.green : B.red2} />
                <StatCard label="HALF PAY LEFT" value={`${result.daysRemainingHalf}d`} sub={result.daysRemainingHalf > 0 ? `≈ ${Math.ceil(result.daysRemainingHalf / 5)}w` : "Exhausted"} color={result.daysRemainingHalf > 0 ? B.amber : B.red2} />
              </div>

              {result.payStatus !== "NIL PAY" && (
                <>
                  <div style={{ borderTop: `1px solid ${B.gray2}`, paddingTop: 14 }}>
                    <SectionLabel>If Off Sick From {fmtDate(result.queryDate)} — Continuous Absence, No Roll-Off Assumed</SectionLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {result.payStatus === "FULL PAY" && result.projectedHalfPayDate && (
                        <div style={{ padding: "14px", borderRadius: 4, background: "#FEF3EC", borderLeft: `4px solid ${B.amber}` }}>
                          <div style={{ fontSize: 9, color: B.amber, fontWeight: 700, letterSpacing: "0.08em" }}>HALF PAY WOULD START</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: B.amber, marginTop: 4, fontFamily: "Montserrat, sans-serif" }}>{fmtDate(result.projectedHalfPayDate)}</div>
                          <div style={{ fontSize: 10, color: B.gray3, marginTop: 3 }}>After {result.daysToHalfPay} more sick day{result.daysToHalfPay !== 1 ? "s" : ""} (≈{Math.ceil(result.daysToHalfPay / 5)}w)</div>
                        </div>
                      )}
                      {result.projectedNilPayDate && (
                        <div style={{ padding: "14px", borderRadius: 4, background: "#FDEEF4", borderLeft: `4px solid ${B.red2}` }}>
                          <div style={{ fontSize: 9, color: B.red2, fontWeight: 700, letterSpacing: "0.08em" }}>NIL PAY WOULD START</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: B.red2, marginTop: 4, fontFamily: "Montserrat, sans-serif" }}>{fmtDate(result.projectedNilPayDate)}</div>
                          <div style={{ fontSize: 10, color: B.gray3, marginTop: 3 }}>After {result.daysToNilPay} more sick day{result.daysToNilPay !== 1 ? "s" : ""} (≈{Math.ceil(result.daysToNilPay / 5)}w)</div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {result.payStatus === "NIL PAY" && (
                <div style={{ padding: "12px 14px", borderRadius: 4, background: "#FDEEF4", borderLeft: `4px solid ${B.red2}`, fontSize: 11, color: B.red2 }}>
                  ⚠ Employee is currently on nil pay. CSP entitlement exhausted.
                </div>
              )}
            </div>

            {/* Roll-off restore dates */}
            {(result.fullPayRestoreDate || result.halfPayRestoreDate) && (
              <div style={{ background: B.white, borderRadius: 6, padding: "20px", marginBottom: 16, border: `1px solid ${B.gray2}` }}>
                <SectionLabel>Relief Dates — Assuming No New Absence</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {result.halfPayRestoreDate && (
                    <div style={{ padding: "14px", borderRadius: 4, background: "#FEF3EC", borderLeft: `4px solid ${B.amber}` }}>
                      <div style={{ fontSize: 9, color: B.amber, fontWeight: 700, letterSpacing: "0.08em" }}>HALF PAY RESTORES</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: B.amber, marginTop: 4 }}>{fmtDate(result.halfPayRestoreDate)}</div>
                      <div style={{ fontSize: 10, color: B.gray3, marginTop: 3 }}>Old sick days roll off 364-day window</div>
                    </div>
                  )}
                  {result.fullPayRestoreDate && (
                    <div style={{ padding: "14px", borderRadius: 4, background: "#E8F7F4", borderLeft: `4px solid ${B.green}` }}>
                      <div style={{ fontSize: 9, color: B.green, fontWeight: 700, letterSpacing: "0.08em" }}>FULL PAY RESTORES</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: B.green, marginTop: 4 }}>{fmtDate(result.fullPayRestoreDate)}</div>
                      <div style={{ fontSize: 10, color: B.gray3, marginTop: 3 }}>Old sick days roll off 364-day window</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Re-eligibility */}
            {result.reEligibilityStatus && (
              <div style={{ background: B.white, borderRadius: 6, padding: "20px", marginBottom: 16, border: `1px solid ${B.gray2}` }}>
                <SectionLabel>CSP Re-Eligibility — 3-Month Attendance Clock</SectionLabel>
                {{
                  RE_ELIGIBLE: (
                    <div style={{ padding: "12px 14px", borderRadius: 4, background: "#E8F7F4", borderLeft: `4px solid ${B.green}` }}>
                      <div style={{ fontSize: 9, color: B.green, fontWeight: 700 }}>STATUS</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: B.green, marginTop: 2 }}>Re-eligible from {fmtDate(result.reEligibilityDate)}</div>
                      <div style={{ fontSize: 10, color: B.gray3, marginTop: 2 }}>3 months full attendance completed. Rolling window still applies to historic sick days.</div>
                    </div>
                  ),
                  SERVING_3_MONTHS: (
                    <div style={{ padding: "12px 14px", borderRadius: 4, background: "#FEF3EC", borderLeft: `4px solid ${B.amber}` }}>
                      <div style={{ fontSize: 9, color: B.amber, fontWeight: 700 }}>STATUS</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: B.amber, marginTop: 2 }}>Serving 3-month attendance period</div>
                      <div style={{ fontSize: 10, color: B.gray3, marginTop: 2 }}>Re-eligible from {fmtDate(result.reEligibilityDate)} if no further absence.</div>
                    </div>
                  ),
                  CLOCK_RESET: (
                    <div style={{ padding: "12px 14px", borderRadius: 4, background: "#FDEEF4", borderLeft: `4px solid ${B.red2}` }}>
                      <div style={{ fontSize: 9, color: B.red2, fontWeight: 700 }}>STATUS</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: B.red2, marginTop: 2 }}>3-month clock reset by further absence</div>
                      <div style={{ fontSize: 10, color: B.gray3, marginTop: 2 }}>Re-eligible from {fmtDate(result.reEligibilityDate)} if no further absence.</div>
                    </div>
                  ),
                  STILL_ABSENT: (
                    <div style={{ padding: "12px 14px", borderRadius: 4, background: "#FDEEF4", borderLeft: `4px solid ${B.red2}` }}>
                      <div style={{ fontSize: 9, color: B.red2, fontWeight: 700 }}>STATUS</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: B.red2, marginTop: 2 }}>Still absent — clock not yet started</div>
                      <div style={{ fontSize: 10, color: B.gray3, marginTop: 2 }}>3-month clock starts from first day back.</div>
                    </div>
                  ),
                }[result.reEligibilityStatus]}
              </div>
            )}

            {/* Episode breakdown */}
            <div style={{ background: B.white, borderRadius: 6, padding: "20px", marginBottom: 16, border: `1px solid ${B.gray2}` }}>
              <SectionLabel>Absence Episodes In Window ({result.episodeDetails.length} episode{result.episodeDetails.length !== 1 ? "s" : ""})</SectionLabel>
              <div style={{ borderRadius: 4, border: `1px solid ${B.gray2}`, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: B.gray1 }}>
                        {["Episode Start", "Episode End", "Days", "Tier (Locked)", "Full", "Half", "Nil", "Running Total"].map(h => (
                          <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 9, letterSpacing: "0.06em", color: B.gray3, fontWeight: 700, whiteSpace: "nowrap", borderBottom: `1px solid ${B.gray2}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.episodeDetails.map((ep, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${B.gray2}`, background: i % 2 === 0 ? B.white : B.gray1 }}>
                          <td style={{ padding: "8px 12px", color: B.black, whiteSpace: "nowrap" }}>{fmtDate(ep.days[0])}</td>
                          <td style={{ padding: "8px 12px", color: B.black, whiteSpace: "nowrap" }}>{fmtDate(ep.days[ep.days.length - 1])}</td>
                          <td style={{ padding: "8px 12px", color: B.black, fontWeight: 700 }}>{ep.count}</td>
                          <td style={{ padding: "8px 12px", color: B.gray3, whiteSpace: "nowrap" }}>{ep.tierLabel}</td>
                          <td style={{ padding: "8px 12px", color: B.green, fontWeight: 700 }}>{ep.epFullUsed || "—"}</td>
                          <td style={{ padding: "8px 12px", color: B.amber, fontWeight: 700 }}>{ep.epHalfUsed || "—"}</td>
                          <td style={{ padding: "8px 12px", color: B.red2, fontWeight: 700 }}>{ep.epNilUsed || "—"}</td>
                          <td style={{ padding: "8px 12px", color: B.black, fontWeight: 700 }}>{ep.runningAfter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <button onClick={() => setActiveTab("setup")} style={{
              width: "100%", padding: "11px", borderRadius: 4, border: `1px solid ${B.gray2}`,
              background: "transparent", color: B.gray3, fontSize: 11, fontFamily: "Montserrat, sans-serif",
              letterSpacing: "0.06em", cursor: "pointer", fontWeight: 700,
            }}>
              ← Back to Setup
            </button>
          </>
        )}
      </div>
    </div>
  );
}
