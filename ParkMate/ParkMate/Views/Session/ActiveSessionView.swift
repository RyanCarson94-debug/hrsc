import SwiftUI
import MapKit

struct ActiveSessionView: View {
    let session: ParkingSession
    let zone: Zone
    let remainingSeconds: TimeInterval

    @Environment(SessionManager.self) private var sessionManager
    @State private var showExtendSheet = false
    @State private var showSMSComposer = false
    @State private var extendSMSBody = ""
    @State private var showEndConfirm = false
    @State private var errorMessage: String?

    private var totalSeconds: TimeInterval {
        TimeInterval(session.totalDurationMinutes * 60)
    }

    private var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return max(0, min(1, 1.0 - remainingSeconds / totalSeconds))
    }

    private var isWarning: Bool { remainingSeconds < 900 } // < 15 min

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                zoneHeader
                timerRing
                sessionDetails
                actionButtons
            }
            .padding()
        }
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .sheet(isPresented: $showExtendSheet) {
            ExtendSessionSheet { durationMinutes in
                guard let cvv = SecureStorage.shared.cvv else { return }
                let body = SMSFormatter.extendBody(durationMinutes: durationMinutes, cvv: cvv)
                extendSMSBody = body
                showExtendSheet = false
                // Small delay to allow sheet dismiss animation
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    showSMSComposer = true
                }
            }
        }
        .smsComposer(
            isPresented: $showSMSComposer,
            recipients: [zone.smsNumber ?? "81025"],
            body: extendSMSBody
        ) { result in
            if result == .sent {
                let extendMinutes = 60
                try? sessionManager.extendSession(
                    additionalMinutes: extendMinutes,
                    cvv: SecureStorage.shared.cvv ?? ""
                )
            }
        }
        .alert("End Session?", isPresented: $showEndConfirm) {
            Button("End Session", role: .destructive) {
                try? sessionManager.endSession()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will mark your parking session as ended. You are responsible for any overstay charges.")
        }
        .alert("Error", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: - Subviews

    private var zoneHeader: some View {
        VStack(spacing: 6) {
            HStack {
                Text(zone.name)
                    .font(.pmTitle)
                    .foregroundStyle(Color.pmPrimary)
                Spacer()
                Text(zone.zoneType.displayName)
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.pmBorder)
                    .clipShape(Capsule())
            }

            HStack {
                Image(systemName: "location.fill")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
                Text("Zone \(zone.zoneCode)")
                    .font(.pmMono)
                    .foregroundStyle(Color.pmSecondary)
                Spacer()
                if let rate = zone.hourlyRate {
                    Text(String(format: "£%.2f/hr", rate))
                        .font(.pmBody)
                        .foregroundStyle(Color.pmAccent)
                }
            }
        }
        .padding()
        .pmCard()
    }

    private var timerRing: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(Color.pmBorder, lineWidth: 12)
                .frame(width: 220, height: 220)

            // Progress ring
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    isWarning ? Color.pmWarning : Color.pmAccent,
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
                .frame(width: 220, height: 220)
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 1), value: progress)

            // Countdown
            VStack(spacing: 4) {
                Text(DurationFormatter.countdownString(from: remainingSeconds))
                    .font(.system(size: 44, weight: .bold, design: .monospaced))
                    .foregroundStyle(isWarning ? Color.pmWarning : Color.pmPrimary)
                    .monospacedDigit()

                Text("remaining")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)

                if isWarning {
                    Label("Expiring soon", systemImage: "exclamationmark.triangle.fill")
                        .font(.pmCaption)
                        .foregroundStyle(Color.pmWarning)
                        .padding(.top, 2)
                }
            }
        }
    }

    private var sessionDetails: some View {
        VStack(spacing: 0) {
            detailRow(label: "Started", value: formattedStart)
            Divider().background(Color.pmBorder)
            detailRow(label: "Duration", value: DurationFormatter.displayString(minutes: session.totalDurationMinutes))
            Divider().background(Color.pmBorder)
            detailRow(label: "Expires", value: formattedExpiry)
            if let cost = session.cost {
                Divider().background(Color.pmBorder)
                detailRow(label: "Cost", value: String(format: "£%.2f", cost))
            }
        }
        .pmCard()
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
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

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button("Extend Parking") {
                showExtendSheet = true
            }
            .buttonStyle(.pmPrimary)

            HStack(spacing: 12) {
                Button {
                    openInMaps()
                } label: {
                    Label("Find Car", systemImage: "location.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.pmSecondary)

                Button {
                    showEndConfirm = true
                } label: {
                    Label("End Session", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity)
                }
                .foregroundStyle(Color.pmDanger)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.pmDanger.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    // MARK: - Helpers

    private var formattedStart: String {
        guard let date = session.startDate else { return "—" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    private var formattedExpiry: String {
        guard let expiry = session.expiresAt else { return "—" }
        return expiry.formatted(date: .omitted, time: .shortened)
    }

    private func openInMaps() {
        guard let lat = session.latitude, let lon = session.longitude else {
            // Fall back to zone coordinates
            let coord = "\(zone.latitude),\(zone.longitude)"
            if let url = URL(string: "maps://?q=\(coord)") {
                UIApplication.shared.open(url)
            }
            return
        }
        if let url = URL(string: "maps://?q=\(lat),\(lon)") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Extend Sheet

struct ExtendSessionSheet: View {
    var onExtend: (Int) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedMinutes = 60

    private let options = [(30, "30 min"), (60, "1 hr"), (90, "1.5 hr"), (120, "2 hr")]

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("How long to extend?")
                    .font(.pmHeadline)
                    .foregroundStyle(Color.pmPrimary)

                VStack(spacing: 12) {
                    ForEach(options, id: \.0) { (minutes, label) in
                        Button {
                            selectedMinutes = minutes
                        } label: {
                            HStack {
                                Text(label)
                                    .font(.pmBody)
                                    .foregroundStyle(Color.pmPrimary)
                                Spacer()
                                if selectedMinutes == minutes {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Color.pmAccent)
                                }
                            }
                            .padding()
                            .pmCard()
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .strokeBorder(
                                        selectedMinutes == minutes ? Color.pmAccent : Color.clear,
                                        lineWidth: 2
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)

                Button("Open Messages to Extend") {
                    onExtend(selectedMinutes)
                }
                .buttonStyle(.pmPrimary)
                .padding(.horizontal)

                Spacer()
            }
            .padding(.top)
            .background(Color.pmBackground)
            .navigationTitle("Extend Parking")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.pmSecondary)
                }
            }
        }
    }
}
