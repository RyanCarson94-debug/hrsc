import SwiftUI

// MARK: - Color Palette

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch h.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 255, 255, 255)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    // Background layers
    static let pmBackground = Color(hex: "0a0a14")
    static let pmCard       = Color(hex: "111128")
    static let pmBorder     = Color(hex: "1e1e3a")

    // Text
    static let pmPrimary    = Color(hex: "e6f1ff")
    static let pmSecondary  = Color(hex: "8892b0")

    // Accent — RingGo green
    static let pmAccent     = Color(hex: "00B140")
    static let pmAccentDim  = Color(hex: "007a2e")

    // Status
    static let pmWarning    = Color(hex: "FFCC00")
    static let pmDanger     = Color.red
}

// MARK: - Typography

extension Font {
    static let pmTitle    = Font.system(size: 28, weight: .bold, design: .default)
    static let pmHeadline = Font.system(size: 17, weight: .semibold)
    static let pmBody     = Font.system(size: 15, weight: .regular)
    static let pmCaption  = Font.system(size: 12, weight: .regular)
    static let pmMono     = Font.system(size: 14, weight: .medium, design: .monospaced)
    static let pmMonoLg   = Font.system(size: 18, weight: .semibold, design: .monospaced)
}

// MARK: - Card Style

struct PMCardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.pmCard)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.pmBorder, lineWidth: 1)
            )
    }
}

extension View {
    func pmCard() -> some View {
        modifier(PMCardStyle())
    }
}

// MARK: - Button Styles

struct PMPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.pmHeadline)
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.pmAccent.opacity(configuration.isPressed ? 0.7 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct PMSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.pmHeadline)
            .foregroundStyle(Color.pmAccent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.pmAccent.opacity(configuration.isPressed ? 0.15 : 0.1))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

extension ButtonStyle where Self == PMPrimaryButtonStyle {
    static var pmPrimary: PMPrimaryButtonStyle { PMPrimaryButtonStyle() }
}

extension ButtonStyle where Self == PMSecondaryButtonStyle {
    static var pmSecondary: PMSecondaryButtonStyle { PMSecondaryButtonStyle() }
}
