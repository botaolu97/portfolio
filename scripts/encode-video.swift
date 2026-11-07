// Re-encodes a video for the web with macOS's own encoder (no ffmpeg needed): H.264 at a set
// bitrate, AAC audio, fast start (plays before it has fully downloaded). Built and run by
// scripts/encode-videos.ts; see README → Videos.
//
//   encode-video <in> <out.mp4> <kbps|auto> [maxWidth]
//
// "auto" picks about 1.7 Mbps for a 1794×1080 screen recording and scales with the picture size;
// at that rate UI text looks the same as the original at 100% zoom.
import AVFoundation

let args = CommandLine.arguments
guard args.count >= 4 else {
  FileHandle.standardError.write("usage: encode-video <in> <out.mp4> <kbps|auto> [maxWidth]\n".data(using: .utf8)!)
  exit(2)
}
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let out = URL(fileURLWithPath: args[2])
let maxWidth = args.count > 4 ? Int(args[4]) ?? 1920 : 1920
try? FileManager.default.removeItem(at: out)

guard let vTrack = asset.tracks(withMediaType: .video).first else {
  FileHandle.standardError.write("no video track\n".data(using: .utf8)!)
  exit(1)
}
// Size as stored (before rotation); scaled down to maxWidth if wider, even dimensions.
let natural = vTrack.naturalSize
let scale = min(1, Double(maxWidth) / Double(natural.width))
let w = Int(Double(natural.width) * scale) / 2 * 2
let h = Int(Double(natural.height) * scale) / 2 * 2
let kbps: Int = args[3] == "auto"
  ? min(8000, max(600, Int(1700.0 * Double(w * h) / (1794.0 * 1080.0))))
  : Int(args[3]) ?? 1700

let reader = try AVAssetReader(asset: asset)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true

let vOut = AVAssetReaderTrackOutput(track: vTrack, outputSettings: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
])
reader.add(vOut)
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: w,
  AVVideoHeightKey: h,
  AVVideoScalingModeKey: AVVideoScalingModeResizeAspect,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: kbps * 1000,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalDurationKey: 4,
    AVVideoAllowFrameReorderingKey: true,
  ],
])
vIn.transform = vTrack.preferredTransform
vIn.expectsMediaDataInRealTime = false
writer.add(vIn)
var pairs: [(AVAssetReaderOutput, AVAssetWriterInput)] = [(vOut, vIn)]

if let aTrack = asset.tracks(withMediaType: .audio).first {
  let aOut = AVAssetReaderTrackOutput(track: aTrack, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
  reader.add(aOut)
  let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [
    AVFormatIDKey: kAudioFormatMPEG4AAC,
    AVNumberOfChannelsKey: 2,
    AVSampleRateKey: 48000,
    AVEncoderBitRateKey: 128_000,
  ])
  aIn.expectsMediaDataInRealTime = false
  writer.add(aIn)
  pairs.append((aOut, aIn))
}

reader.startReading()
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let group = DispatchGroup()
for (i, (output, input)) in pairs.enumerated() {
  group.enter()
  input.requestMediaDataWhenReady(on: DispatchQueue(label: "track\(i)")) {
    while input.isReadyForMoreMediaData {
      if let buffer = output.copyNextSampleBuffer() {
        input.append(buffer)
      } else {
        input.markAsFinished()
        group.leave()
        return
      }
    }
  }
}
group.wait()
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
finished.wait()
if writer.status != .completed || reader.status == .failed {
  FileHandle.standardError.write("failed: \(String(describing: writer.error ?? reader.error))\n".data(using: .utf8)!)
  exit(1)
}
print("\(w)x\(h) \(kbps) kbps")
