import Foundation
import GRDB

struct Vehicle: Identifiable, Codable, FetchableRecord, MutablePersistableRecord {
    var id: Int64?
    var registration: String
    var make: String?
    var model: String?
    var isDefault: Bool
    var createdAt: String?

    static let databaseTableName = "vehicles"

    enum CodingKeys: String, CodingKey {
        case id, registration, make, model
        case isDefault = "is_default"
        case createdAt = "created_at"
    }

    mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }

    var displayName: String {
        if let make, let model {
            return "\(make) \(model) (\(registration))"
        }
        return registration
    }
}
