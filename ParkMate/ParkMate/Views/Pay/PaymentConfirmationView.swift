import SwiftUI

struct PaymentConfirmationView: View {
    let session: ParkingSession
    let zone: Zone

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            successIcon

            VStack(spacing: 12) {
                Text("Parking Started")
                    .font(.pmTitle)
                    .foregroundStyle(Color.pmPrimary)

                Text("Your SMS has been sent to RingGo. Parking is active once you receive a confirmation text.")
                    .font(.pmBody)
                    .foregroundStyle(Color.pmSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            sessionSummary

            Spacer()

            Button("Done") { dismiss() }
                .buttonStyle(.pmPrimary)
                .padding(.horizontal)

            Spacer(minLength: 24)
        }
        .background(Color.pmBackground)
        .navigationTitle("Confirmed")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { dismiss() }
                    .foregroundStyle(Color.pmAccent)
            }
        }
    }

    // MARK: - Subviews

    private var successIcon: some View {
        ZStack {
            Circle()
                .fill(Color.pmAccent.opacity(0.15))
                .frame(width: 120, height: 120)
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(Color.pmAccent)
        }
    }

    private var sessionSummary: some View {
        VStack(spacing: 0) {
            summaryRow(
                icon: "mappin.circle.fill",
                label: "Location",
                value: zone.name
            )
            Divider().background(Color.pmBorder)
            summaryRow(
                icon: "number.circle.fill",
                label: "Zone",
                value: zone.zoneCode
            )
            Divider().background(Color.pmBorder)
            summaryRow(
                icon: "clock.fill",
                label: "Duration",
                value: DurationFormatter.displayString(minutes: session.durationMinutes)
            )
            if let expiry = session.expiresAt {
                Divider().background(Color.pmBorder)
                summaryRow(
                    icon: "timer",
                    label: "Expires",
                    value: expiry.formatted(date: .omitted, time: .shortened)
                )
            }
            if let cost = session.cost {
                Divider().background(Color.pmBorder)
                summaryRow(
                    icon: "sterlingsign.circle.fill",
                    label: "Est. Cost",
                    value: String(format: "£%.2f", cost)
                )
            }
        }
        .pmCard()
        .padding(.horizontal)
    }

    private func summaryRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.pmAccent)
                .frame(width: 24)
            Text(label)
                .font(.pmBody)
                .foregroundStyle(Color.pmSecondary)
            Spacer()
            Text(value)
                .font(.pmBody)
                .foregroundStyle(Color.pmPrimary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
