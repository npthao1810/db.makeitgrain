import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 4,
      let padding = Int(CommandLine.arguments[3]) else {
  fputs("Usage: crop_transparent_image.swift <input> <output> <padding-pixels>\n", stderr)
  exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fputs("Cannot read \(inputURL.path)\n", stderr)
  exit(1)
}

let width = image.width
let height = image.height
let bytesPerRow = width * 4
var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
guard let context = CGContext(data: &pixels, width: width, height: height,
                              bitsPerComponent: 8, bytesPerRow: bytesPerRow,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
  exit(1)
}
context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

var minX = width, minY = height, maxX = -1, maxY = -1
for y in 0..<height {
  for x in 0..<width where pixels[(y * width + x) * 4 + 3] > 0 {
    minX = min(minX, x); maxX = max(maxX, x)
    minY = min(minY, y); maxY = max(maxY, y)
  }
}
guard maxX >= minX else { exit(1) }
let cropX = max(0, minX - padding)
let cropY = max(0, minY - padding)
let cropWidth = min(width - cropX, maxX - minX + 1 + padding * 2)
let cropHeight = min(height - cropY, maxY - minY + 1 + padding * 2)
guard let cropped = image.cropping(to: CGRect(x: cropX, y: cropY, width: cropWidth, height: cropHeight)),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(destination, cropped, nil)
guard CGImageDestinationFinalize(destination) else { exit(1) }
