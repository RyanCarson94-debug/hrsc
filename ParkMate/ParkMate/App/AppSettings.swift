import Foundation

struct AppSettings {
    // MARK: - UserDefaults Keys
    static let defaultDurationMinutesKey  = "pm_default_duration_minutes"
    static let expiryWarningMinutesKey    = "pm_expiry_warning_minutes"
    static let autoDetectEnabledKey       = "pm_auto_detect_enabled"
    static let geofenceRadiusKey          = "pm_geofence_radius_metres"
    static let dwellTimeSecondsKey        = "pm_dwell_time_seconds"

    // MARK: - Defaults
    static let defaultDurationMinutes   = 120
    static let defaultExpiryWarning     = 15
    static let defaultGeofenceRadius    = 200
    static let defaultDwellTime         = 60

    // MARK: - Shared instance
    static var shared = AppSettings()

    private var defaults: UserDefaults { .standard }

    var defaultDurationMinutes: Int {
        get {
            let v = defaults.integer(forKey: Self.defaultDurationMinutesKey)
            return v > 0 ? v : Self.defaultDurationMinutes
        }
        set { defaults.set(newValue, forKey: Self.defaultDurationMinutesKey) }
    }

    var expiryWarningMinutes: Int {
        get {
            let v = defaults.integer(forKey: Self.expiryWarningMinutesKey)
            return v > 0 ? v : Self.defaultExpiryWarning
        }
        set { defaults.set(newValue, forKey: Self.expiryWarningMinutesKey) }
    }

    var autoDetectEnabled: Bool {
        get {
            // Default to true if never set
            if defaults.object(forKey: Self.autoDetectEnabledKey) == nil { return true }
            return defaults.bool(forKey: Self.autoDetectEnabledKey)
        }
        set { defaults.set(newValue, forKey: Self.autoDetectEnabledKey) }
    }

    var geofenceRadius: Double {
        get {
            let v = defaults.double(forKey: Self.geofenceRadiusKey)
            return v > 0 ? v : Double(Self.defaultGeofenceRadius)
        }
        set { defaults.set(newValue, forKey: Self.geofenceRadiusKey) }
    }

    var dwellTimeSeconds: TimeInterval {
        get {
            let v = defaults.double(forKey: Self.dwellTimeSecondsKey)
            return v > 0 ? v : Double(Self.defaultDwellTime)
        }
        set { defaults.set(newValue, forKey: Self.dwellTimeSecondsKey) }
    }
}
