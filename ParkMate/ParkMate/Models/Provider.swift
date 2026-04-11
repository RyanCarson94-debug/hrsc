import Foundation

enum Provider: String, Codable, CaseIterable, Identifiable {
    case ringGo = "RingGo"
    case payByPhone = "PayByPhone"
    case justPark = "JustPark"
    case appyParking = "AppyParking"
    case apcoa = "APCOA"

    var id: String { rawValue }

    var displayName: String { rawValue }

    var supportsInAppSMS: Bool {
        self == .ringGo
    }

    var smsNumber: String? {
        switch self {
        case .ringGo: return "81025"
        default: return nil
        }
    }

    var appURLScheme: String? {
        switch self {
        case .ringGo: return nil
        case .payByPhone: return "paybyphone://"
        case .justPark: return "justpark://"
        case .appyParking: return "appyparking://"
        case .apcoa: return nil
        }
    }

    var accentHex: String {
        switch self {
        case .ringGo: return "00B140"
        case .payByPhone: return "0066CC"
        case .justPark: return "FF6B00"
        case .appyParking: return "E91E63"
        case .apcoa: return "003087"
        }
    }
}
