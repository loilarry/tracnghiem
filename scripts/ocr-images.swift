import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: ocr-images <image-directory> <output-directory>\n", stderr)
    exit(2)
}

let imageDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let imageURLs = try FileManager.default.contentsOfDirectory(at: imageDirectory, includingPropertiesForKeys: nil)
    .filter { ["jpg", "jpeg", "png"].contains($0.pathExtension.lowercased()) }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }

for imageURL in imageURLs {
    guard let image = NSImage(contentsOf: imageURL) else {
        fputs("Could not read \(imageURL.path)\n", stderr)
        continue
    }
    var imageRect = NSRect(origin: .zero, size: image.size)
    guard let cgImage = image.cgImage(forProposedRect: &imageRect, context: nil, hints: nil) else {
        fputs("Could not decode \(imageURL.path)\n", stderr)
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["vi-VN", "en-US"]
    request.minimumTextHeight = 0.012
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
        struct OCRLine: Codable {
            let text: String
            let x: Float
            let y: Float
            let width: Float
            let height: Float
        }
        let observations = request.results ?? []
        let lines = observations.compactMap { observation -> OCRLine? in
            guard let text = observation.topCandidates(1).first?.string else { return nil }
            let box = observation.boundingBox
            return OCRLine(text: text, x: Float(box.origin.x), y: Float(box.origin.y), width: Float(box.size.width), height: Float(box.size.height))
        }
        let outputURL = outputDirectory.appendingPathComponent(imageURL.deletingPathExtension().lastPathComponent + ".txt")
        try lines.map { $0.text }.joined(separator: "\n").appending("\n").write(to: outputURL, atomically: true, encoding: String.Encoding.utf8)
        let jsonURL = outputDirectory.appendingPathComponent(imageURL.deletingPathExtension().lastPathComponent + ".json")
        let json = try JSONEncoder().encode(lines)
        try json.write(to: jsonURL)
        print("OCR \(imageURL.lastPathComponent) -> \(outputURL.path)")
    } catch {
        fputs("OCR failed for \(imageURL.path): \(error)\n", stderr)
    }
}
