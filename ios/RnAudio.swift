import Foundation
import AVFoundation


@objc(RnAudio)
class RnAudio: RCTEventEmitter, AVAudioRecorderDelegate {

  var subscriptionDuration: Double = 0.5
  var audioFileURL: URL?

  // Recorder
  var audioRecorder: AVAudioRecorder!
  var audioSession: AVAudioSession!
  var recordTimer: Timer?
  var _meteringEnabled: Bool = false

  // Player
  var pausedPlayTime: CMTime?
  var audioPlayerAsset: AVURLAsset!
  var audioPlayerItem: AVPlayerItem!
  var audioPlayer: AVPlayer!
  var playTimer: Timer?
  var timeObserverToken: Any?

  @objc
  func construct() {
    self.subscriptionDuration = 0.1
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["rn-playback", "rn-recordback", "rn-stoppage"]
  }

  func setAudioFileURL(path: String) {
    if (path == "DEFAULT") {
      let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      audioFileURL = cachesDirectory.appendingPathComponent("sound.m4a")
    } else if (path.hasPrefix("http://") || path.hasPrefix("https://") || path.hasPrefix("file://")) {
      audioFileURL = URL(string: path)
    } else {
      let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      audioFileURL = cachesDirectory.appendingPathComponent(path)
    }
  }

  /**********               Recorder               **********/

  @objc(updateRecorderProgress:)
  public func updateRecorderProgress(timer: Timer) -> Void {
    if (audioRecorder != nil) {
      var currentMetering: Float = 0

      if (_meteringEnabled) {
        audioRecorder.updateMeters()
        currentMetering = audioRecorder.averagePower(forChannel: 0)
      }

      let status = [
        "isRecording": audioRecorder.isRecording,
        "currentPosition": audioRecorder.currentTime * 1000,
        "currentMetering": currentMetering,
      ] as [String : Any];

      sendEvent(withName: "rn-recordback", body: status)
    }
  }

  @objc(startRecorderTimer)
  func startRecorderTimer() -> Void {
    DispatchQueue.main.async {
      self.recordTimer = Timer.scheduledTimer(
        timeInterval: self.subscriptionDuration,
        target: self,
        selector: #selector(self.updateRecorderProgress),
        userInfo: nil,
        repeats: true
      )
    }
  }

  @objc(pauseRecorder:rejecter:)
  public func pauseRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioRecorder == nil) {
      return reject("RNAudioPlayerRecorder", "Recorder is not recording", nil)
    }

    recordTimer?.invalidate()
    recordTimer = nil;

    audioRecorder.pause()
    resolve("Recorder paused!")
  }

  @objc(resumeRecorder:rejecter:)
  public func resumeRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {

    if (audioRecorder == nil) {
      return reject("RNAudioPlayerRecorder", "Recorder is nil", nil)
    }

    audioRecorder.record()

    if (recordTimer == nil) {
      startRecorderTimer()
    }

    resolve("Recorder paused!")
  }

  @objc(audioPlayerDidFinishPlaying:)
  public static func audioPlayerDidFinishPlaying(player: AVAudioRecorder) -> Bool {
    return true
  }

  @objc(setSubscriptionDuration:)
  func setSubscriptionDuration(duration: Double) -> Void {
    subscriptionDuration = duration
  }

  /**********               Recorder               **********/

//@objc(startRecorder:audioSets:meteringEnabled:resolve:reject:)
  @objc(startRecorder:path:meteringEnabled:maxRecordingDurationSec:resolve:reject:)
  func startRecorder(
          audioSets: [String: Any],
          path: String,
          meteringEnabled: Bool, 
          maxRecordingDurationSec: Double,
          resolver resolve: @escaping RCTPromiseResolveBlock,
          rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {

    print("startRecorder()")

    _meteringEnabled = meteringEnabled;

    let encoding = audioSets["AVFormatIDKeyIOS"] as? String
    let mode = audioSets["AVModeIOS"] as? String
    let avLPCMBitDepth = audioSets["AVLinearPCMBitDepthKeyIOS"] as? Int
    let avLPCMIsBigEndian = audioSets["AVLinearPCMIsBigEndianKeyIOS"] as? Bool
    let avLPCMIsFloatKey = audioSets["AVLinearPCMIsFloatKeyIOS"] as? Bool
    let avLPCMIsNonInterleaved = audioSets["AVLinearPCMIsNonInterleavedIOS"] as? Bool

    print(" avLPCMBitDepth:", avLPCMBitDepth)
    print(" avLPCMIsBigEndian:", avLPCMIsBigEndian)
    print(" avLPCMIsFloatKey:", avLPCMIsFloatKey)
    print(" avLPCMIsNonInterleaved:", avLPCMIsNonInterleaved)
  
    var avFormat: Int? = nil
    var avMode: AVAudioSession.Mode = AVAudioSession.Mode.default
    var sampleRate = audioSets["AVSampleRateKeyIOS"] as? Int
    var numberOfChannel = audioSets["AVNumberOfChannelsKeyIOS"] as? Int
    var audioQuality = audioSets["AVEncoderAudioQualityKeyIOS"] as? Int

    print(" avFormat:", avFormat)
    print(" avMode:", avMode)
    print(" sampleRate:", sampleRate)
    print(" numberOfChannel:", numberOfChannel)
    print(" audioQuality:", audioQuality)

    setAudioFileURL(path: path)

    if (sampleRate == nil) {
      sampleRate = 44100;
    }

    if (encoding == nil) {
      avFormat = Int(kAudioFormatAppleLossless)
    } else {
      if (encoding == "lpcm") {
        avFormat = Int(kAudioFormatAppleIMA4)
      } else if (encoding == "ima4") {
        avFormat = Int(kAudioFormatAppleIMA4)
      } else if (encoding == "aac") {
        avFormat = Int(kAudioFormatMPEG4AAC)
      } else if (encoding == "MAC3") {
        avFormat = Int(kAudioFormatMACE3)
      } else if (encoding == "MAC6") {
        avFormat = Int(kAudioFormatMACE6)
      } else if (encoding == "ulaw") {
        avFormat = Int(kAudioFormatULaw)
      } else if (encoding == "alaw") {
        avFormat = Int(kAudioFormatALaw)
      } else if (encoding == "mp1") {
        avFormat = Int(kAudioFormatMPEGLayer1)
      } else if (encoding == "mp2") {
        avFormat = Int(kAudioFormatMPEGLayer2)
      } else if (encoding == "mp4") {
        avFormat = Int(kAudioFormatMPEG4AAC)
      } else if (encoding == "alac") {
        avFormat = Int(kAudioFormatAppleLossless)
      } else if (encoding == "amr") {
        avFormat = Int(kAudioFormatAMR)
      } else if (encoding == "flac") {
        if #available(iOS 11.0, *) {
          avFormat = Int(kAudioFormatFLAC)
        }
      } else if (encoding == "opus") {
        avFormat = Int(kAudioFormatOpus)
      }
    }

    if (mode == "measurement") {
      avMode = AVAudioSession.Mode.measurement
    } else if (mode == "gamechat") {
      avMode = AVAudioSession.Mode.gameChat
    } else if (mode == "movieplayback") {
      avMode = AVAudioSession.Mode.moviePlayback
    } else if (mode == "spokenaudio") {
      avMode = AVAudioSession.Mode.spokenAudio
    } else if (mode == "videochat") {
      avMode = AVAudioSession.Mode.videoChat
    } else if (mode == "videorecording") {
      avMode = AVAudioSession.Mode.videoRecording
    } else if (mode == "voicechat") {
      avMode = AVAudioSession.Mode.voiceChat
    } else if (mode == "voiceprompt") {
      if #available(iOS 12.0, *) {
        avMode = AVAudioSession.Mode.voicePrompt
      } else {
        // Fallback on earlier versions
      }
    }


    if (numberOfChannel == nil) {
      numberOfChannel = 2
    }

    if (audioQuality == nil) {
      audioQuality = AVAudioQuality.medium.rawValue
    }

    func startRecording() {
      
      print("startRecording()")
      
      let settings = [
        AVSampleRateKey: sampleRate!,
        AVFormatIDKey: avFormat!,
        AVNumberOfChannelsKey: numberOfChannel!,
        AVEncoderAudioQualityKey: audioQuality!,
        AVLinearPCMBitDepthKey: avLPCMBitDepth ?? AVLinearPCMBitDepthKey.count,
        AVLinearPCMIsBigEndianKey: avLPCMIsBigEndian ?? true,
        AVLinearPCMIsFloatKey: avLPCMIsFloatKey ?? false,
        AVLinearPCMIsNonInterleaved: avLPCMIsNonInterleaved ?? false
      ] as [String : Any]
      
      print("  1")
      print("  audioFileURL:", audioFileURL!)
      print("  settings:", settings)

      do {
        audioRecorder = try AVAudioRecorder(url: audioFileURL!, settings: settings)

      print("  2")

        if (audioRecorder != nil) {
          
          print("  3")

          audioRecorder.prepareToRecord()

          print("  4")

          audioRecorder.delegate = self
          audioRecorder.isMeteringEnabled = _meteringEnabled
          let isRecordStarted = audioRecorder.record()

          print("  5")

          if (!isRecordStarted) {
            print("  6")
            reject("RNAudioPlayerRecorder", "Error occured during initiating recorder", nil)
            return
          }

          print("  7")

          startRecorderTimer()

          print("  8")

          resolve(audioFileURL?.absoluteString)
 
          return
        }

        reject("RNAudioPlayerRecorder", "Error occured during initiating recorder", nil)
      } catch {
        reject("RNAudioPlayerRecorder", "Error occured during recording", nil)
      }
    }

    audioSession = AVAudioSession.sharedInstance()

    do {
      try audioSession.setCategory(.playAndRecord, mode: avMode, options: [AVAudioSession.CategoryOptions.defaultToSpeaker, AVAudioSession.CategoryOptions.allowBluetooth])
      try audioSession.setActive(true)

      audioSession.requestRecordPermission { granted in
        DispatchQueue.main.async {
          if granted {
            startRecording()
          } else {
            reject("RNAudioPlayerRecorder", "Record permission not granted", nil)
          }
        }
      }
    } catch {
      reject("RNAudioPlayerRecorder", "Failed to record", nil)
    }
  }

  @objc(stopRecorder:rejecter:)
  public func stopRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioRecorder == nil) {
      reject("RNAudioPlayerRecorder", "Failed to stop recorder. It is already nil.", nil)
      return
    }

    audioRecorder.stop()

    if (recordTimer != nil) {
      recordTimer!.invalidate()
      recordTimer = nil
    }

    resolve(audioFileURL?.absoluteString)
  }

  func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
    if !flag {
      print("Failed to stop recorder")
    }
  }

  /**********               Player               **********/

  func addPeriodicTimeObserver() {
    let timeScale = CMTimeScale(NSEC_PER_SEC)
    let time = CMTime(seconds: subscriptionDuration, preferredTimescale: timeScale)

    timeObserverToken = audioPlayer.addPeriodicTimeObserver(forInterval: time,
                                                            queue: .main) {_ in
      if (self.audioPlayer != nil) {
        self.sendEvent(withName: "rn-playback", body: [
          "isMuted": self.audioPlayer.isMuted,
          "currentPosition": self.audioPlayerItem.currentTime().seconds * 1000,
          "duration": self.audioPlayerItem.asset.duration.seconds * 1000,
        ])
      }
    }
  }

  func removePeriodicTimeObserver() {
    if let timeObserverToken = timeObserverToken {
      audioPlayer.removeTimeObserver(timeObserverToken)
      self.timeObserverToken = nil
    }
  }


  @objc(startPlayer:httpHeaders:playbackVolume:resolver:rejecter:)
  public func startPlayer(
    path: String,
    httpHeaders: [String: String],
    playbackVolume: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    audioSession = AVAudioSession.sharedInstance()

    do {
      try audioSession.setCategory(.playAndRecord, mode: .default, options: [AVAudioSession.CategoryOptions.defaultToSpeaker, AVAudioSession.CategoryOptions.allowBluetooth])
      try audioSession.setActive(true)
    } catch {
      reject("RNAudioPlayerRecorder", "Failed to play", nil)
    }

    setAudioFileURL(path: path)
    audioPlayerAsset = AVURLAsset(url: audioFileURL!, options:["AVURLAssetHTTPHeaderFieldsKey": httpHeaders])
    audioPlayerItem = AVPlayerItem(asset: audioPlayerAsset!)

    if (audioPlayer == nil) {
      audioPlayer = AVPlayer(playerItem: audioPlayerItem)
    } else {
      audioPlayer.replaceCurrentItem(with: audioPlayerItem)
    }

    addPeriodicTimeObserver()
    audioPlayer.play()
    resolve(audioFileURL?.absoluteString)
  }

  @objc(stopPlayer:rejecter:)
  public func stopPlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioPlayer == nil) {
      return reject("RNAudioPlayerRecorder", "Player is already stopped.", nil)
    }

    audioPlayer.pause()
    self.removePeriodicTimeObserver()
    self.audioPlayer = nil;

    resolve(audioFileURL?.absoluteString)
  }

  @objc(pausePlayer:rejecter:)
  public func pausePlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioPlayer == nil) {
      return reject("RNAudioPlayerRecorder", "Player is not playing", nil)
    }

    audioPlayer.pause()
    resolve("Player paused!")
  }

  @objc(resumePlayer:rejecter:)
  public func resumePlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioPlayer == nil) {
      return reject("RNAudioPlayerRecorder", "Player is null", nil)
    }

    audioPlayer.play()
    resolve("Resumed!")
  }

  @objc(seekToPlayer:resolve:rejecter:)
  public func seekToPlayer(
    time: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioPlayer == nil) {
        return reject("RNAudioPlayerRecorder", "Player is null", nil)
    }

    audioPlayer.seek(to: CMTime(seconds: time / 1000, preferredTimescale: CMTimeScale(NSEC_PER_SEC)))
    resolve("Resumed!")
  }

  @objc(setVolume:resolver:rejecter:)
  public func setVolume(
    volume: Float,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    audioPlayer.volume = volume
    resolve(volume)
  }

  // *******

  @objc(multiply:withB:withResolver:withRejecter:)
  func multiply(a: Float,
                b: Float,
                resolver resolve: RCTPromiseResolveBlock,
                rejecter reject: RCTPromiseRejectBlock) -> Void {
    resolve(a*b)
  }
}
