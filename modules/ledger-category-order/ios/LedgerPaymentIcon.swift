import UIKit

// Template glyphs match AccountIcon.tsx's 32-point paths, including the eye cutouts.
enum LedgerPaymentIcon {
  static let wechat = draw { context in
    let back = UIBezierPath()
    back.move(to: CGPoint(x: 12.5, y: 4))
    back.addCurve(to: CGPoint(x: 2, y: 12.5), controlPoint1: CGPoint(x: 6.7, y: 4), controlPoint2: CGPoint(x: 2, y: 7.8))
    back.addCurve(to: CGPoint(x: 6.1, y: 19.2), controlPoint1: CGPoint(x: 2, y: 15.2), controlPoint2: CGPoint(x: 3.6, y: 17.6))
    back.addLine(to: CGPoint(x: 5, y: 23))
    back.addLine(to: CGPoint(x: 9.1, y: 20.7))
    back.addCurve(to: CGPoint(x: 12.5, y: 21.1), controlPoint1: CGPoint(x: 10.2, y: 21), controlPoint2: CGPoint(x: 11.3, y: 21.1))
    back.addLine(to: CGPoint(x: 12.9, y: 21.1))
    back.addCurve(to: CGPoint(x: 12.2, y: 17.7), controlPoint1: CGPoint(x: 12.4, y: 20), controlPoint2: CGPoint(x: 12.2, y: 18.9))
    back.addCurve(to: CGPoint(x: 21.8, y: 9.3), controlPoint1: CGPoint(x: 12.2, y: 13), controlPoint2: CGPoint(x: 16.5, y: 9.3))
    back.addLine(to: CGPoint(x: 21.9, y: 9.3))
    back.addCurve(to: CGPoint(x: 12.5, y: 4), controlPoint1: CGPoint(x: 20.3, y: 6.2), controlPoint2: CGPoint(x: 16.7, y: 4))
    back.close()
    back.fill()

    let front = UIBezierPath()
    front.move(to: CGPoint(x: 30, y: 18))
    front.addCurve(to: CGPoint(x: 21.8, y: 11), controlPoint1: CGPoint(x: 30, y: 14.1), controlPoint2: CGPoint(x: 26.3, y: 11))
    front.addCurve(to: CGPoint(x: 13.6, y: 18), controlPoint1: CGPoint(x: 17.3, y: 11), controlPoint2: CGPoint(x: 13.6, y: 14.1))
    front.addCurve(to: CGPoint(x: 21.8, y: 25), controlPoint1: CGPoint(x: 13.6, y: 21.9), controlPoint2: CGPoint(x: 17.3, y: 25))
    front.addCurve(to: CGPoint(x: 24.4, y: 24.6), controlPoint1: CGPoint(x: 22.7, y: 25), controlPoint2: CGPoint(x: 23.6, y: 24.9))
    front.addLine(to: CGPoint(x: 27.9, y: 26.6))
    front.addLine(to: CGPoint(x: 26.9, y: 23.5))
    front.addCurve(to: CGPoint(x: 30, y: 18), controlPoint1: CGPoint(x: 28.8, y: 22.2), controlPoint2: CGPoint(x: 30, y: 20.2))
    front.close()
    front.fill()
    context.setBlendMode(.clear)
    let eyes: [(CGFloat, CGFloat, CGFloat)] = [(9, 10, 1.25), (16, 10, 1.25), (19, 16, 1.1), (24.5, 16, 1.1)]
    for (x, y, radius) in eyes {
      context.fillEllipse(in: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
    }
  }

  static let alipay = draw { _ in
    let path = UIBezierPath()
    path.move(to: CGPoint(x: 15, y: 4))
    path.addLine(to: CGPoint(x: 15, y: 13))
    path.move(to: CGPoint(x: 7, y: 8))
    path.addLine(to: CGPoint(x: 26, y: 8))
    path.move(to: CGPoint(x: 8, y: 13))
    path.addLine(to: CGPoint(x: 23, y: 13))
    path.addCurve(to: CGPoint(x: 9.8, y: 26), controlPoint1: CGPoint(x: 21.5, y: 19.7), controlPoint2: CGPoint(x: 15.8, y: 26))
    path.addCurve(to: CGPoint(x: 8.7, y: 19.8), controlPoint1: CGPoint(x: 3.4, y: 26), controlPoint2: CGPoint(x: 3, y: 19.8))
    path.addCurve(to: CGPoint(x: 31, y: 26.8), controlPoint1: CGPoint(x: 15.5, y: 19.8), controlPoint2: CGPoint(x: 21.8, y: 25.8))
    path.lineWidth = 2.7
    path.lineCapStyle = .round
    path.lineJoinStyle = .round
    path.stroke()
  }

  static func image(for kind: String?) -> UIImage? {
    switch kind {
    case "wechat": return wechat
    case "alipay": return alipay
    default: return nil
    }
  }

  private static func draw(_ body: (CGContext) -> Void) -> UIImage {
    UIGraphicsImageRenderer(size: CGSize(width: 34, height: 34)).image { renderer in
      UIColor.black.setFill()
      UIColor.black.setStroke()
      // A one-point inset keeps the rounded Alipay stroke inside the image.
      renderer.cgContext.translateBy(x: 1, y: 1)
      body(renderer.cgContext)
    }.withRenderingMode(.alwaysTemplate)
  }
}
