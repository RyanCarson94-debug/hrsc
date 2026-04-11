import Foundation
import GRDB

struct Zone: Identifiable, Codable, FetchableRecord, MutablePersistableRecord {
    var id: Int64?
    var zoneCode: String
    var name: String
    var address: String?
    var postcode: String?
    var latitude: Double
    var longitude: Double
    var provider: Provider
    var smsCapable: Bool
    var smsNumber: String?
    var hourlyRate: Double?
    var maxStayMinutes: Int?
    var spaces: Int?
    var zoneType: ZoneType
    var council: String?
    var notes: String?
    var createdAt: String?
    var updatedAt: String?

    static let databaseTableName = "zones"

    enum CodingKeys: String, CodingKey {
        case id
        case zoneCode = "zone_code"
        case name, address, postcode, latitude, longitude
        case provider
        case smsCapable = "sms_capable"
        case smsNumber = "sms_number"
        case hourlyRate = "hourly_rate"
        case maxStayMinutes = "max_stay_minutes"
        case spaces
        case zoneType = "zone_type"
        case council, notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }
}

enum ZoneType: String, Codable, CaseIterable {
    case carPark = "car_park"
    case onStreet = "on_street"

    var displayName: String {
        switch self {
        case .carPark: return "Car Park"
        case .onStreet: return "On-Street"
        }
    }
}

// MARK: - JSON Import Support

extension Zone {
    struct JSONImport: Codable {
        let zoneCode: String
        let name: String
        let address: String?
        let postcode: String?
        let latitude: Double
        let longitude: Double
        let provider: String
        let smsCapable: Bool
        let smsNumber: String?
        let hourlyRate: Double?
        let maxStayMinutes: Int?
        let spaces: Int?
        let zoneType: String?
        let council: String?
        let notes: String?

        enum CodingKeys: String, CodingKey {
            case zoneCode = "zone_code"
            case name, address, postcode, latitude, longitude, provider
            case smsCapable = "sms_capable"
            case smsNumber = "sms_number"
            case hourlyRate = "hourly_rate"
            case maxStayMinutes = "max_stay_minutes"
            case spaces
            case zoneType = "zone_type"
            case council, notes
        }

        func toZone() -> Zone {
            Zone(
                id: nil,
                zoneCode: zoneCode,
                name: name,
                address: address,
                postcode: postcode,
                latitude: latitude,
                longitude: longitude,
                provider: Provider(rawValue: provider) ?? .ringGo,
                smsCapable: smsCapable,
                smsNumber: smsNumber,
                hourlyRate: hourlyRate,
                maxStayMinutes: maxStayMinutes,
                spaces: spaces,
                zoneType: ZoneType(rawValue: zoneType ?? "car_park") ?? .carPark,
                council: council,
                notes: notes,
                createdAt: nil,
                updatedAt: nil
            )
        }
    }
}
