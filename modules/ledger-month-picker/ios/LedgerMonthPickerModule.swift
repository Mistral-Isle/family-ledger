import ExpoModulesCore
import UIKit

public final class LedgerMonthPickerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LedgerMonthPicker")
    View(LedgerMonthPickerView.self) {
      Events("onMonthChange")
      Prop("month") { (view: LedgerMonthPickerView, month: String) in
        view.setMonth(month)
      }
      Prop("dark") { (view: LedgerMonthPickerView, dark: Bool) in
        view.overrideUserInterfaceStyle = dark ? .dark : .light
      }
    }
  }
}

final class LedgerMonthPickerView: ExpoView {
  let onMonthChange = EventDispatcher()
  private let picker = UIDatePicker()
  private var calendar = Calendar(identifier: .gregorian)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    calendar.timeZone = TimeZone(identifier: "Asia/Shanghai")!
    picker.calendar = calendar
    picker.timeZone = calendar.timeZone
    picker.locale = Locale(identifier: "zh_CN")
    picker.preferredDatePickerStyle = .wheels
    if #available(iOS 17.4, *), traitCollection.userInterfaceIdiom != .mac {
      picker.datePickerMode = .yearAndMonth
    } else {
      picker.datePickerMode = .date
    }
    picker.addTarget(self, action: #selector(changed), for: .valueChanged)
    addSubview(picker)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    picker.frame = bounds
  }

  func setMonth(_ value: String) {
    let parts = value.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 2, (1...12).contains(parts[1]),
      let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: 1, hour: 12)) else { return }
    let current = calendar.dateComponents([.year, .month], from: picker.date)
    if current.year != parts[0] || current.month != parts[1] {
      picker.setDate(date, animated: false)
    }
  }

  @objc private func changed() {
    let parts = calendar.dateComponents([.year, .month], from: picker.date)
    guard let year = parts.year, let month = parts.month else { return }
    onMonthChange(["month": String(format: "%04d-%02d", year, month)])
  }
}
