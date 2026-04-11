import SwiftUI

struct SettingsView: View {
    @State private var settings = AppSettings.shared

    // CVV
    @State private var cvvInput: String = ""
    @State private var hasSavedCVV = false
    @State private var showCVVField = false

    // Alerts
    @State private var alertTitle = ""
    @State private var alertMessage = ""
    @State private var showAlert = false

    var body: some View {
        List {
            securitySection
            parkingSection
            detectionSection
            aboutSection
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.pmBackground)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .onAppear(perform: refreshCVVStatus)
    }

    // MARK: - Sections

    private var securitySection: some View {
        Section {
            if hasSavedCVV {
                HStack {
                    Label("CVV Saved", systemImage: "lock.fill")
                        .foregroundStyle(Color.pmPrimary)
                    Spacer()
                    Button("Remove") {
                        SecureStorage.shared.deleteCVV()
                        refreshCVVStatus()
                    }
                    .foregroundStyle(Color.pmDanger)
                    .font(.pmCaption)
                }
            } else {
                HStack {
                    Label("Card CVV", systemImage: "lock")
                        .foregroundStyle(Color.pmPrimary)
                    Spacer()
                    Button(showCVVField ? "Cancel" : "Add") {
                        showCVVField.toggle()
                        cvvInput = ""
                    }
                    .foregroundStyle(Color.pmAccent)
                    .font(.pmCaption)
                }
                if showCVVField {
                    HStack {
                        SecureField("3-digit CVV", text: $cvvInput)
                            .keyboardType(.numberPad)
                            .foregroundStyle(Color.pmPrimary)
                        Button("Save") {
                            saveCVV()
                        }
                        .disabled(cvvInput.count != 3)
                        .foregroundStyle(cvvInput.count == 3 ? Color.pmAccent : Color.pmSecondary)
                    }
                }
            }

            NavigationLink {
                VehicleSettingsView()
            } label: {
                Label("Vehicles", systemImage: "car.fill")
                    .foregroundStyle(Color.pmPrimary)
            }
        } header: {
            Text("Security & Identity")
                .foregroundStyle(Color.pmSecondary)
        } footer: {
            Text("Your CVV is stored encrypted in the iOS Keychain and never leaves your device.")
                .foregroundStyle(Color.pmSecondary)
        }
        .listRowBackground(Color.pmCard)
    }

    private var parkingSection: some View {
        Section {
            Picker(selection: Binding(
                get: { settings.defaultDurationMinutes },
                set: { settings.defaultDurationMinutes = $0 }
            )) {
                ForEach(DurationFormatter.commonDurations, id: \.minutes) { item in
                    Text(item.label).tag(item.minutes)
                }
            } label: {
                Label("Default Duration", systemImage: "clock")
                    .foregroundStyle(Color.pmPrimary)
            }
            .pickerStyle(.menu)
            .tint(Color.pmAccent)

            Stepper(value: Binding(
                get: { settings.expiryWarningMinutes },
                set: { settings.expiryWarningMinutes = $0 }
            ), in: 5...60, step: 5) {
                Label("Expiry Warning", systemImage: "bell.badge")
                    .foregroundStyle(Color.pmPrimary)
                Text("\(settings.expiryWarningMinutes) min before expiry")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
            }
        } header: {
            Text("Parking Defaults")
                .foregroundStyle(Color.pmSecondary)
        }
        .listRowBackground(Color.pmCard)
    }

    private var detectionSection: some View {
        Section {
            Toggle(isOn: Binding(
                get: { settings.autoDetectEnabled },
                set: { settings.autoDetectEnabled = $0 }
            )) {
                Label("Auto-Detection", systemImage: "location.circle")
                    .foregroundStyle(Color.pmPrimary)
            }
            .tint(Color.pmAccent)

            Stepper(value: Binding(
                get: { Int(settings.geofenceRadius) },
                set: { settings.geofenceRadius = Double($0) }
            ), in: 50...500, step: 25) {
                Label("Geofence Radius", systemImage: "circle.dashed")
                    .foregroundStyle(Color.pmPrimary)
                Text("\(Int(settings.geofenceRadius))m")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
            }

            Stepper(value: Binding(
                get: { Int(settings.dwellTimeSeconds) },
                set: { settings.dwellTimeSeconds = Double($0) }
            ), in: 15...300, step: 15) {
                Label("Dwell Time", systemImage: "timer")
                    .foregroundStyle(Color.pmPrimary)
                Text("\(Int(settings.dwellTimeSeconds))s stationary before detecting")
                    .font(.pmCaption)
                    .foregroundStyle(Color.pmSecondary)
            }

            NavigationLink {
                ZoneManagementView()
            } label: {
                Label("Manage Zones", systemImage: "mappin.and.ellipse")
                    .foregroundStyle(Color.pmPrimary)
            }
        } header: {
            Text("Detection")
                .foregroundStyle(Color.pmSecondary)
        } footer: {
            Text("Auto-detection uses CoreLocation geofencing and requires Always location permission.")
                .foregroundStyle(Color.pmSecondary)
        }
        .listRowBackground(Color.pmCard)
    }

    private var aboutSection: some View {
        Section {
            HStack {
                Label("Version", systemImage: "info.circle")
                    .foregroundStyle(Color.pmPrimary)
                Spacer()
                Text(appVersion)
                    .font(.pmMono)
                    .foregroundStyle(Color.pmSecondary)
            }

            Button {
                UIApplication.shared.open(URL(string: "https://www.myringgo.co.uk/texttopark")!)
            } label: {
                Label("RingGo Text to Park", systemImage: "arrow.up.right.square")
                    .foregroundStyle(Color.pmAccent)
            }
        } header: {
            Text("About")
                .foregroundStyle(Color.pmSecondary)
        }
        .listRowBackground(Color.pmCard)
    }

    // MARK: - Actions

    private func saveCVV() {
        guard cvvInput.count == 3 else { return }
        do {
            try SecureStorage.shared.saveCVV(cvvInput)
            cvvInput = ""
            showCVVField = false
            refreshCVVStatus()
        } catch {
            alertTitle = "Error"
            alertMessage = error.localizedDescription
            showAlert = true
        }
    }

    private func refreshCVVStatus() {
        hasSavedCVV = SecureStorage.shared.cvv != nil
        settings = AppSettings.shared
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
