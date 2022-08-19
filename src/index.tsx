import {
  DeviceEventEmitter,
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native'

import to from 'await-to-js'

const LINKING_ERROR =
  `The package 'rn-audio' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo managed workflow\n';

const RnAudio = NativeModules.RnAudio ? NativeModules.RnAudio : new Proxy(
    {},
    {
      get() {
        throw new Error(LINKING_ERROR);
      },
    }
  );

export enum AndroidAudioSourceId {
  DEFAULT = 0,
  MIC,
  VOICE_UPLINK,
  VOICE_DOWNLINK,
  VOICE_CALL,
  CAMCORDER,
  VOICE_RECOGNITION,
  VOICE_COMMUNICATION,
  REMOTE_SUBMIX,
  UNPROCESSED,
  VOICE_PERFORMANCE, //Added in API 29
  RADIO_TUNER = 1998,
  HOTWORD,
}

export enum AndroidOutputFormatId {
  DEFAULT = 0,
  THREE_GPP,
  MPEG_4,
  AMR_NB,
  AMR_WB,
  AAC_ADIF,
  AAC_ADTS,
  OUTPUT_FORMAT_RTP_AVP,
  MPEG_2_TS,
  WEBM,
  // Android doesn't actually offer WAV via MediaRecorder / OutputFormat.
  // We're shoe-horning this in here, and recording to WAV via AudioRecord
  WAV = 999           
}

export enum AndroidAudioEncoderId {
  DEFAULT = 0,
  AMR_NB,
  AMR_WB,
  AAC,
  HE_AAC,
  AAC_ELD,
  VORBIS,
  // Android doesn't actually offer linear PCM via MediaRecorder.AudioEncoder.
  // We're shoe-horning this in here, and recording to WAV via AudioRecord
  LPCM = 999         
}

export enum ByteDepthId {
  ONE = 1,
  TWO = 2
}

export enum NumberOfChannelsId {
  ONE = 1,
  TWO = 2
}

export enum AppleAudioFormatId {
  // See: https://stackoverflow.com/questions/6867994/what-are-the-formats-supported-in-avaudiorecorder-for-recording-sound
  // (8/17/2022) According to https://developer.apple.com/documentation/avfaudio/avaudiorecorder/1388386-init
  // AVAudioRecorder.init(url: settings) only supports 
  //   kAudioFormatLinearPCM
  //   kAudioFormatMPEG4AAC
  //   kAudioFormatAppleLossless
  //   kAudioFormatAppleIMA4
  //   kAudioFormatiLBC
  //   kAudioFormatULaw
  lpcm = 'lpcm',  // kAudioFormatLinearPCM
  aac = 'aac',    // kAudioFormatMPEG4AAC
  mp4 = 'mp4',    // kAudioFormatMPEG4AAC
  alac = 'alac',  // kAudioFormatAppleLossless
  ilbc = 'ilbc',   // kAudioFormatiLBC
  ulaw = 'ulaw',  // kAudioFormatULaw
  //Possibly unsupported by AvAudioRecorder (8/17/2022):
  ima4 = 'ima4',  // kAudioFormatAppleIMA4
  MAC3 = 'MAC3',  // kAudioFormatMACE3
  MAC6 = 'MAC6',  // kAudioFormatMACE6
  alaw = 'alaw',  // kAudioFormatALaw
  mp1 = 'mp1',    // kAudioFormatMPEGLayer1
  mp2 = 'mp2',    // kAudioFormatMPEGLayer2
  amr = 'amr',    // kAudioFormatAMR
  flac = 'flac',  // kAudioFormatFLAC
  opus = 'opus',  // kAudioFormatOpus
}

export enum AppleAVAudioSessionModeId {
  gamechat = 'gamechat',
  measurement = 'measurement',
  movieplayback = 'movieplayback',
  spokenaudio = 'spokenaudio',
  videochat = 'videochat',
  videorecording = 'videorecording',
  voicechat = 'voicechat',
  voiceprompt = 'voiceprompt',
}

export enum AppleAVEncoderAudioQualityId {
  min = 0,
  low = 32,
  medium = 64,
  high = 96,
  max = 127,
}

export enum AppleAVLinearPCMBitDepthId {
  bit8 = 8,
  bit16 = 16,
  bit24 = 24,
  bit32 = 32,
}

export interface RecordingOptions {
  
  audioFilePath?: string,
  recMeteringEnabled?: boolean,
  maxRecDurationSec?: number,
  sampleRate?: number,
  numChannels?: NumberOfChannelsId,
  lpcmByteDepth?: ByteDepthId,
  
  //Apple-specific
  appleAudioFormatId?: AppleAudioFormatId,
  appleAVAudioSessionModeId?: AppleAVAudioSessionModeId,
  //Apple encoded/compressed-specific
  appleAVEncoderBitRate?: number,
  appleAVEncoderAudioQualityId?: AppleAVEncoderAudioQualityId,
  //Apple LPCM/WAV-specific
  appleAVLinearPCMIsBigEndian?: boolean,
  appleAVLinearPCMIsFloatKeyIOS?: boolean,
  appleAVLinearPCMIsNonInterleaved?: boolean,

  //Android-specific
  androidAudioSourceId?: AndroidAudioSourceId,
  androidOutputFormatId?: AndroidOutputFormatId,
  androidAudioEncoderId?: AndroidAudioEncoderId,
  //Android encoded/compressed-specific
  androidAudioEncodingBitRate?: number
}

enum EventId {
  RecUpdate = "RecUpdate",
  PlayUpdate = "PlayUpdate",
  RecStop = "RecStop"
}

enum RecStopCode {
  Requested = "Requested",  // By user or app; not due to error or timeout
  MaxDurationReached = "MaxDurationReached",
  Error = "Error",
}

export type RecStopMetadata = {
  audioFilePath?: string,
  recStopCode: RecStopCode,
}

export type RecUpdateMetadata = {
  isRecording: boolean,
  recElapsedMs: number,
  recMeterLevel?: number,
}

export type PlayUpdateMetadata = {
  isMuted: boolean,
  playElapsedMs: number,
  playDurationMs: number,
}

interface StartPlayerArgs {
  uri?: string,
  httpHeaders?: Record<string, string>,
  playUpdateCallback?: (playUpdateMetadata: PlayUpdateMetadata) => void
  playVolume?: number 
}

interface StartRecorderArgs {
  recordingOptions: RecordingOptions,
  recUpdateCallback?: ((recUpdateMetadata: RecUpdateMetadata) => void) | null
  recStopCallback?: ((recStopMetadata: RecStopMetadata) => void) | null
}

const ilog = console.log
// @ts-ignore
const wlog = console.warn
// @ts-ignore
const elog = console.error

const pad = (num: number): string => {
  return ('0' + num).slice(-2)
}

export class Audio {

  private _recordFilePath: string | undefined
  private _isRecording: boolean
  private _isPlaying: boolean
  private _hasPaused: boolean
  private _hasPausedRecord: boolean
  private _recUpdateSubscription: EmitterSubscription | null
  private _playUpdateScription: EmitterSubscription | null
  private _recStopSubscription: EmitterSubscription | null
  private _playUpdateCallback: ((playUpdateMetadata: PlayUpdateMetadata) => void) | null

  constructor() {
    this._recordFilePath = undefined
    this._isRecording = false
    this._isPlaying = false
    this._hasPaused = false
    this._hasPausedRecord = false
    this._recUpdateSubscription = null
    this._playUpdateScription = null
    this._recStopSubscription = null
    this._playUpdateCallback = null
  }

  recordingOptionsLooselyValidate = (recordingOptions:RecordingOptions): boolean => {

    ilog('index.recordingOptionsLooselyValidate()')

    // Re: Android, see: https://developer.android.com/guide/topics/media/media-formats
    
    const o = recordingOptions
    const lcFilePath = o.audioFilePath?.toLowerCase()

    ilog('(Loosely) validating recording options...')

    let res = true;  // Default to valid

    //Allow fully-default set of options
    if (recordingOptions === {}) {
      return res;
    }

    //If number of channels > 2
    if (o.numChannels && o.numChannels > 2) {
      elog('Number of channels must be < 2.')
      res = false
    }
    
    //If filename ends with '.wav', and format/encoding/sampling rate don't match
    if (lcFilePath?.endsWith('.wav')) {
      const fileIsWavPrefixStr = 'File is .wav, but '
      if (o.androidOutputFormatId !== AndroidOutputFormatId.WAV) {
        res = false
        elog(fileIsWavPrefixStr + 'androidOutputFormatId is:' + o.androidOutputFormatId)
      }
      if (o.androidAudioEncoderId !== AndroidAudioEncoderId.LPCM) {
        res = false
        elog(fileIsWavPrefixStr + 'androidAudioEncoderId is:' + o.androidAudioEncoderId)
      }
      if (o.lpcmByteDepth && 
          (o.lpcmByteDepth === 1 || o.lpcmByteDepth === 2) === false) {
        res = false
        elog(fileIsWavPrefixStr + 'wavByteDepth is:' + o.lpcmByteDepth)
      }
      if (o.appleAudioFormatId !== AppleAudioFormatId.lpcm) {
        res = false
        elog(fileIsWavPrefixStr + 'appleAudioFormatId is:' + o.appleAudioFormatId)
      }
    } 
   
    //If filePath exists, DOESNT ends with .wav, and format or encoding ARE for wav...
    if ((lcFilePath && lcFilePath!.endsWith('wav')) === false) {
      const fileIsntWavPrefixStr = 'File isn\'t .wav, but '
      if (o.androidOutputFormatId === AndroidOutputFormatId.WAV) {
        res = false
        elog(fileIsntWavPrefixStr + 'androidOutputFormatId is:' + o.androidOutputFormatId)
      }
      if (o.androidAudioEncoderId === AndroidAudioEncoderId.LPCM) {
        res = false
        elog(fileIsntWavPrefixStr + 'androidAudioEncoderId is:' + o.androidAudioEncoderId)
      }
    }

    return res
  }

  isWavAndAndroid = (path:string|undefined):boolean => {
    ilog('index.isWavAndAndroid()')
    return (
      Platform.OS === 'android' && 
      typeof(path)!== 'undefined' &&
      path.toLowerCase().endsWith('.wav')
    )
  }

  mmss = (secs: number): string => {
    let minutes = Math.floor(secs / 60)
    secs = secs % 60
    minutes = minutes % 60
    return pad(minutes) + ':' + pad(secs)
  }

  mmssss = (ms: number): string => {
    const secs = Math.floor(ms / 1000)
    const minutes = Math.floor(secs / 60)
    const seconds = secs % 60
    const miliseconds = Math.floor((ms % 1000) / 10)
    return pad(minutes) + ':' + pad(seconds) + ':' + pad(miliseconds)
  }

  /**
   * Set listener from native module for recorder.
   * @param { (recUpdateMetadata: RecUpdateMetadata) => void } callback parameter
   * @returns { void }
  */
  private addRecUpdateCallback = (
    callback: (recUpdateMetadata: RecUpdateMetadata) => void,
  ): void => {
    ilog('index.addRecUpdateCallback()')
    if (Platform.OS === 'android') {
      this._recUpdateSubscription = DeviceEventEmitter.addListener(
        EventId.RecUpdate,
        callback,
      )
    } else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._recUpdateSubscription = myModuleEvt.addListener(
        EventId.RecUpdate,
        callback,
      )
    }
  }

  /**
   * Remove listener for recorder.
   * @returns {void}
   */
  private removeRecUpdateCallback = (): void => {
    ilog('index.removeRecUpdateCallback()')
    if (this._recUpdateSubscription) {
      this._recUpdateSubscription.remove()
      this._recUpdateSubscription = null
    }
  }

  /**
   * Set listener from native module for recording stoppage events.
   * @param { (recStopEventMetadata: RecStopMetadata) => void } callback parameter. 
   * @returns { void }
   */
   private addRecStopCallback = (
    callback: ((recStopMetadata: RecStopMetadata) => void) | null,
  ): void => {
    ilog('index.addRecStopCallback()')

    const augmentedCallback = (recStopMetadata: RecStopMetadata) => {
      this.removeRecUpdateCallback()
      this.removeRecStopCallback()
      this._isRecording = false
      this._hasPausedRecord = false
      if (callback) {
        callback(recStopMetadata)
      }
    }

    if (Platform.OS === 'android') {
      this._recStopSubscription = DeviceEventEmitter.addListener(
        EventId.RecStop, augmentedCallback,
      )
    } 
    else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._recStopSubscription = myModuleEvt.addListener(
        EventId.RecStop, augmentedCallback,
      )
    }
  }

  /**
   * Remove listener for recording stoppage events
   * @returns {void}
   */
  private removeRecStopCallback = (): void => {
    ilog('index.removeRecStopCallback()')
    if (this._recStopSubscription) {
      this._recStopSubscription.remove()
      this._recStopSubscription = null
    }
  }

  /**
   * Set listener from native module for player.
   * @param {(playbackMetadata: PlayUpdateMetadata) => void} callback - Callback parameter
   * @returns {void}
   */
  private addPlayUpdateCallback = (
    callback: (playUpdateMetadata: PlayUpdateMetadata) => void,
  ): void => {
    ilog('index.addPlayUpdateCallback()')
    this._playUpdateCallback = callback
  }

  /**
   * remove listener for player.
   * @returns {void}
   */
  private removePlayUpdateCallback = (): void => {
    ilog('index.removePlayUpdateCallback()') 
    this._playUpdateCallback = null
  }

  /**
   * Returns recording state
   * @returns {Promise<boolean>}
   */
  isRecording = async (): Promise<boolean> => {
    ilog('index.isRecording()') 
    return this._isRecording
  }

  private abortRecording = async () => {
    ilog('index.abortRecording()') 
    if (this.isWavAndAndroid(this._recordFilePath)) {
      ilog('Aborting wav recording')
      await this.stopAndroidWavRecorder() 
    }
    else {
      ilog('Aborting recording')
      await this.stopRecorder()  
    }
    this._isRecording = false
    this._hasPausedRecord = false  
    this.removeRecUpdateCallback()
    this.removeRecStopCallback()
  }

  /**
   * Start recording
   * @param {StartRecorderArgs} startRecorderArgs param.
   * @returns {Promise<string>}
   */
  startRecorder = async ({
    recordingOptions,
    recUpdateCallback,
    recStopCallback = null
  }:StartRecorderArgs): Promise<object|string> => {
    ilog('index.startRecorder()')

    if (this.recordingOptionsLooselyValidate(recordingOptions) == false) {
      return Promise.reject('Recording options don\'t validate.')
    }

    this._recordFilePath = recordingOptions.audioFilePath

    if (this.isWavAndAndroid(this._recordFilePath)) {
      const [err, res] = await to<object|string>(this.startAndroidWavRecorder({
        recordingOptions,
        recUpdateCallback,
        recStopCallback 
      }))
      if (err) {
        const errStr = 'index.startAndroidWavRecorder() from index.startRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.startRecorder() - Result: ', res)
      return res
    }

    //Not wav && android

    if (!this._isRecording) {
      this._isRecording = true
      this._hasPausedRecord = false
      if (recUpdateCallback) {
        this.addRecUpdateCallback(recUpdateCallback)
      }
      this.addRecStopCallback(recStopCallback) //MUST call - even recStopCallback is null
      const [err, res] = await to<string>(RnAudio.startRecorder(recordingOptions))
      if (err) {
        const errStr = 'index.startRecorder() - Error: ' + err
        elog(errStr)
        await this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.startRecorder() - Result: ', res)
      return res
    }

    return 'index.startRecorder() - Already recording.'
  }

  /**
   * Pause recording.
   * @returns {Promise<string>}
   */
  pauseRecorder = async (): Promise<string> => {
    ilog('index.pauseRecorder()')

    if (this.isWavAndAndroid(this._recordFilePath)) {
      const [err, res] = await to<string>(this.pauseAndroidWavRecorder())
      if (err) {
        const errStr = 'index.pauseAndroidWavRecorder() from index.pauseRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog(res)
      ilog('index.pauseRecorder() - Result: ', res)
      return res
    }

    //Not wav && android

    if (this._isRecording && !this._hasPausedRecord) {
      this._hasPausedRecord = true
      const [err, res] = await to<string>(RnAudio.pauseRecorder())
      if (err) {
        const errStr = 'index.pauseRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.pauseRecorder() - Result: ', res)
      return res
    }

    return 'index.pauseRecorder() - ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Already paused.')
  }

  /**
   * Resume recording.
   * @returns {Promise<string>}
   */
  resumeRecorder = async (): Promise<string> => {
    ilog('index.resumeRecorder()')

    if (this.isWavAndAndroid(this._recordFilePath)) {
      const [err, res] = await to<string>(this.resumeAndroidWavRecorder())
      if (err) {
        const errStr = 'index.resumeAndroidWavRecorder() from index.resumeRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog(res)
      return res
    }

    //Not wav && android

    if (this._isRecording && this._hasPausedRecord) {
      this._hasPausedRecord = false

      const [err, res] = await to<string>(RnAudio.resumeRecorder())
      if (err) {
        const errStr = 'index.resumeRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.resumeRecorder() - Result: ', res)
      return res
    }

    return 'index.resumeRecorder(): ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Wasn\'t paused.')
  }

  /**
   * stop recording.
   * @returns {Promise<string>}
   */
  stopRecorder = async (): Promise<object|string> => {
    ilog('index.stopRecorder()')

    if (this.isWavAndAndroid(this._recordFilePath)) {
      const [err, res] = await to<object|string>(this.stopAndroidWavRecorder())
      if (err) {
        const errStr = 'index.stopAndroidWavRecorder() from index.stopRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.stopRecorder() - Result: ', res)
      return res
    }

    //Not wav && android

    if (this._isRecording) {
      this._isRecording = false
      this._hasPausedRecord = false
      this.removeRecUpdateCallback()
      this.removeRecStopCallback()
      const [err, res] = await to<object>(RnAudio.stopRecorder())
      if (err) {
        const errStr = 'index.stopRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.stopRecorder() - Result: ', res)
      return res
    }

    return 'index.stopRecorder(): Wasn\'t recording (or was called twice).'
  }

  playerCallback = (event: PlayUpdateMetadata): void => {
    ilog('index.playerCallback()')  
    if (this._playUpdateCallback) {
      this._playUpdateCallback(event)
    }
    if (event.playElapsedMs === event.playDurationMs) {
      this.stopPlayer()
    }
  }

  private abortPlayback = async () => {
    ilog('index.abortPlayback()')    
    await this.stopPlayer()
    this._isPlaying = false
    this._hasPaused = false
  }

  /**
   * Start playing with param.
   * @param {StartPlayerArgs} startPlayerArgs params.
   * @param {Record<string, string>} httpHeaders Set of http headers.
   * @returns {Promise<string>}
   */
  startPlayer = async ({
    uri = 'DEFAULT',
    httpHeaders,
    playUpdateCallback,
    playVolume: playbackVolume = 1.0
  }:StartPlayerArgs): Promise<string> => {
    ilog('index.startPlayer()')
    
    if (playUpdateCallback) {
      this.addPlayUpdateCallback(playUpdateCallback)
    }
    else {
      this.removePlayUpdateCallback()
    }

    if (!this._playUpdateScription) {
      if (Platform.OS === 'android') {
        this._playUpdateScription = 
          DeviceEventEmitter.addListener(EventId.PlayUpdate, this.playerCallback)
      } 
      else { //iOS
        const myModuleEvt = new NativeEventEmitter(RnAudio)
        this._playUpdateScription = 
          myModuleEvt.addListener(EventId.PlayUpdate, this.playerCallback)
      }
    }

    if (!this._isPlaying || this._hasPaused) {
      this._isPlaying = true
      this._hasPaused = false
      ilog('   Calling RnAudio.startPlayer()')
      const [err, res] = await to<string>(RnAudio.startPlayer(uri, httpHeaders, playbackVolume))
      if (err) {
        const errStr = 'index.startPlayer() - Error: ' + err
        elog(errStr)
        this.abortPlayback()
        return Promise.reject(errStr)
      }
      ilog('index.startPlayer() - Result: ', res)
      return res
    }

    return 'index.startPlayer() - Already playing, or not paused'
  }

  /**
   * Pause playing.
   * @returns {Promise<string>}
   */
  pausePlayer = async (): Promise<string> => {
    ilog('index.pausePlayer()')
    if (!this._isPlaying) {
      return 'index.pausePlayer() - No audio playing to pause'
    }
    if (!this._hasPaused) {
      this._hasPaused = true
      const [err, res] = await to<string>(RnAudio.pausePlayer())
      if (err) {
        const errStr = 'index.pausePlayer() - Error: ' + err
        elog(errStr)
        this.abortPlayback()
        return Promise.reject(errStr)
      }
      ilog('index.pausePlayer() - Result: ', res)
      return res
    }
    return 'index.pausePlayer() - Audio already paused'
  }

  /**
   * Resume playing.
   * @returns {Promise<string>}
   */
  resumePlayer = async (): Promise<string> => {
    ilog('index.resumePlayer()')
    if (!this._isPlaying) {
      return 'index.resumePlayer(): No audio playing to resume'
    }
    if (this._hasPaused) {
      this._hasPaused = false
      const [err, res] = await to<string>(RnAudio.resumePlayer())
      if (err) {
        const errStr = 'index.resumePlayer() - Error: ' + err
        elog(errStr)
        this.abortPlayback()
        return Promise.reject(errStr)
      }
      ilog('index.resumePlayer() - Result: ', res)
      return res
    }
    return 'index.resumePlayer(): Audio already playing'
  }

  /**
   * Stop playing.
   * @returns {Promise<string>}
   */
  stopPlayer = async (): Promise<string> => {
    ilog('index.stopPlayer()')
    if (this._isPlaying) {
      this._isPlaying = false
      this._hasPaused = false
      this.removePlayUpdateCallback()
      const [err, res] = await to<string>(RnAudio.stopPlayer())
      if (err) {
        const errStr = 'stopPlayer - Error: ' + err
        elog(errStr)
        return Promise.reject(errStr)
      }
      ilog('index.stopPlayer() - Result: ', res)
      return res
    }
  
    return 'index.stopPlayer() - Already stopped playback'
  }

  /**
   * Seek to a particular time in a recording. Doesn't currently
   * work when playback is stopped; only when playing or paused.
   * @param {number} time position seek to in millisecond.
   * @returns {Promise<string>}
   */
  seekToPlayer = async (time: number): Promise<string> => {
    ilog('index.seekToPlayer()')
    const [err, res] = await to<string>(RnAudio.seekToPlayer(time))
    if (err) {
      const errStr = 'index.seekToPlayer() - Error: ' + err
      elog(errStr)
      this.abortPlayback()
      return Promise.reject(errStr)
    }
    ilog('index.seekToPlayer() - Result: ', res)
    return res
  }

  /**
   * Sets playback volume; in the case of Android its a % relative to the current MediaVolume.
   * 
   * NOTE! For Android, MediaPlayer must exist before calling this.
   * Consider using startPlayer's playbackVolume parameter instead
   *  * relative to 100% of Media Volume
   * @param {number} volume New volume (% of Media Volume) for pre-existing media player 
   * @returns {Promise<string>}
   */
  setVolume = async (volume: number): Promise<string> => {
     ilog('index.setVolume()')
     if (volume < 0 || volume > 1) {
       return Promise.reject('Volume parameter should be between 0.0 to 1.0')
     }
     const [err, res] = await to<string>(RnAudio.setVolume(volume))
     if (err) {
      const errStr = 'index.setVolume() - Error: ' + err
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog('index.setVolume() - Result: ', res)
    return res
  }

  /**
   * Set subscription duration.
   * @param {number} sec subscription callback duration in seconds.
   * @returns {Promise<string>}
   */
  setSubscriptionDuration = async (sec: number): Promise<string> => {
    ilog('index.setSubscriptionDuration()')
    const [err, res] = await to<string>(RnAudio.setSubscriptionDuration(sec))
    if (err) {
      const errStr = 'index.setSubscriptionDuration() - Error: ' + err
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog('index.setSubscriptionDuration() - Result: ', res)
    return res
  }

  // Android/Wav specific recording methods
  // These are ONLY called from the general start/pause/resume/stop methods above


  private startAndroidWavRecorder = async ({
    recordingOptions,
    recUpdateCallback,
    recStopCallback = null
  }:StartRecorderArgs): Promise<object|string> => {
    ilog('index.startAndroidWavRecorder()')
    if (!this._isRecording) {
      this._isRecording = true
      this._hasPausedRecord = false
      if (recUpdateCallback) {
        this.addRecUpdateCallback(recUpdateCallback)
      }
      this.addRecStopCallback(recStopCallback) //MUST call even if recStopCallback is null
      const [err, res] = await to<object>(RnAudio.startAndroidWavRecorder(recordingOptions))
      if (err) {
        const errStr = 'index.startAndroidWavRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.startAndroidWavRecorder() - Result: ', res)
      return res
    }

    return 'index.startAndroidWavRecorder() - Already recording' + (this._hasPausedRecord ? '; currently paused.' : '.')
  }

  private pauseAndroidWavRecorder = async (): Promise<string> => {
    ilog('index.pauseAndroidWavRecorder()')
    if (this._isRecording && !this._hasPausedRecord) {
      this._hasPausedRecord = true
      const [err, res] = await to<string>(RnAudio.pauseAndroidWavRecorder())
      if (err) {
        const errStr = 'index.pauseAndroidWavRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.pauseAndroidWavRecorder() - Result: ', res)
      return res
    }
    return 'index.pauseWavRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Already paused.')
  }

  private resumeAndroidWavRecorder = async (): Promise<string> => {
    ilog('index.resumeAndroidWavRecorder()')
    if (this._isRecording && this._hasPausedRecord) {
      this._hasPausedRecord = false
      const [err, res] = await to<string>(RnAudio.resumeAndroidWavRecorder())
      if (err) {
        const errStr = 'index.resumeAndroidWavRecorder() - Error: ' + err
        elog(errStr)
        this.abortRecording()
        return Promise.reject(errStr)
      }
      ilog('index.resumeAndroidWavRecorder() - Result: ', res)
      return res
    }
    return 'index.resumeAndroidWavRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Wasn\'t paused.')
  }

  private stopAndroidWavRecorder = async (): Promise<object|string> => {
    ilog('index.stopAndroidWavRecorder()')
    if (this._isRecording) {
      this._isRecording = false
      this._hasPausedRecord = false
      this.removeRecUpdateCallback()
      this.removeRecStopCallback()
      ilog('   calling RnAudio.stopAndroidWavRecorder()')
      const [err, res] = await to<object>(RnAudio.stopAndroidWavRecorder())
      if (err) {
        const errStr = 'index.stopAndroidWavRecorder() - Error: ' + err
        elog(errStr)
        return Promise.reject(errStr)
      }
      ilog('index.stopAndroidWavRecorder() - Result: ', res)
      return res
    }
    return 'index.stopAndroidWavRecorder: Wasn\'t recording (or was called multiple times).'
  }
}




