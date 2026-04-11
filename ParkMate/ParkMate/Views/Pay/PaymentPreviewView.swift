import SwiftUI

struct PaymentPreviewView: View {
    let zone: Zone

    @Environment(SessionManager.self) private var sessionManager
    @Environment(\.dismiss) private var dismiss

    @State private var selectedDurationMinutes: Int
    @State private var cvvInput: String = ""
    @State private var showSMSComposer = false
    @State private var smsBody = ""
    @State private var showConfirmation = false
    @State private var sentSession: ParkingSession?
    @State private var errorMessage: String?
    @State private var useRegistration = true

    private var cvv: String {
        // Prefer saved CVV, fallback to typed input
        SecureStorage.shared.cvv ?? cvvInput
    }

    private var hasSavedCVV: Bool { SecureStorage.shared.cvv != nil }

    private var defaultVehicle: Vehicle? {
        try? ZoneDatabase.shared.defaultVehicle()
    }

    private var smsPreview: String {
        guard !cvv.isEmpty else { return "Enter your CVV to preview the message" }
        return SMSFormatter.parkBody(
            zoneCode: zone.zoneCode,
            durationMinutes: selectedDurationMinutes,
            cvv: cvv,
            registration: useRegistration ? defaultVehicle?.registration : nil
        )
    }

    private var canPay: Bool {
        zone.smsCapable && !cvv.isEmpty
    }

    init(zone: Zone) {
        self.zone = zone
        _selectedDurationMinutes = State(initialValue: AppSettings.shared.defaultDurationMinutes)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                zoneHeader
                durationPicker
                messagePreview

                if !hasSavedCVV {
                    cvvEntry
                }

                if let vehicle = defaultVehicle {
                    vehicleRow(vehicle: vehicle)
                }

                payButton
            }
            .padding()
        }
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .navigationTitle("Pay for Parking")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
                    .foregroundStyle(Color.pmSecondary)
            }
        }
        .smsComposer(
            isPresented: $showSMSComposer,
            recipients: [zone.smsNumber ?? "81025"],
            body: smsBody
        ) { result in
            if result == .sent {
                handleSMSSent()
            }
        }
        .alert("Error", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .fullScreenCover(isPresented: $showConfirmation) {
            if let session = sentSession {
                NavigationStack {
                    PaymentConfirmationView(session: session, zone: zone)
                }
            }
        }
    }

    // MARK: - Subviews

    private var zoneHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text(zone.name)
                    .font(.pmHeadline)
                    .foregroundStyle(Color.pmPrimary)
                HStack(spacing: 8) {
                    Text("Zone \(zone.zoneCode)")
                        .font(.pmMono)
                        .foregroundStyle(Color.pmSecondary)
                    if let rate = zone.hourlyRate {
                        Text("·")
                            .foregroundStyle(Color.pmBorder)
                        Text(String(format: "£%.2f/hr", rate))
                            .font(.pmBody)
                            .foregroundStyle(Color.pmAccent)
                    }
                }
                if let postcode = zone.postcode {
                    Text(postcode)
                        .font(.pmCaption)
                        .foregroundStyle(Color.pmSecondary)
                }
            }
            Spacer()
            providerBadge
        }
        .padding()
        .pmCard()
    }

    private var providerBadge: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(Color(hex: zone.provider.accentHex))
                .frame(width: 12, height: 12)
            Text(zone.provider.displayName)
                .font(.pmCaption)
                .foregroundStyle(Color.pmSecondary)
        }
    }

    private var durationPicker: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Duration")
                .font(.pmCaption)
                .foregroundStyle(Color.pmSecondary)
                .textCase(.uppercase)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(DurationFormatter.commonDurations, id: \.minutes) { item in
                    Button {
                        selectedDurationMinutes = item.minutes
                    } label: {
                        Text(item.label)
                            .font(.pmBody)
                            .foregroundStyle(
                                selectedDurationMinutes == item.minutes ? .black : Color.pmPrimary
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedDurationMinutes == item.minutes
                                ? Color.pmAccent
                                : Color.pmCard
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .strokeBorder(
                                        selectedDurationMinutes == item.minutes
                                        ? Color.pmAccent : Color.pmBorder,
                                        lineWidth: 1
                                    )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            if let rate = zone.hourlyRate {
                let cost = rate * Double(selectedDurationMinutes) / 60.0
                Text(String(format: "Estimated cost: £%.2f", cost))
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmAccent)
            }
        }
        .padding()
        .pmCard()
    }

    private var messagePreview: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("SMS Preview")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
                    .textCase(.uppercase)
                Spacer()
                Text("to \(zone.smsNumber ?? "81025")")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
            }

            Text(smsPreview)
                .font(.pmMono)
                .foregroundStyle(cvv.isEmpty ? Color.pmSecondary : Color.pmPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color.pmBackground)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding()
        .pmCard()
    }

    private var cvvEntry: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Card Security Code (CVV)")
                .font(.pmCaption)
                .foregroundStyle(Color.pmSecondary)
                .textCase(.uppercase)

            SecureField("3-digit CVV", text: $cvvInput)
                .font(.pmMono)
                .keyboardType(.numberPad)
                .foregroundStyle(Color.pmPrimary)
                .padding()
                .background(Color.pmBackground)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            Text("Save your CVV in Settings to skip this step.")
                .font(.pmCaption)
                .foregroundStyle(Color.pmSecondary)
        }
        .padding()
        .pmCard()
    }

    private func vehicleRow(_ vehicle: Vehicle) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Vehicle")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
                    .textCase(.uppercase)
                Text(vehicle.registration)
                    .font(.pmMono)
                    .foregroundStyle(Color.pmPrimary)
                if let make = vehicle.make, let model = vehicle.model {
                    Text("\(make) \(model)")
                        .font(.pmCaption)
                        .foregroundStyle(Color.pmSecondary)
                }
            }
            Spacer()
            Toggle("Include reg", isOn: $useRegistration)
                .tint(Color.pmAccent)
                .labelsHidden()
        }
        .padding()
        .pmCard()
    }

    private var payButton: some View {
        Group {
            if zone.smsCapable {
                Button("Open Messages to Pay") {
                    guard canPay else { errorMessage = "Please enter your CVV"; return }
                    smsBody = SMSFormatter.parkBody(
                        zoneCode: zone.zoneCode,
                        durationMinutes: selectedDurationMinutes,
                        cvv: cvv,
                        registration: useRegistration ? defaultVehicle?.registration : nil
                    )
                    showSMSComposer = true
                }
                .buttonStyle(.pmPrimary)
                .disabled(!canPay)
            } else {
                nonRingGoActions
            }
        }
    }

    private var nonRingGoActions: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "exclamationmark.circle")
                    .foregroundStyle(Color.pmWarning)
                Text("\(zone.provider.displayName) does not support SMS payment. Open their app instead.")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
            }
            .padding()
            .pmCard()

            if let scheme = zone.provider.appURLScheme,
               let url = URL(string: scheme) {
                Button("Open \(zone.provider.displayName)") {
                    UIApplication.shared.open(url)
                }
                .buttonStyle(.pmPrimary)
            }
        }
    }

    // MARK: - Actions

    private func handleSMSSent() {
        guard let vehicle = defaultVehicle ?? (try? ZoneDatabase.shared.allVehicles().first) else {
            errorMessage = "No vehicle found. Add one in Settings."
            return
        }
        do {
            let session = try sessionManager.startSession(
                zone: zone,
                vehicle: vehicle,
                durationMinutes: selectedDurationMinutes,
                cvv: cvv
            )
            sentSession = session
            showConfirmation = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
