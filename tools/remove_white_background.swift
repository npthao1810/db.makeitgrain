import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 || CommandLine.arguments.count == 4 else {
  fputs("Usage: remove_white_background.swift <input> <output> [outer-pixels-to-clear]\n", stderr)
  exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let outerPixelsToClear = CommandLine.arguments.count == 4 ? (Int(CommandLine.arguments[3]) ?? 0) : 0
guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
      let sourceImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fputs("Cannot read \(inputURL.path)\n", stderr)
  exit(1)
}

let width = sourceImage.width
let height = sourceImage.height
let bytesPerRow = width * 4
var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
guard let context = CGContext(
  data: &pixels,
  width: width,
  height: height,
  bitsPerComponent: 8,
  bytesPerRow: bytesPerRow,
  space: CGColorSpaceCreateDeviceRGB(),
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
  fputs("Cannot create image context\n", stderr)
  exit(1)
}
context.interpolationQuality = .high
context.draw(sourceImage, in: CGRect(x: 0, y: 0, width: width, height: height))

func isNearWhite(_ offset: Int) -> Bool {
  let red = Int(pixels[offset])
  let green = Int(pixels[offset + 1])
  let blue = Int(pixels[offset + 2])
  let alpha = Int(pixels[offset + 3])
  return alpha > 0 && red > 225 && green > 225 && blue > 225
    && max(red, green, blue) - min(red, green, blue) < 24
}

// Only remove pixels connected to an outer edge. White printing and product
// details inside the package stay intact.
var visited = [Bool](repeating: false, count: width * height)
var queue: [Int] = []
func addIfBackground(_ x: Int, _ y: Int) {
  let position = y * width + x
  if !visited[position] && isNearWhite(position * 4) {
    visited[position] = true
    queue.append(position)
  }
}
for x in 0..<width { addIfBackground(x, 0); addIfBackground(x, height - 1) }
for y in 0..<height { addIfBackground(0, y); addIfBackground(width - 1, y) }

var head = 0
while head < queue.count {
  let position = queue[head]
  head += 1
  let x = position % width
  let y = position / width
  for (nextX, nextY) in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] {
    if nextX >= 0 && nextX < width && nextY >= 0 && nextY < height {
      addIfBackground(nextX, nextY)
    }
  }
}

for position in queue {
  pixels[position * 4 + 3] = 0
}

// Some supplier images contain a one-pixel dark export frame at the image
// boundary. It is not connected to the product, so remove only that exterior
// frame when explicitly requested.
if outerPixelsToClear > 0 {
  for y in 0..<height {
    for x in 0..<width where x < outerPixelsToClear || y < outerPixelsToClear || x >= width - outerPixelsToClear || y >= height - outerPixelsToClear {
      pixels[(y * width + x) * 4 + 3] = 0
    }
  }
}

// Keep the main connected opaque component (the product package) and discard
// detached remnants such as supplier-export border lines or isolated specks.
// This is deliberately applied after background removal, so it cannot erase
// printing or details that are connected to the package.
var componentVisited = [Bool](repeating: false, count: width * height)
var largestComponent: [Int] = []
for start in 0..<(width * height) where !componentVisited[start] && pixels[start * 4 + 3] > 0 {
  var component: [Int] = [start]
  componentVisited[start] = true
  var componentHead = 0
  while componentHead < component.count {
    let position = component[componentHead]
    componentHead += 1
    let x = position % width
    let y = position / width
    for (nextX, nextY) in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] {
      if nextX >= 0 && nextX < width && nextY >= 0 && nextY < height {
        let next = nextY * width + nextX
        if !componentVisited[next] && pixels[next * 4 + 3] > 0 {
          componentVisited[next] = true
          component.append(next)
        }
      }
    }
  }
  if component.count > largestComponent.count { largestComponent = component }
}
var keep = [Bool](repeating: false, count: width * height)
for position in largestComponent { keep[position] = true }
for position in 0..<(width * height) where !keep[position] {
  pixels[position * 4 + 3] = 0
}

guard let outputImage = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fputs("Cannot create \(outputURL.path)\n", stderr)
  exit(1)
}
CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else {
  fputs("Cannot write \(outputURL.path)\n", stderr)
  exit(1)
}
