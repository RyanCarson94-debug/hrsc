import Foundation
import GRDB

struct ParkingSession: Identifiable, Codable, FetchableRecord, MutablePersistableRecord {
    var id: Int64?
    var zoneId: Int64
    var vehicleId: Int64
    var startedAt: String
    var durationMinutes: Int
    var cost: Double?
    var smsBody: String?
    var status: SessionStatus
    var extendedAt: String?
    var extendedDurationMinutes: Int?
    var latitude: Double?
    var longitude: Double?
    var createdAt: String?

    static let databaseTableName = "sessions"

    enum CodingKeys: String, CodingKey {
        case id
        case zoneId = "zone_id"
        case vehicleId = "vehicle_id"
        case startedAt = "started_at"
        case durationMinutes = "duration_minutes"
        case cost
        case smsBody = "sms_body"
        case status
        case extendedAt = "extended_at"
        case extendedDurationMinutes = "extended_duration_minutes"
        case latitude, longitude
        case createdAt = "created_at"
    }

    mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }

    var startDate: Date? {
        ISO8601DateFormatter().date(from: startedAt)
    }

    var totalDurationMinutes: Int {
        durationMinutes + (extendedDurationMinutes ?? 0)
    }

    var expiresAt: Date? {
        guard let start = startDate else { return nil }
        return start.addingTimeInterval(TimeInterval(totalDurationMinutes * 60))
    }

    var remainingSeconds: TimeInterval? {
        guard let expiry = expiresAt else { return nil }
        return max(0, expiry.timeIntervalSinceNow)
    }

    var isExpired: Bool {
        guard let remaining = remainingSeconds else { return false }
        return remaining <= 0
    }
}

enum SessionStatus: String, Codable {
    case active
    case expired
    case extended
    case cancelled
}
