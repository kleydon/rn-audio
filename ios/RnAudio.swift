import Foundation
import AVFoundation


@objc(RnAudio)
class RnAudio: RCTEventEmitter, AVAudioRecorderDelegate {

  let TAG = "RnAudio"

  //Events passed from native -> js
  let EVENT_ID_REC_UPDATE = "RecUpdate"
  let EVENT_ID_PLAY_UPDATE = "PlayUpdate"
  let EVENT_ID_REC_STOP = "RecStop"
  let EVENT_ID_PLAY_STOP = "PlayStop"

  //Recording stop codes
  let REC_STOP_CODE_REQUESTED = "Requested" //Ever used, in iOS?
  let REC_STOP_CODE_MAX_DURATION_REACHED = "MaxDurationReached"
  let REC_STOP_CODE_ERROR = "Error"

  //Play stop codes
  let PLAY_STOP_CODE_REQUESTED = "Requested" //Ever used, in iOS?
  let PLAY_STOP_CODE_MAX_DURATION_REACHED = "MaxDurationReached"
  let PLAY_STOP_CODE_ERROR = "Error"
    
  //Event metadata keys 
  let KEY_IS_RECORDING = "isRecording"
  let KEY_IS_MUTED = "isMuted"
  let KEY_REC_METER_LEVEL = "recMeterLevel"
  let KEY_REC_STOP_CODE = "recStopCode"
  let KEY_PLAY_STOP_CODE = "playStopCode"
  let KEY_REC_ELAPSED_MS = "recElapsedMs"
  let KEY_PLAY_ELAPSED_MS = "playElapsedMs"
  let KEY_PLAY_DURATION_MS = "playDurationMs"

  //Recorder states
  let RECORDER_STATE_RECORDING = "Recording"
  let RECORDER_STATE_PAUSED = "Paused"
  let RECORDER_STATE_STOPPED = "Stopped"

  //Player states
  let PLAYER_STATE_PLAYING = "Playing"
  let PLAYER_STATE_PAUSED = "Paused"
  let PLAYER_STATE_STOPPED = "Stopped"

  //Default filename info
  let DEFAULT_FILENAME_PLACEHOLDER = "DEFAULT"
  let DEFAULT_FILENAME = "sound.m4a"

  let DEFAULT_MAX_REC_DURATION_SEC = 10.0
  let DEFAULT_SUBSCRIPTION_DURATION_SEC = 0.5


  //Misc. Keys - for event details, and resolved promise values
  //Cross-platform
  let audioFilePathKey = "audioFilePath"
  let recMeteringEnabledKey = "recMeteringEnabled"
  let maxRecDurationSecKey = "maxRecDurationSec"
  let sampleRateKey = "sampleRate"
  let numChannelsKey = "numChannels"
  let lpcmByteDepthKey = "lpcmByteDepth"
  //Apple specific
  let appleAVSampleRateKey = "appleAVSampleRate"
  let appleAVNumberOfChannelsKey = "appleAVNumberOfChannels"
  let appleAudioFormatIdKey = "appleAudioFormatId"
  let appleAVAudioSessionModeIdKey = "appleAVAudioSessionModeId"
  let appleAVEncoderAudioQualityIdKey = "appleAVEncoderAudioQualityId"
  //Apple LPCM/WAV-specific
  let appleAVLinearPCMBitDepthKey = "appleAVLinearPCMBitDepth"
  let appleAVLinearPCMIsBigEndianKey = "appleAVLinearPCMIsBigEndian"
  let appleAVLinearPCMIsFloatKeyIOSKey = "appleAVLinearPCMIsFloatKeyIOS"
  let appleAVLinearPCMIsNonInterleavedKey = "appleAVLinearPCMIsNonInterleaved"
  //Other
  let grantedOptionsKey = "grantedOptions"

  //File path/URL
  //NOTE: Set this with constructAudioFileURL()
  var audioFileURL: URL? = nil

  //Durations
  var subscriptionDurationSec: Double = 0.5 // Initialized in constructor
  var maxRecDurationSec: Double = 10.0  // Initialized in constructor

  // Recording-related
  var audioRecorder: AVAudioRecorder!
  var audioSession: AVAudioSession!
  var recordTimer: Timer?
  var recMeteringEnabled: Bool = false

  // Playback-related
  var audioPlayerAsset: AVURLAsset!
  var audioPlayerItem: AVPlayerItem!
  var audioPlayer: AVPlayer!
  var playTimer: Timer?
  var timeObserverToken: Any?


  override init() {
    super.init()
    self.subscriptionDurationSec = DEFAULT_SUBSCRIPTION_DURATION_SEC
    self.maxRecDurationSec = DEFAULT_MAX_REC_DURATION_SEC
  }
    
  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }


  override func supportedEvents() -> [String]! {
    return [ 
      EVENT_ID_REC_UPDATE,
      EVENT_ID_REC_STOP,
      EVENT_ID_PLAY_UPDATE,
      EVENT_ID_PLAY_STOP
    ]
  }


  @objc(setSubscriptionDuration:)
  func setSubscriptionDuration(durationSec: Double) -> Void {
    let funcName = TAG + ".setSubscriptionDuration()"
    print(funcName)
    self.subscriptionDurationSec = durationSec
  }


  func constructAudioFileURL(path: String?) -> URL {
    let funcName = TAG + ".constructAudioFileURL()"
    print(funcName)
    if (path != nil && 
        (path!.hasPrefix("http://") || 
         path!.hasPrefix("https://") || 
         path!.hasPrefix("file://") ||
         path!.hasPrefix("/") ||
         path!.hasPrefix("./") ||
         path!.hasPrefix("../"))) {
      return URL(string: path!)!
    }
      else if (path != nil && path != "" && path != DEFAULT_FILENAME_PLACEHOLDER) {
      let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      return cachesDirectory.appendingPathComponent(path!)
    }
    else { // Could do more to provide the right filename based on knowing
           // the encoding...
      let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      return cachesDirectory.appendingPathComponent(DEFAULT_FILENAME)
    }
  }


  // RECORDER

  func kAudioFormatNumberFromAudioFormatId(formatId:String?) -> Int {
    let funcName = TAG + ".kAudioFormatNumberFromAudioFormatId()"
    print(funcName)
    // (8/17/2022) According to https://developer.apple.com/documentation/avfaudio/avaudiorecorder/1388386-init
    // AVAudioRecorder.init(url: settings) only supports 
    //   kAudioFormatLinearPCM
    //   kAudioFormatMPEG4AAC
    //   kAudioFormatAppleLossless
    //   kAudioFormatAppleIMA4
    //   kAudioFormatiLBC
    //   kAudioFormatULaw
    switch formatId {
      case "lpcm":
        return Int(kAudioFormatLinearPCM)
      case "aac":
        return Int(kAudioFormatMPEG4AAC)
      case "mp4":      
        return Int(kAudioFormatMPEG4AAC)
      case "alac":      
        return Int(kAudioFormatAppleLossless)
      case "ilbc":
        return Int(kAudioFormatiLBC)
      case "ulaw":
        return Int(kAudioFormatULaw)
      //Possibly unsupported by AvAudioRecorder (8/17/2022):
      case "ima4":
        return Int(kAudioFormatAppleIMA4)
      case "MAC3":
        return Int(kAudioFormatMACE3)
      case "MAC6":
        return Int(kAudioFormatMACE6)
      case "alaw":
        return Int(kAudioFormatALaw)
      case "mp1":
        return Int(kAudioFormatMPEGLayer1)
      case "mp2":
        return Int(kAudioFormatMPEGLayer2)


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
    let funcName = TAG + ".avAudioSessionModeFromString()"
    print(funcName)
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

 
  func sendRecStopEvent(recStopCode:String) {
    sendEvent(withName: EVENT_ID_REC_STOP, body: [
      KEY_REC_STOP_CODE: recStopCode
    ] as [String : String])
  }
      
  func sendPlayStopEvent(playStopCode:String) {
    sendEvent(withName: EVENT_ID_PLAY_STOP, body: [
      KEY_PLAY_STOP_CODE: playStopCode
    ] as [String : String])
  }


  @objc(getRecorderState:rejecter:)
  func getRecorderState(resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {
    let funcName = TAG + ".getRecorderState()"
    print(funcName)
    if (audioRecorder != nil && audioRecorder.isRecording) {
      resolve(RECORDER_STATE_RECORDING)
    }
    else if (audioRecorder != nil && !audioRecorder.isRecording) {
      resolve(RECORDER_STATE_PAUSED)
    }
    else {
      resolve(RECORDER_STATE_STOPPED)
    }
  }


  @objc(startRecorder:resolve:reject:)
  func startRecorder(recordingOptions: [String: Any],
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {
    let funcName = TAG + ".startRecorder()"
    print(funcName)

    let ro = recordingOptions

    print("  Requested recordingOptions:", ro)
    print("    shared:")
    print("      audioFilePath: ", ro[audioFilePathKey] as Any)
    print("      recMeteringEnabled: ", ro[recMeteringEnabledKey] as Any)
    print("      maxRecDurationSec: ", ro[maxRecDurationSecKey] as Any)
    print("      sampleRate: ", ro[sampleRateKey] as Any)
    print("      numChannels: ", ro[numChannelsKey] as Any)
    print("      lpcmByteDepth: ", ro[lpcmByteDepthKey] as Any)
    print("    apple:")
    print("      mode: ", ro[appleAVAudioSessionModeIdKey] as Any)
    print("      format: ", ro[appleAudioFormatIdKey] as Any)
    print("      apple-compressed:")
    print("        quality: ", ro[appleAVEncoderAudioQualityIdKey] as Any)
    print("      apple-lpcm:")
    print("        lpcmIsBigEndian: ", ro[appleAVLinearPCMIsBigEndianKey] as Any)
    print("        lpcmIsFloatKey: ", ro[appleAVLinearPCMIsFloatKeyIOSKey] as Any)
    print("        lpcmIsNonInterleaved: ", ro[appleAVLinearPCMIsNonInterleavedKey] as Any)

    //Shared
    self.audioFileURL = constructAudioFileURL(path: ro[audioFilePathKey] as? String)
    self.recMeteringEnabled = (ro[recMeteringEnabledKey] as? Bool) ?? true
    self.maxRecDurationSec = (ro[maxRecDurationSecKey] as? Double) ?? DEFAULT_MAX_REC_DURATION_SEC
    let sampleRate = ro[sampleRateKey] as? Int ?? 44100
    let numChannels = ro[numChannelsKey] as? Int ?? 1
    //Apple-specific
    let mode = avAudioSessionModeFromString(modeStr: ro[appleAVAudioSessionModeIdKey] as? String)
    let format = kAudioFormatNumberFromAudioFormatId(formatId: ro[appleAudioFormatIdKey] as? String)
    //Apple compressed-audio specific
    let quality = ro[appleAVEncoderAudioQualityIdKey] as? Int ?? AVAudioQuality.medium.rawValue
    //Apple LPCM-specific
    let lpcmBitDepth = ((ro[lpcmByteDepthKey] as? Int) ?? 2) * 8  // Defaults to 2 bytes * 8 = 16 bits
    let lpcmIsBigEndian = ro[appleAVLinearPCMIsBigEndianKey] as? Bool ?? false  // Default for WAV; see: http://soundfile.sapp.org/doc/WaveFormat/
    let lpcmIsFloatKey = ro[appleAVLinearPCMIsFloatKeyIOSKey] as? Bool ?? false  // Default to signed integer values
    let lpcmIsNonInterleaved = ro[appleAVLinearPCMIsNonInterleavedKey] as? Bool ?? false //Default is that samples ARE interleaved; [ L,R; L,R; L,R... ]

    print("  COERCED recordingOptions:")
    print("    shared:")
    print("      audioFileUrl: ", audioFileURL!)
    print("      recMeteringEnabled: ", recMeteringEnabled)
    print("      maxRecDurationSec: ", maxRecDurationSec)
    print("      sampleRate: ", sampleRate)
    print("      numChannels: ", numChannels)
    print("    apple:")
    print("      mode: ", mode)
    print("      format: ", format)
    print("    apple-compressed:")
    print("      quality: ", quality)
    print("    apple-lpcm:")
    print("      lpcmBitDepth: ", lpcmBitDepth)
    print("      lpcmIsBigEndian: ", lpcmIsBigEndian)
    print("      lpcmIsFloatKey: ", lpcmIsFloatKey)
    print("      lpcmIsNonInterleaved: ", lpcmIsNonInterleaved)

    func startRecording() {
      print(funcName + ".startRecording()")
      
      //Begin with the "base" AVAudioRecorder requested settings
      var avAudioRecorderRequestedSettings = [
        AVFormatIDKey: format,
        AVSampleRateKey: sampleRate,
        AVNumberOfChannelsKey: numChannels,
      ] as [String: Any]

      //Merge in format-specific settings
      if (format == Int(kAudioFormatLinearPCM)) {
        //Merge in LPCM-specific settings
          avAudioRecorderRequestedSettings.merge([
            AVLinearPCMBitDepthKey: lpcmBitDepth,
            AVLinearPCMIsBigEndianKey: lpcmIsBigEndian,
            AVLinearPCMIsFloatKey: lpcmIsFloatKey,
            AVLinearPCMIsNonInterleaved: lpcmIsNonInterleaved
          ]){(current, _) in current}
      }
      else {
        //Merge in encoded/compressed settings
        avAudioRecorderRequestedSettings.merge([
          AVEncoderAudioQualityKey: quality
        ]){(current, _) in current}
      }
        
      print("  ")
      print("  ")
      print("  audioFileURL:", self.audioFileURL!)
      print("  ")
      print("  avAudioRecorderRequestedSettings:", avAudioRecorderRequestedSettings)
      print("  ")
      print("  ")
        
      do {
        audioRecorder = try AVAudioRecorder(url: self.audioFileURL!, 
                                settings: avAudioRecorderRequestedSettings)
        
        if (audioRecorder == nil) {
          sendRecStopEvent(recStopCode: REC_STOP_CODE_ERROR)
          return reject(TAG, "Error occured during initiating recorder", nil)
        }
  
        audioRecorder.prepareToRecord()
        audioRecorder.delegate = self
          
        audioRecorder.isMeteringEnabled = self.recMeteringEnabled

        //Begin set of granted recording options that will actually be used
        var grantedOptions = [
          //Cross-platform
          audioFilePathKey: self.audioFileURL!.absoluteString,
          recMeteringEnabledKey: self.recMeteringEnabled,
          maxRecDurationSecKey: self.maxRecDurationSec,
          sampleRateKey: audioRecorder.settings[AVSampleRateKey]!,
          numChannelsKey: audioRecorder.settings[AVNumberOfChannelsKey]!, 
          appleAudioFormatIdKey: audioRecorder.settings[AVFormatIDKey]!,
          appleAVAudioSessionModeIdKey: self.audioSession.mode
        ] as [String: Any]
        
        //Include apple-specific options granted by the hardware
        if (format == Int(kAudioFormatLinearPCM)) {
          //LPCM
          grantedOptions[appleAVLinearPCMBitDepthKey] = audioRecorder.settings[AVLinearPCMBitDepthKey]
          grantedOptions[lpcmByteDepthKey] =
             (audioRecorder.settings[AVLinearPCMBitDepthKey] as! Int) / 8
          grantedOptions[appleAVLinearPCMIsBigEndianKey] = audioRecorder.settings[AVLinearPCMIsBigEndianKey]
          grantedOptions[appleAVLinearPCMIsFloatKeyIOSKey] = audioRecorder.settings[AVLinearPCMIsFloatKey]
          grantedOptions[appleAVLinearPCMIsNonInterleavedKey] = audioRecorder.settings[AVLinearPCMIsNonInterleaved]
        }
        else { //Encoded/compressed
          //Include compressed settings
          grantedOptions[appleAVEncoderAudioQualityIdKey] = audioRecorder.settings[AVEncoderAudioQualityKey]
        }
        
        let isRecordStarted = audioRecorder.record()
        if (!isRecordStarted) {
          sendRecStopEvent(recStopCode: REC_STOP_CODE_ERROR)
          return reject(TAG, "Error calling audioRecorder.record()", nil)
        }

        startRecorderTimer()

        return resolve(grantedOptions)
      } 
      catch {
        sendRecStopEvent(recStopCode: REC_STOP_CODE_ERROR)
        return reject(TAG, "startRecording() - Error occured", nil)
      }
    }

    self.audioSession = AVAudioSession.sharedInstance()

    do {
      try self.audioSession.setCategory(.playAndRecord, mode: mode, options: [
        AVAudioSession.CategoryOptions.defaultToSpeaker
      ])
      try self.audioSession.setActive(true)

      self.audioSession.requestRecordPermission { granted in
        DispatchQueue.main.async {
          if granted {
            startRecording()
          } else {
            return reject(self.TAG, funcName + "Record permission not granted", nil)
          }
        }
      }
    } catch {
      return reject(TAG, funcName + "Failed to record", nil)
    }
  }


  @objc(pauseRecorder:rejecter:)
  public func pauseRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".pauseRecorder()"
    print(funcName)

    if (audioRecorder == nil) {
      return reject(TAG, funcName + "Can't pause recording; recorder is not recording", nil)
    }

    recordTimer?.invalidate()
    recordTimer = nil;

    audioRecorder.pause()

    return resolve(funcName + "Recording paused")
  }


  @objc(resumeRecorder:rejecter:)
  public func resumeRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".resumeRecorder()"
    print(funcName)

    if (audioRecorder == nil) {
      return reject(TAG, funcName + "Can't resume recording; recorder is not recording", nil)
    }

    audioRecorder.record()

    if (recordTimer == nil) {
      startRecorderTimer()
    }

    resolve(funcName + "Recording resumed")
  }


  @objc(stopRecorder:rejecter:)
  public func stopRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".stopRecorder()"
    print(funcName)
    
    if (audioRecorder == nil) {
      return resolve(funcName + "Recorder already stopped.")
    }

    let status = [
      KEY_REC_STOP_CODE: REC_STOP_CODE_REQUESTED,
      audioFilePathKey: self.audioFileURL!.absoluteString
    ] as [String : String];
    sendEvent(withName: EVENT_ID_REC_STOP, body: status)
      
    stopRecorder()
    
    return resolve(status)
  }
  func stopRecorder() { // requested: Not due to error or timeout
    let funcName = TAG + ".stopRecorder()"
    print(funcName)
    if (audioRecorder != nil) {
      audioRecorder.stop()
      audioRecorder = nil
    }
    if (recordTimer != nil) {
      recordTimer!.invalidate()
      recordTimer = nil
    }
  }


  @objc(startRecorderTimer)
  func startRecorderTimer() -> Void {
    let funcName = TAG + ".startRecorderTimer()"
    print(funcName)
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


  @objc func updateRecorderProgress(timer: Timer) -> Void {
    let funcName = TAG + ".updateRecorderProgress()"
    print(funcName)
    if (audioRecorder == nil) {
      return
    }
    var meterLevel: Float = 0
    if (self.recMeteringEnabled) {
      audioRecorder.updateMeters()
      meterLevel = audioRecorder.averagePower(forChannel: 0)
    }
    let status = [
      KEY_IS_RECORDING: audioRecorder.isRecording,
      KEY_REC_ELAPSED_MS: audioRecorder.currentTime * 1000,
      KEY_REC_METER_LEVEL: meterLevel,
    ] as [String : Any];
    sendEvent(withName: EVENT_ID_REC_UPDATE, body: status)
    if (audioRecorder.currentTime >= self.maxRecDurationSec) {
      let status = [ KEY_REC_STOP_CODE: REC_STOP_CODE_MAX_DURATION_REACHED ] as [String : String];
      sendEvent(withName: EVENT_ID_REC_STOP, body: status)
      stopRecorder()
    }
  }


  // PLAYER


  @objc(getPlayerState:rejecter:)
  func getPlayerState(resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {
    let funcName = TAG + ".getPlayerState()"
    print(funcName)
      if (audioPlayer != nil && audioPlayer.rate != 0) {
      resolve(PLAYER_STATE_PLAYING)
    }
      else if (audioPlayer != nil && audioPlayer.rate == 0.0) {
      resolve(PLAYER_STATE_PAUSED)
    }
    else {
      resolve(PLAYER_STATE_STOPPED)
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
    let funcName = TAG + ".startPlayer()"
    print(funcName)
    self.audioSession = AVAudioSession.sharedInstance()
    do {
      try self.audioSession.setCategory(
          .playAndRecord, 
          mode: .default,
          options: [
            AVAudioSession.CategoryOptions.defaultToSpeaker,
            AVAudioSession.CategoryOptions.allowBluetooth
          ])
      try self.audioSession.setActive(true)
    } 
    catch {
      sendPlayStopEvent(playStopCode: PLAY_STOP_CODE_ERROR)
      return reject(TAG, funcName + "Failed to play", nil)
    }
    self.audioFileURL = constructAudioFileURL(path: path)
    audioPlayerAsset = AVURLAsset(url: self.audioFileURL!, 
                              options: ["AVURLAssetHTTPHeaderFieldsKey": httpHeaders])
    audioPlayerItem = AVPlayerItem(asset: audioPlayerAsset!)
    if (audioPlayer == nil) {
      audioPlayer = AVPlayer(playerItem: audioPlayerItem)
    } 
    else {
      audioPlayer.replaceCurrentItem(with: audioPlayerItem)
    }

    setPlayerVolume(volume: playbackVolume)

    NotificationCenter.default.addObserver(
      self, 
      selector: #selector(self.audioPlayerDidFinishPlaying),
      name: NSNotification.Name.AVPlayerItemDidPlayToEndTime,
      object: nil
    )

    addPeriodicTimeObserver() 
    
    audioPlayer.play()
    
    let status = [ 
      audioFilePathKey: self.audioFileURL!.absoluteString
    ] as [String : String];
      
    return resolve(status)
  }

  @objc(pausePlayer:rejecter:)
  public func pausePlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".pausePlayer()"
    print(funcName)
    if (audioPlayer == nil) {
      return reject(TAG, funcName + "Can't pause playback; player is not playing", nil)
    }
    audioPlayer.pause()
    return resolve(funcName + "Playback paused")
  }


  @objc(resumePlayer:rejecter:)
  public func resumePlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".resumePlayer()"
    print(funcName)
    if (audioPlayer == nil) {
      return reject(TAG, funcName + "Can't resume playback; player is not playing", nil)
    }
    audioPlayer.play()
    return resolve(funcName + "Playback resumed")
  }


  @objc(stopPlayer:rejecter:)
  public func stopPlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".stopPlayer()"
    print(funcName)
    if (audioPlayer == nil) {
      return resolve(funcName + "Player is already stopped.")
    }
    audioPlayer.pause()
    self.removePeriodicTimeObserver()
    self.audioPlayer = nil;
    
    //Send stop event
    sendPlayStopEvent(playStopCode: PLAY_STOP_CODE_REQUESTED)
  
    return resolve([ 
      audioFilePathKey: self.audioFileURL!.absoluteString
    ] as [String : String])
  }


  @objc(seekToPlayer:resolve:rejecter:)
  public func seekToPlayer(
    time: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".seekToPlayer()"
    print(funcName)
    if (audioPlayer == nil) {
        return reject(TAG, funcName + "Player is not playing", nil)
    }
    audioPlayer.seek(to: CMTime(seconds: time / 1000, preferredTimescale: CMTimeScale(NSEC_PER_SEC)))
    return resolve(funcName + "Seek successful")
  }


  @objc(setPlayerVolume:resolver:rejecter:)
  public func setPlayerVolume(
    volume: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".setPlayerVolume()"
    print(funcName)
    if (volume < 0.0 || volume > 1.0) {
      return reject(TAG, funcName + " - Error: volume must be between [0.0 - 1.0] ", nil)
    }
    setPlayerVolume(volume: volume)
    return resolve(volume)
  }
  private func setPlayerVolume(volume:Double) {
    audioPlayer?.volume = Float(volume)
  }


  @objc func audioPlayerDidFinishPlaying(notification: NSNotification) {
    let funcName = TAG + ".audioPlayerDidFinishPlaying()"
    print(funcName)
    audioPlayer = nil
    sendPlayStopEvent(playStopCode: PLAY_STOP_CODE_MAX_DURATION_REACHED)
  }


  func addPeriodicTimeObserver() {
    let funcName = TAG + ".addPeriodicTimeObserver()"
    print(funcName)
    let timeScale = CMTimeScale(NSEC_PER_SEC)
    let time = CMTime(seconds: self.subscriptionDurationSec, preferredTimescale: timeScale)
    timeObserverToken = audioPlayer.addPeriodicTimeObserver(forInterval: time, queue: .main) {_ in
      if (self.audioPlayer != nil) {
        self.sendEvent(withName: self.EVENT_ID_PLAY_UPDATE, body: [
          self.KEY_IS_MUTED: self.audioPlayer.isMuted,
          self.KEY_PLAY_ELAPSED_MS: self.audioPlayerItem.currentTime().seconds * 1000,
          self.KEY_PLAY_DURATION_MS: self.audioPlayerItem.asset.duration.seconds * 1000,
        ])
      }
    }
  }


  func removePeriodicTimeObserver() {
    let funcName = TAG + ".removePeriodicTimeObserver()"
    print(funcName)
    if let timeObserverToken = timeObserverToken {
      audioPlayer.removeTimeObserver(timeObserverToken)
      self.timeObserverToken = nil
    }
  }

}
