import Foundation
import Security

final class SecureStorage {
    static let shared = SecureStorage()
    private let service = "com.parkmate.app"

    private init() {}

    // MARK: - Generic Operations

    func save(_ value: String, forKey key: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw SecureStorageError.encodingFailed
        }
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String:   data
        ]
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            throw SecureStorageError.saveFailed(status)
        }
    }

    func load(forKey key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String:  true,
            kSecMatchLimit as String:  kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        if status != errSecSuccess { throw SecureStorageError.loadFailed(status) }
        guard let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
            throw SecureStorageError.decodingFailed
        }
        return value
    }

    func delete(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - CVV Convenience

    var cvv: String? { try? load(forKey: "cvv") }

    func saveCVV(_ cvv: String) throws { try save(cvv, forKey: "cvv") }
    func deleteCVV() { delete(forKey: "cvv") }
}

// MARK: - Error

enum SecureStorageError: LocalizedError {
    case encodingFailed, decodingFailed
    case saveFailed(OSStatus)
    case loadFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .encodingFailed:       return "Failed to encode value for Keychain"
        case .decodingFailed:       return "Failed to decode value from Keychain"
        case .saveFailed(let s):    return "Keychain save failed (status \(s))"
        case .loadFailed(let s):    return "Keychain load failed (status \(s))"
        }
    }
}
