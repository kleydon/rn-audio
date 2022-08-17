import Foundation
import AVFoundation


@objc(RnAudio)
class RnAudio: RCTEventEmitter, AVAudioRecorderDelegate {

  //Events passed from native -> js
  //let REC_UPDATE_EVENT_ID = "RecUpdate"
  //let PLAY_UPDATE_EVENT_ID = "PlayUpdate"
  //let REC_STOP_EVENT_ID = "RecStop"  // When recording stops, due to error or max duration reached
  enum Event {
    case RecUpdate
    case PlayUpdate
    case RecStop
    func name() { return self.rawValue }
  }

  //Event metadata keys
 
  // let IS_RECORDING_KEY = "isRecording"
    // let IS_MUTED_KEY = "isMuted"
  // let REC_METER_LEVEL_KEY = "recMeterLevel"
 // let REC_STOP_CODE_KEY = "recStopCode"
  // let REC_ELAPSED_MS_KEY = "recElapsedMs"
  // let PLAY_ELAPSED_MS_KEY = "playElapsedMs"
  // let PLAY_DURATION_MS_KEY = "playDurationMs"
  enum EventDetailKey {
    case isMuted
    case isRecording
    case recStopCode
    case recElapsedMs
    case recMeterLevel
    case playElapsedMs
    case playDurationMs
    func name() { return this.rawValue }
  }

  // let REC_STOP_CODE_MAX_DURATION_REACHED = "maxDurationReached"
  // let REC_STOP_CODE_ERROR = "error"
  enum RecStopCode {
    case UserRequest
    case MaxDurationReached
    case Error
    func name() { return this.rawValue }
  }

  
  let DEFAULT_FILENAME_PLACEHOLDER = "DEFAULT"
  let DEFAULT_FILENAME = "sound.m4a"

  let DEFAULT_MAX_REC_DURATION_SEC = 10.0

  //File path/URL
  //NOTE: Don't set directly; use setAudioFileURL()
  var audioFileURL: URL? = nil

  //Durations
  var subscriptionDurationSec: Double = 0.5  // Initialized in construct()
  var maxRecDurationSec: Double = 10.0  // Initialized in construct()

  // Recording-related
  var audioRecorder: AVAudioRecorder!
  var audioSession: AVAudioSession!
  var recordTimer: Timer?
  var recMeteringEnabled: Bool = false

  // Playback-related
  var pausedPlayTime: CMTime?
  var audioPlayerAsset: AVURLAsset!
  var audioPlayerItem: AVPlayerItem!
  var audioPlayer: AVPlayer!
  var playTimer: Timer?
  var timeObserverToken: Any?


  @objc
  func construct() {
    print("***IN CONSTRUCT***")
    self.subscriptionDurationSec = 0.1
    self.maxRecDurationSec = DEFAULT_MAX_REC_DURATION_SEC
  }


  override static func requiresMainQueueSetup() -> Bool {
    return true
  }


  override func supportedEvents() -> [String]! {
    return [ 
      Event.PlayUpdate.name(),
      Event.RecUpdate.name(),
      Event.RecStop.name()
    ]
  }


  @objc(setSubscriptionDuration:)
  func setSubscriptionDuration(durationSec: Double) -> Void {
    self.subscriptionDurationSec = durationSec
  }


  func setAudioFileURL(path: String?) {
    if (path == nil || path == "DEFAULT") {
      let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      self.audioFileURL = cachesDirectory.appendingPathComponent(DEFAULT_FILENAME)
    } 
    else if (path!.hasPrefix("http://") || path!.hasPrefix("https://") || path!.hasPrefix("file://")) {
      self.audioFileURL = URL(string: path!)
    } 
    else {
      let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      self.audioFileURL = cachesDirectory.appendingPathComponent(path!)
    }
  }


  // RECORDER

  func kAudioFormatNumberFromAudioFormatId(formatId:String?) -> Int {
    switch formatId {
      case "lpcm":
        return Int(kAudioFormatLinearPCM)
      case "ima4":
        return Int(kAudioFormatAppleIMA4)
      case "aac":
        return Int(kAudioFormatMPEG4AAC)
      case "MAC3":
        return Int(kAudioFormatMACE3)
      case "MAC6":
        return Int(kAudioFormatMACE6)
      case "ulaw":
        return Int(kAudioFormatULaw)
      case "alaw":
        return Int(kAudioFormatALaw)
      case "mp1":
        return Int(kAudioFormatMPEGLayer1)
      case "mp2":
        return Int(kAudioFormatMPEGLayer2)
      case "mp4":      
        return Int(kAudioFormatMPEG4AAC)
      case "alac":      
        return Int(kAudioFormatAppleLossless)
      case "amr":      
        return Int(kAudioFormatAMR) 
      case "opus":      
        return Int(kAudioFormatOpus)
      case "flac":
        if #available(iOS 11.0, *) {
          return Int(kAudioFormatFLAC)
        }
        fallthrough
      default:
        return Int(kAudioFormatAppleLossless)
    }
  }

  func avAudioSessionModeFromString(modeStr:String?) -> AVAudioSession.Mode {
    switch modeStr {
      case "measurement":
        return AVAudioSession.Mode.measurement
      case "gamechat":
        return AVAudioSession.Mode.gameChat
      case "movieplayback":
        return AVAudioSession.Mode.moviePlayback
      case "spokenaudio":
        return AVAudioSession.Mode.spokenAudio
      case "videochat":
        return AVAudioSession.Mode.videoChat
      case "videorecording":
        return AVAudioSession.Mode.videoRecording
      case "voicechat":
        return AVAudioSession.Mode.voiceChat
      case "voiceprompt":
        if #available(iOS 12.0, *) {
          return AVAudioSession.Mode.voicePrompt
        }
        fallthrough
      default:
        return AVAudioSession.Mode.default
    }
  }

  @objc(startRecorder:resolve:reject:)
  func startRecorder(recordingOptions: [String: Any],
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {

    print("startRecorder()")

    let ro = recordingOptions

    print("  RAW recordingOptions:", ro)
    print("    shared:")
    print("      audioFilePath: ", ro["audioFilePath"] as Any)
    print("      recMeteringEnabled: ", ro["recMeteringEnabled"] as Any)
    print("      maxRecDurationSec: ", ro["maxRecDurationSec"] as Any)
    print("    apple:")
    print("      mode: ", ro["appleAVAudioSessionModeId"] as Any)
    print("      format: ", ro["appleAudioFormatId"] as Any)
    print("      sampleRate: ", ro["appleAVSampleRate"] as Any)
    print("      numChannels: ", ro["appleAVNumberOfChannels"] as Any)
    print("      apple-compressed:")
    print("        quality: ", ro["appleAVEncoderAudioQualityId"] as Any)
    print("      apple-lpcm:")
    print("        lpcmBitDepth: ", ro["appleAVLinearPCMBitDepth"] as Any)
    print("        lpcmIsBigEndian: ", ro["appleAVLinearPCMIsBigEndian"] as Any)
    print("        lpcmIsFloatKey: ", ro["appleAVLinearPCMIsFloatKeyIOS"] as Any)
    print("        lpcmIsNonInterleaved: ", ro["appleAVLinearPCMIsNonInterleaved"] as Any)

    //Shared
    let audioFilePath = (ro["audioFilePath"] as? String) ?? DEFAULT_FILENAME_PLACEHOLDER
    let recMeteringEnabled = (ro["recMeteringEnabled"] as? Bool) ?? true
    let maxRecDurationSec = (ro["maxRecDurationSec"] as? Double) ?? DEFAULT_MAX_REC_DURATION_SEC

    //Apple-specific
    let mode = avAudioSessionModeFromString(modeStr: ro["appleAVAudioSessionModeId"] as? String)
    let format = kAudioFormatNumberFromAudioFormatId(formatId: ro["appleAudioFormatId"] as? String)
    let sampleRate = ro["appleAVSampleRate"] as? Int ?? 44100
    let numChannels = ro["appleAVNumberOfChannels"] as? Int ?? 1
    //Apple compressed-audio specific
    let quality = ro["appleAVEncoderAudioQualityId"] as? Int ?? AVAudioQuality.medium.rawValue
    //Apple LPCM-specific
    let lpcmBitDepth = ro["appleAVLinearPCMBitDepth"] as? Int ?? 16
    let lpcmIsBigEndian = ro["appleAVLinearPCMIsBigEndian"] as? Bool ?? true // **** DEFAULT??? ****
    let lpcmIsFloatKey = ro["appleAVLinearPCMIsFloatKeyIOS"] as? Bool ?? false
    let lpcmIsNonInterleaved = ro["appleAVLinearPCMIsNonInterleaved"] as? Bool ?? false // **** DEFAULT???? *****

    print("  COERCED recordingOptions:")
    print("    shared:")
    print("      audioFilePath: ", audioFilePath)
    print("      recMeteringEnabled: ", recMeteringEnabled)
    print("      maxRecDurationSec: ", maxRecDurationSec)
    print("    apple:")
    print("      mode: ", mode)
    print("      format: ", format)
    print("      sampleRate: ", sampleRate)
    print("      numChannels: ", numChannels)
    print("    apple-compressed:")
    print("      quality: ", quality)
    print("    apple-lpcm:")
    print("      lpcmBitDepth: ", lpcmBitDepth)
    print("      lpcmIsBigEndian: ", lpcmIsBigEndian)
    print("      lpcmIsFloatKey: ", lpcmIsFloatKey)
    print("      lpcmIsNonInterleaved: ", lpcmIsNonInterleaved)

    setAudioFileURL(path: audioFilePath)
    self.recMeteringEnabled = recMeteringEnabled
    self.maxRecDurationSec = maxRecDurationSec

    func sendStopCodeErrorEvent() {
      let status = [ EventDetailKey.RecStopCode.name(): RecStopCode.Error.name() ] as [String : String];
      sendEvent(withName: Event.RecStop.name(), body: status)
    }

    func startRecording() {
      
      print("startRecording()")
      
      //Begin with the "base" AVAudioRecorder settings
      var avAudioRecorderSettings = [
        AVFormatIDKey: format,
        AVSampleRateKey: sampleRate,
        AVNumberOfChannelsKey: numChannels,
      ] as [String: Any]

      //Merge in format-specific settings
      if (format == Int(kAudioFormatLinearPCM)) {
        //Merge in LPCM-specific settings
        avAudioRecorderSettings.merge([
          AVLinearPCMBitDepthKey: lpcmBitDepth,
          AVLinearPCMIsBigEndianKey: lpcmIsBigEndian,
          AVLinearPCMIsFloatKey: lpcmIsFloatKey,
          AVLinearPCMIsNonInterleaved: lpcmIsNonInterleaved
        ]){(current, _) in current}
      }
      else {
        //Merge in compressed settings
        avAudioRecorderSettings.merge([
        AVEncoderAudioQualityKey: quality
      ]){(current, _) in current}
      }

      print("  ")
      print("  ")
      print("  audioFileURL:", self.audioFileURL!)
      print("  ")
      print("  avAudioRecorderSettings:", avAudioRecorderSettings)
      print("  ")
      print("  ")

      do {
        audioRecorder = try AVAudioRecorder(url: self.audioFileURL!, settings: avAudioRecorderSettings)
        if (audioRecorder == nil) {
          sendStopCodeErrorEvent()
          reject("RnAudio", "Error occured during initiating recorder", nil)
          return 
        }
  
        audioRecorder.prepareToRecord()
        audioRecorder.delegate = self
        audioRecorder.isMeteringEnabled = self.recMeteringEnabled
        
        let isRecordStarted = audioRecorder.record()
        if (!isRecordStarted) {
          sendStopCodeErrorEvent()
          reject("RnAudio", "Error calling audioRecorder.record()", nil)
          return
        }

        startRecorderTimer()
        resolve(self.audioFileURL?.absoluteString)
        return

      } catch {
        sendStopCodeErrorEvent()
        reject("RnAudio", "startRecording() - Error occured", nil)
        return
      }
    }

    self.audioSession = AVAudioSession.sharedInstance()

    do {
      try self.audioSession.setCategory(.playAndRecord, mode: mode, options: [
        AVAudioSession.CategoryOptions.defaultToSpeaker, 
        AVAudioSession.CategoryOptions.allowBluetooth
      ])
      try self.audioSession.setActive(true)

      self.audioSession.requestRecordPermission { granted in
        DispatchQueue.main.async {
          if granted {
            startRecording()
          } else {
            reject("RnAudio", "Record permission not granted", nil)
          }
        }
      }
    } catch {
      reject("RnAudio", "Failed to record", nil)
    }
  }


  @objc(pauseRecorder:rejecter:)
  public func pauseRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioRecorder == nil) {
      return reject("RnAudio", "Recorder is not recording", nil)
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
      return reject("RnAudio", "Recorder is nil", nil)
    }

    audioRecorder.record()

    if (recordTimer == nil) {
      startRecorderTimer()
    }

    resolve("Recorder paused!")
  }


  @objc(stopRecorder:rejecter:)
  public func stopRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioRecorder == nil) {
      reject("RnAudio", "Failed to stop recorder. It is already nil.", nil)
      return
    }
    stopRecorderInner()
    resolve(self.audioFileURL?.absoluteString)
  }
  func stopRecorderInner() {
    if (audioRecorder == nil) {
      return
    }
    audioRecorder.stop()
    if (recordTimer != nil) {
      recordTimer!.invalidate()
      recordTimer = nil
    }
  }


  @objc(startRecorderTimer)
  func startRecorderTimer() -> Void {
    DispatchQueue.main.async {
      self.recordTimer = Timer.scheduledTimer(
        timeInterval: self.subscriptionDurationSec,
        target: self,
        selector: #selector(self.updateRecorderProgress),
        userInfo: nil,
        repeats: true
      )
    }
  }

  @objc(updateRecorderProgress:)
  public func updateRecorderProgress(timer: Timer) -> Void {
    if (audioRecorder == nil) {
      return
    }

    var meterLevel: Float = 0
    if (self.recMeteringEnabled) {
      audioRecorder.updateMeters()
      meterLevel = audioRecorder.averagePower(forChannel: 0)
    }

    let status = [
      EventDetailKey.IsRecording.name(): audioRecorder.isRecording,
      EventDetailKey.RecElapsedMs.name(): audioRecorder.currentTime * 1000,
      EventDetailKey.RecMeterLevel.name(): meterLevel,
    ] as [String : Any];

    sendEvent(withName: Event.RecUpdate.name(), body: status)

    if (audioRecorder.currentTime >= self.maxRecDurationSec) {
      
      print("STOPPING!")
      let status = [ EventDetailKey.RecStopCode.name(): REC_STOP_CODE_MAX_DURATION_REACHED ] as [String : String];
      sendEvent(withName: Event.RecStop.name(), body: status)
      
      stopRecorderInner()
    }
  }


  // ** IS THIS USED? **
  func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
    if !flag {
      print("Failed to stop recorder")
    }
    print("FINISHED RECORDING")
  }


  // PLAYER


  @objc(startPlayer:httpHeaders:playbackVolume:resolver:rejecter:)
  public func startPlayer(
    path: String,
    httpHeaders: [String: String],
    playbackVolume: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    self.audioSession = AVAudioSession.sharedInstance()

    do {
      try self.audioSession.setCategory(.playAndRecord, mode: .default, options: [AVAudioSession.CategoryOptions.defaultToSpeaker, AVAudioSession.CategoryOptions.allowBluetooth])
      try self.audioSession.setActive(true)
    } catch {
      reject("RnAudio", "Failed to play", nil)
    }

    setAudioFileURL(path: path)
    audioPlayerAsset = AVURLAsset(url: self.audioFileURL!, 
                              options: ["AVURLAssetHTTPHeaderFieldsKey": httpHeaders])
    audioPlayerItem = AVPlayerItem(asset: audioPlayerAsset!)

    if (audioPlayer == nil) {
      audioPlayer = AVPlayer(playerItem: audioPlayerItem)
    } 
    else {
      audioPlayer.replaceCurrentItem(with: audioPlayerItem)
    }

    addPeriodicTimeObserver()
    audioPlayer.play()

    resolve(self.audioFileURL?.absoluteString)
  }


  @objc(pausePlayer:rejecter:)
  public func pausePlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioPlayer == nil) {
      return reject("RnAudio", "Player is not playing", nil)
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
      return reject("RnAudio", "Player is not playing", nil)
    }

    audioPlayer.play()
    resolve("Playback resumed")
  }


  @objc(stopPlayer:rejecter:)
  public func stopPlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {

    if (audioPlayer == nil) {
      return reject("RnAudio", "Player is already stopped.", nil)
    }

    audioPlayer.pause()

    self.removePeriodicTimeObserver()
    
    self.audioPlayer = nil;

    resolve(self.audioFileURL?.absoluteString)
  }


  @objc(seekToPlayer:resolve:rejecter:)
  public func seekToPlayer(
    time: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    if (audioPlayer == nil) {
        return reject("RnAudio", "Player is not playing", nil)
    }

    audioPlayer.seek(to: CMTime(seconds: time / 1000, preferredTimescale: CMTimeScale(NSEC_PER_SEC)))
    
    resolve("Seek successful")
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


  @objc(audioPlayerDidFinishPlaying:)
  public static func audioPlayerDidFinishPlaying(player: AVAudioRecorder) -> Bool {
    return true
  }


  func addPeriodicTimeObserver() {
    let timeScale = CMTimeScale(NSEC_PER_SEC)
    let time = CMTime(seconds: self.subscriptionDurationSec, 
                      preferredTimescale: timeScale)

    timeObserverToken = audioPlayer.addPeriodicTimeObserver(forInterval: time,
                                                            queue: .main) {_ in
      if (self.audioPlayer != nil) {
          self.sendEvent(withName: self.Event.PlayUpdate.name(), body: [
            self.EventDetailKey.IsMuted.name(): self.audioPlayer.isMuted,
            self.EventDetailKey.PlayElapsedMs.name(): self.audioPlayerItem.currentTime().seconds * 1000,
            self.EventDetailKey.PlayDurationMs.name(): self.audioPlayerItem.asset.duration.seconds * 1000,
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

}
