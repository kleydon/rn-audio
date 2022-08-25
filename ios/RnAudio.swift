import Foundation
import AVFoundation


@objc(RnAudio)
class RnAudio: RCTEventEmitter, AVAudioRecorderDelegate {

  let TAG = "RnAudio"
    
  //Events passed from native -> js
  enum EventId : String {
    case RecUpdate
    case PlayUpdate
    case RecStop
    case PlayStop
  }

  //Recording stop codes
  enum RecStopCode : String {
    case Requested
    case MaxDurationReached
    case Error
  }

  //Playback stop codes
  enum PlayStopCode : String {
    case Requested
    case MaxDurationReached
    case Error
  }

  //Recorder states
  enum RecorderState : String {
    case Recording
    case Paused
    case Stopped
  }

  //Player states
  enum PlayerState : String {
    case Playing
    case Paused
    case Stopped
  }
    
  //Keys 
  enum Key : String {
    //Recording Option Keys
    //++++++++
    //Cross-platform
    case audioFileNameOrPath
    case recMeteringEnabled
    case maxRecDurationSec
    case sampleRate
    case numChannels
    case lpcmByteDepth
    case encoderBitRate
    //Apple specific
    case appleAudioFormatId
    case appleAVAudioSessionModeId
    case appleAVEncoderAudioQualityId
    //Apple LPCM/WAV-specific
    case appleAVLinearPCMBitDepth
    case appleAVLinearPCMIsBigEndian
    case appleAVLinearPCMIsFloatKeyIOS
    case appleAVLinearPCMIsNonInterleaved
    //-------- 
    //Other
    case grantedOptions
    //Event detail and play/rec stop code keys
    //++++++++
    case isMuted
    case isRecording
    case recStopCode
    case playStopCode
    case recElapsedMs
    case recMeterLevelDb
    case playElapsedMs
    case playDurationMs
    //-------- 
  }

  //Default filename info
  let DEFAULT_FILE_NAME_PLACEHOLDER = "DEFAULT"
  let DEFAULT_FILENAME = "sound.m4a"

  let DEFAULT_MAX_REC_DURATION_SEC = 10.0
  let DEFAULT_SUBSCRIPTION_DURATION_SEC = 0.5

  // Set this with resolveFilePathOrURL(). Can only be a URL when playing
  var _audioFilePathOrURL: URL? = nil

  //Durations
  var _subscriptionDurationSec: Double = 0.5 // Initialized in constructor
  var _maxRecDurationSec: Double = 10.0  // Initialized in constructor

  // Recording-related
  var _audioRecorder: AVAudioRecorder!
  var _audioSession: AVAudioSession!
  var _recordTimer: Timer?
  var _recMeteringEnabled: Bool = false

  // Playback-related
  var _audioPlayerAsset: AVURLAsset!
  var _audioPlayerItem: AVPlayerItem!
  var _audioPlayer: AVPlayer!
  var _timeObserverToken: Any?


  override init() {
    super.init()
    _subscriptionDurationSec = DEFAULT_SUBSCRIPTION_DURATION_SEC
    _maxRecDurationSec = DEFAULT_MAX_REC_DURATION_SEC
  }
    
  deinit {
    NotificationCenter.default.removeObserver(self)
  }


  override static func requiresMainQueueSetup() -> Bool {
    return false  // Which should it be, and why?
  }


  override func supportedEvents() -> [String]! {
    return [ 
      EventId.RecUpdate.rawValue,
      EventId.RecStop.rawValue,
      EventId.PlayUpdate.rawValue,
      EventId.PlayStop.rawValue
    ]
  }


  func createRecStopResult(recStopCode:RecStopCode) -> [String: Any] {
    return [
      Key.recStopCode.rawValue: recStopCode.rawValue,
      Key.audioFileNameOrPath.rawValue: _audioFilePathOrURL?.absoluteString ?? ""
    ] as [String : Any]
  }

  func sendRecStopEvent(recStopCode:RecStopCode) {
    sendEvent(withName: EventId.RecStop.rawValue, 
                  body: createRecStopResult(recStopCode: recStopCode))
  }

  func sendRecUpdateEvent(elapsedMs:Double, isRecording:Bool, meterLevelDb:Float) {
    sendEvent(withName: EventId.RecUpdate.rawValue, body: [
      Key.isRecording.rawValue: isRecording,
      Key.recElapsedMs.rawValue: elapsedMs,
      Key.recMeterLevelDb.rawValue: meterLevelDb
    ] as [String : Any])
  }

  func sendPlayUpdateEvent(elapsedMs:Double, durationMs:Double, isMuted:Bool) {
    sendEvent(withName: EventId.PlayUpdate.rawValue,
      body: [
        Key.isMuted.rawValue: isMuted,
        Key.playElapsedMs.rawValue: elapsedMs,
        Key.playDurationMs.rawValue: durationMs,
      ] as [String: Any]
    )
  }

  func createPlayStopResult(playStopCode:PlayStopCode) -> [String: Any] {
    return [
      Key.playStopCode.rawValue: playStopCode.rawValue,
      Key.audioFileNameOrPath.rawValue: _audioFilePathOrURL?.absoluteString ?? ""
    ] as [String : Any]
  }

  func sendPlayStopEvent(playStopCode:PlayStopCode) {
    sendEvent(withName: EventId.PlayStop.rawValue, 
                  body: createPlayStopResult(playStopCode:playStopCode))
  }

    
  @objc(setSubscriptionDuration:)
  func setSubscriptionDuration(durationSec: Double) -> Void {
    let funcName = TAG + ".setSubscriptionDuration()"
    print(funcName)
    _subscriptionDurationSec = durationSec
  }


  func resolveFilePathOrURL(rawFileNameOrPathOrURL: String?) -> URL {
    let funcName = TAG + ".resolveFilePathOrURL()"
    print(funcName)
    let v = rawFileNameOrPathOrURL
    if (v != nil && 
        (v!.hasPrefix("http://") || 
         v!.hasPrefix("https://") || 
         v!.hasPrefix("file://") ||
         v!.hasPrefix("/") ||
         v!.hasPrefix("./") ||
         v!.hasPrefix("../"))) {
      return URL(string: v!)!
    }
    else if (v != nil && v != "" && v != DEFAULT_FILE_NAME_PLACEHOLDER) {
      let cachesDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
      return cachesDirectory.appendingPathComponent(v!)
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


  @objc(getRecorderState:rejecter:)
  func getRecorderState(resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {
    let funcName = TAG + ".getRecorderState()"
    print(funcName)
    if (_audioRecorder != nil && _audioRecorder.isRecording) {
      resolve(RecorderState.Recording.rawValue)
    }
    else if (_audioRecorder != nil && !_audioRecorder.isRecording) {
      resolve(RecorderState.Paused.rawValue)
    }
    else {
      resolve(RecorderState.Stopped.rawValue)
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
    print("      audioFileNameOrPath: ", ro[Key.audioFileNameOrPath.rawValue] as Any)
    print("      recMeteringEnabled: ", ro[Key.recMeteringEnabled.rawValue] as Any)
    print("      maxRecDurationSec: ", ro[Key.maxRecDurationSec.rawValue] as Any)
    print("      sampleRate: ", ro[Key.sampleRate.rawValue] as Any)
    print("      numChannels: ", ro[Key.numChannels.rawValue] as Any)
    print("      lpcmByteDepth: ", ro[Key.lpcmByteDepth.rawValue] as Any)
    print("      encoderBitRate: ", ro[Key.encoderBitRate.rawValue] as Any)
    print("    apple:")
    print("      mode: ", ro[Key.appleAVAudioSessionModeId.rawValue] as Any)
    print("      format: ", ro[Key.appleAudioFormatId.rawValue] as Any)
    print("      apple-compressed:")
    print("        quality: ", ro[Key.appleAVEncoderAudioQualityId.rawValue] as Any)
    print("      apple-lpcm:")
    print("        lpcmIsBigEndian: ", ro[Key.appleAVLinearPCMIsBigEndian.rawValue] as Any)
    print("        lpcmIsFloatKey: ", ro[Key.appleAVLinearPCMIsFloatKeyIOS.rawValue] as Any)
    print("        lpcmIsNonInterleaved: ", ro[Key.appleAVLinearPCMIsNonInterleaved.rawValue] as Any)

    //Shared
    _audioFilePathOrURL = resolveFilePathOrURL(rawFileNameOrPathOrURL: ro[Key.audioFileNameOrPath.rawValue] as? String ?? DEFAULT_FILE_NAME_PLACEHOLDER)
    _recMeteringEnabled = (ro[Key.recMeteringEnabled.rawValue] as? Bool) ?? true
    _maxRecDurationSec = (ro[Key.maxRecDurationSec.rawValue] as? Double) ?? DEFAULT_MAX_REC_DURATION_SEC
    let sampleRate = ro[Key.sampleRate.rawValue] as? Int ?? 44100
    let numChannels = ro[Key.numChannels.rawValue] as? Int ?? 1
    let encoderBitRate = ro[Key.encoderBitRate.rawValue] as? Int ?? 128000
    //Apple-specific
    let mode = avAudioSessionModeFromString(modeStr: ro[Key.appleAVAudioSessionModeId.rawValue] as? String)
    let format = kAudioFormatNumberFromAudioFormatId(formatId: ro[Key.appleAudioFormatId.rawValue] as? String)
    //Apple compressed-audio specific
    let quality = ro[Key.appleAVEncoderAudioQualityId.rawValue] as? Int ?? AVAudioQuality.medium.rawValue
    //Apple LPCM-specific
    let lpcmBitDepth = ((ro[Key.lpcmByteDepth.rawValue] as? Int) ?? 2) * 8  // Defaults to 2 bytes * 8 = 16 bits
    let lpcmIsBigEndian = ro[Key.appleAVLinearPCMIsBigEndian.rawValue] as? Bool ?? false  // Default for WAV; see: http://soundfile.sapp.org/doc/WaveFormat/
    let lpcmIsFloatKey = ro[Key.appleAVLinearPCMIsFloatKeyIOS.rawValue] as? Bool ?? false  // Default to signed integer values
    let lpcmIsNonInterleaved = ro[Key.appleAVLinearPCMIsNonInterleaved.rawValue] as? Bool ?? false //Default is that samples ARE interleaved; [ L,R; L,R; L,R... ]

    print("  COERCED recordingOptions:")
    print("    shared:")
    print("      audioFilePathOrURL: ", _audioFilePathOrURL!)
    print("      _recMeteringEnabled: ", _recMeteringEnabled)
    print("      maxRecDurationSec: ", _maxRecDurationSec)
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
          AVEncoderAudioQualityKey: quality,
          AVEncoderBitRateKey: encoderBitRate
        ]){(current, _) in current}
      }
        
      print("  ")
      print("  ")
      print("  audioFilePathOrURL:", _audioFilePathOrURL!)
      print("  ")
      print("  avAudioRecorderRequestedSettings:", avAudioRecorderRequestedSettings)
      print("  ")
      print("  ")
      
      do {
        _audioRecorder = try AVAudioRecorder(url: _audioFilePathOrURL!, 
                                        settings: avAudioRecorderRequestedSettings)
        
        if (_audioRecorder == nil) {
          sendRecStopEvent(recStopCode: RecStopCode.Error)
          return reject(TAG, "Error occured during initiating recorder", nil)
        }
  
        _audioRecorder.prepareToRecord()
        _audioRecorder.delegate = self
          
        _audioRecorder.isMeteringEnabled = _recMeteringEnabled

        //Begin set of granted recording options that will actually be used
        var grantedOptions = [
          //Cross-platform
          Key.audioFileNameOrPath.rawValue: _audioFilePathOrURL!.absoluteString,
          Key.recMeteringEnabled.rawValue: _recMeteringEnabled,
          Key.maxRecDurationSec.rawValue: _maxRecDurationSec,
          Key.sampleRate.rawValue: _audioRecorder.settings[AVSampleRateKey]!,
          Key.numChannels.rawValue: _audioRecorder.settings[AVNumberOfChannelsKey]!, 
          Key.appleAudioFormatId.rawValue: _audioRecorder.settings[AVFormatIDKey]!,
          Key.appleAVAudioSessionModeId.rawValue: _audioSession.mode
        ] as [String: Any]
        
        //Include apple-specific options granted by the hardware
        if (format == Int(kAudioFormatLinearPCM)) {
          //LPCM
          grantedOptions[Key.appleAVLinearPCMBitDepth.rawValue] =
              _audioRecorder.settings[AVLinearPCMBitDepthKey]
          grantedOptions[Key.lpcmByteDepth.rawValue] =
              (_audioRecorder.settings[AVLinearPCMBitDepthKey] as! Int) / 8
          grantedOptions[Key.appleAVLinearPCMIsBigEndian.rawValue] =
              _audioRecorder.settings[AVLinearPCMIsBigEndianKey]
          grantedOptions[Key.appleAVLinearPCMIsFloatKeyIOS.rawValue] =
              _audioRecorder.settings[AVLinearPCMIsFloatKey]
          grantedOptions[Key.appleAVLinearPCMIsNonInterleaved.rawValue] = _audioRecorder.settings[AVLinearPCMIsNonInterleaved]
        }
        else { //Encoded/compressed
          //Include compressed settings
          grantedOptions[Key.appleAVEncoderAudioQualityId.rawValue] =
              _audioRecorder.settings[AVEncoderAudioQualityKey]
          grantedOptions[Key.encoderBitRate.rawValue] =
              _audioRecorder.settings[AVEncoderBitRateKey]
        }
        
        let isRecordStarted = _audioRecorder.record()
        if (!isRecordStarted) {
          sendRecStopEvent(recStopCode: RecStopCode.Error)
          return reject(TAG, "Error calling _audioRecorder.record()", nil)
        }

        startRecorderTimer()

        return resolve(grantedOptions)
      } 
      catch {
        sendRecStopEvent(recStopCode: RecStopCode.Error)
        return reject(TAG, "startRecording() - Error occured", nil)
      }
    }

    _audioSession = AVAudioSession.sharedInstance()

    do {
      try _audioSession.setCategory(.playAndRecord, mode: mode, options: [
        AVAudioSession.CategoryOptions.defaultToSpeaker
      ])
      try _audioSession.setActive(true)

      _audioSession.requestRecordPermission { granted in
        DispatchQueue.main.async {
          if granted {
            startRecording()
          } else {
            return reject(self.TAG, funcName + " Recording permission not granted", nil)
          }
        }
      }
    } catch {
      return reject(TAG, funcName + " Failed to record", nil)
    }
  }


  @objc(pauseRecorder:rejecter:)
  public func pauseRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".pauseRecorder()"
    print(funcName)

    if (_audioRecorder == nil) {
      return reject(TAG, funcName + " Can't pause recording; recorder is not recording", nil)
    }

    _recordTimer?.invalidate()
    _recordTimer = nil;

    _audioRecorder.pause()

    return resolve(funcName + " Recording paused")
  }


  @objc(resumeRecorder:rejecter:)
  public func resumeRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".resumeRecorder()"
    print(funcName)

    if (_audioRecorder == nil) {
      return reject(TAG, funcName + " Can't resume recording; recorder is not recording", nil)
    }

    _audioRecorder.record()

    if (_recordTimer == nil) {
      startRecorderTimer()
    }

    resolve(funcName + " Recording resumed")
  }


  @objc(stopRecorder:rejecter:)
  public func stopRecorder(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".stopRecorder()"
    print(funcName)
    
    if (_audioRecorder == nil) {
      return resolve(funcName + " Recorder already stopped.")
    }

    sendRecStopEvent(recStopCode: RecStopCode.Requested)
      
    stopRecorder()
    
    return resolve(createRecStopResult(recStopCode:RecStopCode.Requested))
  }
  func stopRecorder() { // requested: Not due to error or timeout
    let funcName = TAG + ".stopRecorder()"
    print(funcName)
    if (_audioRecorder != nil) {
      _audioRecorder.stop()
      _audioRecorder = nil
    }
    if (_recordTimer != nil) {
      _recordTimer!.invalidate()
      _recordTimer = nil
    }
  }


  @objc(startRecorderTimer)
  func startRecorderTimer() -> Void {
    let funcName = TAG + ".startRecorderTimer()"
    print(funcName)
    DispatchQueue.main.async {
      self._recordTimer = Timer.scheduledTimer(
        timeInterval: self._subscriptionDurationSec,
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
    if (_audioRecorder == nil) {
      return
    }
    //_audioRecorder is STILL not assumed to be non-nil below,
    //because I've encountered a situation where it WASN'T.
    //(Possibly due to asynchronous access? Not sure.)
    var meterLevelDb: Float = 0
    if (_recMeteringEnabled) {
      _audioRecorder?.updateMeters()
      meterLevelDb = _audioRecorder?.averagePower(forChannel: 0) ?? 0.0
    }

    sendRecUpdateEvent(elapsedMs: (_audioRecorder?.currentTime ?? 0) * 1000, 
                       isRecording: _audioRecorder?.isRecording ?? false,
                       meterLevelDb: meterLevelDb)

    if ((_audioRecorder?.currentTime ?? 0) >= _maxRecDurationSec) {
      sendRecStopEvent(recStopCode:RecStopCode.MaxDurationReached)
      stopRecorder()
    }
  }


  // PLAYER


  @objc(getPlayerState:rejecter:)
  func getPlayerState(resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {
    let funcName = TAG + ".getPlayerState()"
    print(funcName)
      if (_audioPlayer != nil && _audioPlayer.rate != 0) {
      resolve(PlayerState.Playing.rawValue)
    }
      else if (_audioPlayer != nil && _audioPlayer.rate == 0.0) {
      resolve(PlayerState.Paused.rawValue)
    }
    else {
      resolve(PlayerState.Stopped.rawValue)
    }
  }


  @objc(startPlayer:httpHeaders:playbackVolume:resolver:rejecter:)
  public func startPlayer(
    fileNameOrPathOrURL: String,
    httpHeaders: [String: String],
    playbackVolume: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".startPlayer()"
    print(funcName)
    _audioSession = AVAudioSession.sharedInstance()
    do {
      try _audioSession.setCategory(
          .playAndRecord, 
          mode: .default,
          options: [
            AVAudioSession.CategoryOptions.defaultToSpeaker,
            AVAudioSession.CategoryOptions.allowBluetooth
          ])
      try _audioSession.setActive(true)
    } 
    catch {
      sendPlayStopEvent(playStopCode: PlayStopCode.Error)
      return reject(TAG, funcName + " Failed to play", nil)
    }
    _audioFilePathOrURL = resolveFilePathOrURL(rawFileNameOrPathOrURL: fileNameOrPathOrURL)
    _audioPlayerAsset = AVURLAsset(url: _audioFilePathOrURL!, 
                                  options: ["AVURLAssetHTTPHeaderFieldsKey": httpHeaders])
    _audioPlayerItem = AVPlayerItem(asset: _audioPlayerAsset!)

    if (_audioPlayer == nil) {
      _audioPlayer = AVPlayer(playerItem: _audioPlayerItem)
    } 
    else {
      _audioPlayer.replaceCurrentItem(with: _audioPlayerItem)
    }

    setPlayerVolume(volume: playbackVolume)

    //Finished playing observer
    NotificationCenter.default.addObserver(
      self, 
      selector: #selector(self.audioPlayerDidFinishPlaying),
      name: NSNotification.Name.AVPlayerItemDidPlayToEndTime,
      object: nil
    )

    //Abort observers
    NotificationCenter.default.addObserver(
      self, 
      selector: #selector(self.abort),
      name: NSNotification.Name.AVPlayerItemFailedToPlayToEndTime,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self, 
      selector: #selector(self.abort),
      name: NSNotification.Name.AVPlayerItemPlaybackStalled,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self, 
      selector: #selector(self.abort),
      name: NSNotification.Name.AVPlayerItemNewErrorLogEntry,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(self.abort),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(self.abort),
      name: UIApplication.didEnterBackgroundNotification,
      object: nil
    )


    addPeriodicTimeObserver() 
    
    _audioPlayer.play()
      
    return resolve([
      Key.audioFileNameOrPath.rawValue: _audioFilePathOrURL!.absoluteString
    ] as [String : String])
  }

  @objc(pausePlayer:rejecter:)
  public func pausePlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".pausePlayer()"
    print(funcName)
    if (_audioPlayer == nil) {
      return reject(TAG, funcName + " Can't pause playback; player is not playing", nil)
    }
    _audioPlayer.pause()
    return resolve(funcName + " Playback paused")
  }


  @objc(resumePlayer:rejecter:)
  public func resumePlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".resumePlayer()"
    print(funcName)
    if (_audioPlayer == nil) {
      return reject(TAG, funcName + " Can't resume playback; player is not playing", nil)
    }
    _audioPlayer.play()
    return resolve(funcName + " Playback resumed")
  }


  @objc(stopPlayer:rejecter:)
  public func stopPlayer(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".stopPlayer()"
    print(funcName)
    if (_audioPlayer == nil) {
      return resolve(funcName + " Player is already stopped.")
    }
    _audioPlayer.pause()
    self.removePeriodicTimeObserver()
    self._audioPlayer = nil;
    
    //Send stop event
    sendPlayStopEvent(playStopCode:PlayStopCode.Requested)
  
    return resolve(createPlayStopResult(playStopCode:PlayStopCode.Requested))
  }


  @objc(seekToPlayer:resolve:rejecter:)
  public func seekToPlayer(
    time: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) -> Void {
    let funcName = TAG + ".seekToPlayer()"
    print(funcName)
    if (_audioPlayer == nil) {
        return reject(TAG, funcName + " Player is not playing", nil)
    }
    _audioPlayer.seek(to: CMTime(seconds: time / 1000, preferredTimescale: CMTimeScale(NSEC_PER_SEC)))
    return resolve(funcName + " Seek successful")
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
    _audioPlayer?.volume = Float(volume)
  }

    

  @objc func abort(notification: NSNotification) {
    let funcName = TAG + ".abort()"
    print(funcName)
    print("  Notification: ", notification)
    if (_audioPlayer != nil) {
      removePeriodicTimeObserver()
      _audioPlayer = nil
      sendPlayStopEvent(playStopCode:PlayStopCode.Error)
    }
    if (_audioRecorder != nil) {
      _audioRecorder = nil
      sendRecStopEvent(recStopCode:RecStopCode.Error)
    }
  }


  @objc func audioPlayerDidFinishPlaying(notification: NSNotification) {
    let funcName = TAG + ".audioPlayerDidFinishPlaying()"
    print(funcName)
    removePeriodicTimeObserver()
    _audioPlayer = nil
    sendPlayStopEvent(playStopCode:PlayStopCode.MaxDurationReached)
  }


  func addPeriodicTimeObserver() {
    let funcName = TAG + ".addPeriodicTimeObserver()"
    print(funcName)
    let timeScale = CMTimeScale(NSEC_PER_SEC)
    let time = CMTime(seconds: _subscriptionDurationSec, preferredTimescale: timeScale)
    _timeObserverToken = _audioPlayer.addPeriodicTimeObserver(forInterval: time, queue: .main) {_ in
      if (self._audioPlayer != nil) {
        self.sendPlayUpdateEvent(elapsedMs: (self._audioPlayerItem?.currentTime().seconds ?? 0) * 1000,
                                 durationMs: (self._audioPlayerItem?.asset.duration.seconds ?? 1) * 1000,
                                 isMuted: self._audioPlayer?.isMuted ?? false)
      }
    }
  }


  func removePeriodicTimeObserver() {
    let funcName = TAG + ".removePeriodicTimeObserver()"
    print(funcName)
    if let timeObserverToken = _timeObserverToken {
      _audioPlayer.removeTimeObserver(timeObserverToken)
      _timeObserverToken = nil
    }
  }

}
