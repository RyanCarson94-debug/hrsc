import Foundation

enum SMSFormatter {
    static func parkBody(zoneCode: String, durationMinutes: Int, cvv: String, registration: String? = nil) -> String {
        let duration = DurationFormatter.toRingGoUnit(minutes: durationMinutes)
        var message = "RingGo \(zoneCode) \(duration) \(cvv)"
        if let reg = registration, !reg.trimmingCharacters(in: .whitespaces).isEmpty {
            message += " \(reg.uppercased())"
        }
        return message
    }

    static func extendBody(durationMinutes: Int, cvv: String) -> String {
        let duration = DurationFormatter.toRingGoUnit(minutes: durationMinutes)
        return "RingGo extend \(duration) \(cvv)"
    }

    static func correctPlateBody(registration: String) -> String {
        "RingGo correct \(registration.uppercased())"
    }
}
