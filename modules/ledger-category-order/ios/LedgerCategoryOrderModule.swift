import ExpoModulesCore
import UIKit

public final class LedgerCategoryOrderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LedgerCategoryOrder")
    View(LedgerCategoryOrderView.self) {
      Events("onOrderChange")
      Prop("items") { (view: LedgerCategoryOrderView, items: [[String: String]]) in
        view.setItems(items)
      }
      Prop("dark") { (view: LedgerCategoryOrderView, dark: Bool) in
        view.overrideUserInterfaceStyle = dark ? .dark : .light
      }
      Prop("surfaceColor") { (view: LedgerCategoryOrderView, color: String) in
        view.setSurfaceColor(color)
      }
    }
  }
}

final class LedgerCategoryOrderView: ExpoView, UITableViewDataSource, UITableViewDelegate {
  let onOrderChange = EventDispatcher()
  private let table = UITableView(frame: .zero, style: .plain)
  private var items: [[String: String]] = []
  private var surface: UIColor = .secondarySystemGroupedBackground

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    table.dataSource = self
    table.delegate = self
    table.setEditing(true, animated: false)
    table.allowsSelection = false
    table.allowsSelectionDuringEditing = false
    table.estimatedRowHeight = 56
    table.rowHeight = UITableView.automaticDimension
    table.tableFooterView = UIView(frame: .zero)
    table.backgroundColor = surface
    table.register(UITableViewCell.self, forCellReuseIdentifier: "category")
    addSubview(table)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    table.frame = bounds
  }

  func setItems(_ next: [[String: String]]) {
    guard next.allSatisfy({ !($0["id"] ?? "").isEmpty && $0["name"] != nil }),
      Set(next.compactMap { $0["id"] }).count == next.count else { return }
    // JS echoes the native order; do not reload the table during that gesture.
    guard next != items else { return }
    items = next
    table.reloadData()
  }

  func setSurfaceColor(_ value: String) {
    let hex = value.replacingOccurrences(of: "#", with: "")
    guard hex.count == 6, let number = UInt32(hex, radix: 16) else { return }
    surface = UIColor(red: CGFloat((number >> 16) & 255) / 255,
      green: CGFloat((number >> 8) & 255) / 255,
      blue: CGFloat(number & 255) / 255, alpha: 1)
    table.backgroundColor = surface
    for cell in table.visibleCells { cell.backgroundColor = surface }
  }

  func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { items.count }

  func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
    let cell = tableView.dequeueReusableCell(withIdentifier: "category", for: indexPath)
    var content = cell.defaultContentConfiguration()
    content.text = items[indexPath.row]["name"]
    content.textProperties.font = .preferredFont(forTextStyle: .body)
    content.textProperties.adjustsFontForContentSizeCategory = true
    content.textProperties.color = .label
    cell.contentConfiguration = content
    cell.backgroundColor = surface
    cell.showsReorderControl = true
    cell.selectionStyle = .none
    return cell
  }

  func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool { items.count > 1 }
  func tableView(_ tableView: UITableView, canEditRowAt indexPath: IndexPath) -> Bool { true }
  func tableView(_ tableView: UITableView, editingStyleForRowAt indexPath: IndexPath) -> UITableViewCell.EditingStyle { .none }
  func tableView(_ tableView: UITableView, shouldIndentWhileEditingRowAt indexPath: IndexPath) -> Bool { false }

  func tableView(_ tableView: UITableView, moveRowAt sourceIndexPath: IndexPath, to destinationIndexPath: IndexPath) {
    guard items.indices.contains(sourceIndexPath.row), items.indices.contains(destinationIndexPath.row) else { return }
    let moved = items.remove(at: sourceIndexPath.row)
    items.insert(moved, at: destinationIndexPath.row)
    onOrderChange(["ids": items.compactMap { $0["id"] }])
  }
}
