import ExpoModulesCore
import UIKit

public final class LedgerTabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LedgerTabBar")
    View(LedgerTabBarView.self) {
      Events("onSelect")
      Prop("items") { (view: LedgerTabBarView, items: [[String: String]]) in
        view.setItems(items)
      }
      Prop("selectedIndex") { (view: LedgerTabBarView, index: Int) in
        view.setSelectedIndex(index)
      }
      Prop("dark") { (view: LedgerTabBarView, dark: Bool) in
        view.setDark(dark)
      }
      Prop("activeColor") { (view: LedgerTabBarView, color: String) in
        view.setActiveColor(color)
      }
      Prop("mutedColor") { (view: LedgerTabBarView, color: String) in
        view.setMutedColor(color)
      }
    }
  }
}

final class LedgerTabBarView: ExpoView {
  let onSelect = EventDispatcher()
  private let control = UISegmentedControl(frame: .zero)
  private var items: [[String: String]] = []
  private var desiredIndex = 0
  private var isDark = false
  private var activeColor: UIColor = .systemBlue
  private var mutedColor: UIColor = .secondaryLabel

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = false
    control.clipsToBounds = false
    control.apportionsSegmentWidthsByContent = false
    control.addTarget(self, action: #selector(handleValueChanged), for: .valueChanged)
    addSubview(control)
    applyColors()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    control.frame = bounds
    if #unavailable(iOS 26.0) {
      control.layer.cornerRadius = bounds.height / 2
      control.layer.masksToBounds = true
    }
  }

  @objc private func handleValueChanged() {
    let idx = control.selectedSegmentIndex
    guard idx >= 0, idx < items.count else { return }
    desiredIndex = idx
    onSelect(["index": idx])
  }

  func setItems(_ next: [[String: String]]) {
    guard next != items else { return }
    items = next
    control.removeAllSegments()
    for (index, item) in next.enumerated() {
      let label = item["label"] ?? ""
      let symbol = item["symbol"] ?? "circle.fill"
      let image = renderSegmentImage(label: label, symbol: symbol)
      image.accessibilityLabel = label
      control.insertSegment(with: image, at: index, animated: false)
    }
    syncSelection()
    applyColors()
  }

  func setSelectedIndex(_ index: Int) {
    desiredIndex = index
    syncSelection()
  }

  func setDark(_ dark: Bool) {
    isDark = dark
    overrideUserInterfaceStyle = dark ? .dark : .light
    control.overrideUserInterfaceStyle = dark ? .dark : .light
    applyColors()
  }

  func setActiveColor(_ hex: String) {
    if let parsed = parseHexColor(hex) {
      activeColor = parsed
      applyColors()
    }
  }

  func setMutedColor(_ hex: String) {
    if let parsed = parseHexColor(hex) {
      mutedColor = parsed
      applyColors()
    }
  }

  private func syncSelection() {
    guard control.numberOfSegments > 0 else { return }
    let clamped = max(0, min(control.numberOfSegments - 1, desiredIndex))
    if control.selectedSegmentIndex != clamped {
      control.selectedSegmentIndex = clamped
    }
  }

  private func applyColors() {
    control.setTitleTextAttributes([.foregroundColor: mutedColor], for: .normal)
    control.setTitleTextAttributes([.foregroundColor: activeColor], for: .selected)
    if #available(iOS 26.0, *) {
      // Leave backgroundColor and selectedSegmentTintColor untouched so UIKit
      // renders the native iOS 26 Liquid Glass capsule track and optical lens bubble.
    } else {
      control.backgroundColor = isDark
        ? UIColor.white.withAlphaComponent(0.10)
        : UIColor.black.withAlphaComponent(0.06)
      control.selectedSegmentTintColor = isDark
        ? UIColor.white.withAlphaComponent(0.18)
        : .white
    }
  }

  private func renderSegmentImage(label: String, symbol: String) -> UIImage {
    let size = CGSize(width: 64, height: 46)
    let renderer = UIGraphicsImageRenderer(size: size)
    let img = renderer.image { _ in
      let config = UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold)
      if let icon = UIImage(systemName: symbol, withConfiguration: config) {
        let maxW: CGFloat = 26
        let maxH: CGFloat = 22
        let ratio = min(maxW / max(1, icon.size.width), maxH / max(1, icon.size.height))
        let w = icon.size.width * ratio
        let h = icon.size.height * ratio
        let iconRect = CGRect(x: (size.width - w) / 2, y: 4 + (maxH - h) / 2, width: w, height: h)
        icon.withTintColor(.black, renderingMode: .alwaysOriginal).draw(in: iconRect)
      }
      let paragraph = NSMutableParagraphStyle()
      paragraph.alignment = .center
      paragraph.lineBreakMode = .byTruncatingTail
      let attrs: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
        .foregroundColor: UIColor.black,
        .paragraphStyle: paragraph,
      ]
      let textRect = CGRect(x: 2, y: 29, width: size.width - 4, height: 15)
      (label as NSString).draw(in: textRect, withAttributes: attrs)
    }
    return img.withRenderingMode(.alwaysTemplate)
  }

  private func parseHexColor(_ value: String) -> UIColor? {
    let hex = value.replacingOccurrences(of: "#", with: "")
    guard hex.count == 6, let number = UInt32(hex, radix: 16) else { return nil }
    return UIColor(
      red: CGFloat((number >> 16) & 255) / 255,
      green: CGFloat((number >> 8) & 255) / 255,
      blue: CGFloat(number & 255) / 255,
      alpha: 1
    )
  }
}
