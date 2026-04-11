import SwiftUI
import MessageUI

// MARK: - UIViewControllerRepresentable Wrapper

struct SMSComposerView: UIViewControllerRepresentable {
    let recipients: [String]
    let body: String
    var onFinish: ((MessageComposeResult) -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let vc = MFMessageComposeViewController()
        vc.recipients = recipients
        vc.body = body
        vc.messageComposeDelegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}

    static var canSendText: Bool { MFMessageComposeViewController.canSendText() }

    class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        var onFinish: ((MessageComposeResult) -> Void)?
        init(onFinish: ((MessageComposeResult) -> Void)?) { self.onFinish = onFinish }

        func messageComposeViewController(
            _ controller: MFMessageComposeViewController,
            didFinishWith result: MessageComposeResult
        ) {
            controller.dismiss(animated: true)
            onFinish?(result)
        }
    }
}

// MARK: - Sheet Modifier

struct SMSComposerModifier: ViewModifier {
    @Binding var isPresented: Bool
    let recipients: [String]
    let body: String
    var onFinish: ((MessageComposeResult) -> Void)?

    func body(content: Content) -> some View {
        content.sheet(isPresented: $isPresented) {
            if SMSComposerView.canSendText {
                SMSComposerView(recipients: recipients, body: body, onFinish: onFinish)
                    .ignoresSafeArea()
            } else {
                SimulatorSMSFallbackView(body: body)
            }
        }
    }
}

extension View {
    func smsComposer(
        isPresented: Binding<Bool>,
        recipients: [String],
        body: String,
        onFinish: ((MessageComposeResult) -> Void)? = nil
    ) -> some View {
        modifier(SMSComposerModifier(
            isPresented: isPresented,
            recipients: recipients,
            body: body,
            onFinish: onFinish
        ))
    }
}

// MARK: - Simulator Fallback

struct SimulatorSMSFallbackView: View {
    let body: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "message.badge.filled.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(Color.pmAccent)

                Text("SMS Preview")
                    .font(.pmTitle)
                    .foregroundStyle(Color.pmPrimary)

                Text("Physical device required to send SMS.\nMessage that would be sent:")
                    .font(.pmBody)
                    .foregroundStyle(Color.pmSecondary)
                    .multilineTextAlignment(.center)

                Text(body)
                    .font(.pmMono)
                    .foregroundStyle(Color.pmPrimary)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .pmCard()
                    .padding(.horizontal)

                Button("Close") { dismiss() }
                    .buttonStyle(.pmPrimary)
                    .padding(.horizontal)
            }
            .padding()
            .background(Color.pmBackground)
            .navigationTitle("SMS Not Available")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(Color.pmAccent)
                }
            }
        }
    }
}
