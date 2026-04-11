import XCTest

final class ParkMateUITests: XCTestCase {
    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launchArguments = ["UI_TESTING"]
        app.launch()
    }

    func testTabBarExists() {
        XCTAssertTrue(app.tabBars.firstMatch.exists)
    }

    func testSessionTabIsDefault() {
        let sessionTab = app.tabBars.buttons["Session"]
        XCTAssertTrue(sessionTab.exists)
        XCTAssertTrue(sessionTab.isSelected)
    }

    func testNearbyTabNavigation() {
        app.tabBars.buttons["Nearby"].tap()
        XCTAssertTrue(app.navigationBars["Nearby Zones"].waitForExistence(timeout: 3))
    }

    func testSettingsTabNavigation() {
        app.tabBars.buttons["Settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 3))
    }

    func testSettingsContainsExpectedSections() {
        app.tabBars.buttons["Settings"].tap()
        _ = app.navigationBars["Settings"].waitForExistence(timeout: 3)
        XCTAssertTrue(app.staticTexts["Security & Identity"].exists
                      || app.cells.count > 0)
    }
}
