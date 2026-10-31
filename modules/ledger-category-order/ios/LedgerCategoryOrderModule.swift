import ExpoModulesCore
import UIKit

public final class LedgerCategoryOrderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LedgerCategoryOrder")
    View(LedgerCategoryOrderView.self) {
      Events("onOrderChange", "onItemPress", "onItemAction")
      Prop("interactive") { (view: LedgerCategoryOrderView, interactive: Bool) in
        view.setInteractive(interactive)
      }
      Prop("itemHeight") { (view: LedgerCategoryOrderView, height: Double) in
        view.setItemHeight(height)
      }
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

final class LedgerCategoryOrderView: ExpoView, UITableViewDataSource, UITableViewDelegate, UITableViewDragDelegate, UITableViewDropDelegate {
  let onOrderChange = EventDispatcher()
  let onItemPress = EventDispatcher()
  let onItemAction = EventDispatcher()
  private let table = UITableView(frame: .zero, style: .plain)
  private var items: [[String: String]] = []
  private var surface: UIColor = .secondarySystemGroupedBackground
  private var interactive = false
  private var itemHeight: CGFloat = 82

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    table.dataSource = self
    table.delegate = self
    table.dragDelegate = self
    table.dropDelegate = self
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

  func setInteractive(_ value: Bool) {
    interactive = value
    table.setEditing(!value, animated: false)
    table.allowsSelection = value
    table.dragInteractionEnabled = value
    table.rowHeight = value ? itemHeight : UITableView.automaticDimension
    table.reloadData()
  }

  func setItemHeight(_ height: Double) {
    itemHeight = max(44, CGFloat(height))
    if interactive { table.rowHeight = itemHeight }
  }

  private func tint(_ value: String?) -> UIColor {
    guard let value = value, let hex = UInt32(value.replacingOccurrences(of: "#", with: ""), radix: 16) else { return .systemBlue }
    return UIColor(red: CGFloat((hex >> 16) & 255)/255, green: CGFloat((hex >> 8) & 255)/255, blue: CGFloat(hex & 255)/255, alpha: 1)
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
    if interactive {
      let item = items[indexPath.row]
      content.secondaryText = [item["subtitle"], item["amount"]].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
      content.secondaryTextProperties.color = .secondaryLabel
      content.secondaryTextProperties.numberOfLines = 2
      content.image = LedgerPaymentIcon.image(for: item["accountKind"])
        ?? UIImage(systemName: item["symbol"] ?? "circle.fill")
      content.imageProperties.tintColor = tint(item["color"])
      if item["selected"] == "true", item["accountKind"] == nil {
        let size = CGSize(width: 40, height: 40)
        let symbol = UIImage(systemName: item["symbol"] ?? "star.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 23, weight: .regular))
        content.image = UIGraphicsImageRenderer(size: size).image { context in
          self.tint(item["color"]).setFill()
          context.cgContext.fillEllipse(in: CGRect(origin: .zero, size: size))
          if let symbol = symbol {
            let ratio = min(24 / symbol.size.width, 24 / symbol.size.height)
            let w = symbol.size.width * ratio, h = symbol.size.height * ratio
            symbol.withTintColor(.white, renderingMode: .alwaysOriginal).draw(in: CGRect(x: (40-w)/2, y: (40-h)/2, width: w, height: h))
          }
        }.withRenderingMode(.alwaysOriginal)
      }
      content.imageProperties.maximumSize = CGSize(width: 40, height: 40)
      if item["selected"] == "true" {
        let check = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
        check.tintColor = tint(item["color"])
        cell.accessoryView = check
      } else { cell.accessoryView = nil }
      cell.accessibilityHint = "长按拖动排序"
    } else {
      cell.accessoryView = nil
    }
    cell.contentConfiguration = content
    cell.backgroundColor = items[indexPath.row]["selected"] == "true" ? tint(items[indexPath.row]["color"]).withAlphaComponent(0.12) : surface
    cell.showsReorderControl = !interactive
    cell.selectionStyle = .none
    return cell
  }

  func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
    guard interactive, items.indices.contains(indexPath.row), let id = items[indexPath.row]["id"] else { return }
    onItemPress(["id": id])
  }

  private func actions(at indexPath: IndexPath, key: String) -> UISwipeActionsConfiguration? {
    guard interactive, items.indices.contains(indexPath.row), let id = items[indexPath.row]["id"] else { return nil }
    let names = (items[indexPath.row][key] ?? "").split(separator: ",").map(String.init)
    let labels = ["hide": "隐藏", "show": "显示", "edit": "编辑", "delete": "删除", "balance": "调整余额", "remove": "移除"]
    let actions = names.compactMap { name -> UIContextualAction? in
      guard let label = labels[name] else { return nil }
      let action = UIContextualAction(style: name == "delete" || name == "remove" ? .destructive : .normal, title: label) { [weak self] _, _, completion in
        self?.onItemAction(["id": id, "action": name])
        completion(false)
        self?.table.setEditing(false, animated: true)
      }
      if name == "balance" { action.backgroundColor = .systemGreen }
      else if name == "edit" { action.backgroundColor = .systemBlue }
      return action
    }
    guard !actions.isEmpty else { return nil }
    let configuration = UISwipeActionsConfiguration(actions: actions)
    configuration.performsFirstActionWithFullSwipe = false
    return configuration
  }
  func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? { actions(at: indexPath, key: "trailing") }
  func tableView(_ tableView: UITableView, leadingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? { actions(at: indexPath, key: "leading") }

  func tableView(_ tableView: UITableView, itemsForBeginning session: UIDragSession, at indexPath: IndexPath) -> [UIDragItem] {
    guard interactive, items.count > 1, items.indices.contains(indexPath.row), let id = items[indexPath.row]["id"] else { return [] }
    session.localContext = self
    let item = UIDragItem(itemProvider: NSItemProvider(object: id as NSString))
    item.localObject = id
    return [item]
  }
  func tableView(_ tableView: UITableView, dragSessionIsRestrictedToDraggingApplication session: UIDragSession) -> Bool { true }
  func tableView(_ tableView: UITableView, dropSessionDidUpdate session: UIDropSession, withDestinationIndexPath destinationIndexPath: IndexPath?) -> UITableViewDropProposal {
    guard let source = session.localDragSession?.localContext as? LedgerCategoryOrderView, source === self else { return UITableViewDropProposal(operation: .cancel) }
    return UITableViewDropProposal(operation: .move, intent: .insertAtDestinationIndexPath)
  }
  func tableView(_ tableView: UITableView, performDropWith coordinator: UITableViewDropCoordinator) {
    guard let drop = coordinator.items.first, let id = drop.dragItem.localObject as? String,
      let from = items.firstIndex(where: { $0["id"] == id }) else { return }
    let to = min(max(0, coordinator.destinationIndexPath?.row ?? items.count - 1), items.count - 1)
    let source = IndexPath(row: from, section: 0), target = IndexPath(row: to, section: 0)
    tableView.performBatchUpdates {
      let moved = items.remove(at: from)
      items.insert(moved, at: to)
      tableView.moveRow(at: source, to: target)
    }
    coordinator.drop(drop.dragItem, toRowAt: target)
    onOrderChange(["ids": items.compactMap { $0["id"] }])
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
