import Foundation

enum DurationFormatter {
    /// Converts minutes to RingGo SMS unit format: "30m", "2h", "90m"
    static func toRingGoUnit(minutes: Int) -> String {
        if minutes < 60 { return "\(minutes)m" }
        if minutes % 60 == 0 { return "\(minutes / 60)h" }
        return "\(minutes)m"
    }

    /// Human-readable duration string: "30 min", "2 hr", "1 hr 30 min"
    static func displayString(minutes: Int) -> String {
        if minutes < 60 { return "\(minutes) min" }
        let hours = minutes / 60
        let rem = minutes % 60
        if rem == 0 { return "\(hours) hr" }
        return "\(hours) hr \(rem) min"
    }

    /// Countdown format: "1:23:45" or "45:03"
    static func countdownString(from seconds: TimeInterval) -> String {
        let total = Int(max(0, seconds))
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }

    /// Common durations presented in the duration picker
    static let commonDurations: [(label: String, minutes: Int)] = [
        ("30 min", 30),
        ("1 hr", 60),
        ("1.5 hr", 90),
        ("2 hr", 120),
        ("3 hr", 180),
        ("4 hr", 240),
        ("All day (8 hr)", 480),
    ]
}
