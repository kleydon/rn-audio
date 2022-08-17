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

export enum AndroidWavByteDepthId {
  ONE = 1,
  TWO = 2
}

export enum AndroidWavNumberOfChannelsId {
  ONE = 1,
  TWO = 2
}

export enum AppleAudioFormatId {
  lpcm = 'lpcm',
  ima4 = 'ima4',
  aac = 'aac',
  MAC3 = 'MAC3',
  MAC6 = 'MAC6',
  ulaw = 'ulaw',
  alaw = 'alaw',
  mp1 = 'mp1',
  mp2 = 'mp2',
  mp4 = 'mp4',
  alac = 'alac',
  amr = 'amr',
  flac = 'flac',
  opus = 'opus',
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
  
  //Apple-specific
  appleAVSampleRate?: number,
  appleAVNumberOfChannels?: number,
  appleAudioFormatId?: AppleAudioFormatId,
  appleAVAudioSessionModeId?: AppleAVAudioSessionModeId,
  appleAVEncoderAudioQualityId?: AppleAVEncoderAudioQualityId,
  //Apple LPCM/WAV-specific
  appleAVLinearPCMBitDepth?: AppleAVLinearPCMBitDepthId,
  appleAVLinearPCMIsBigEndian?: boolean,
  appleAVLinearPCMIsFloatKeyIOS?: boolean,
  appleAVLinearPCMIsNonInterleaved?: boolean,

  //Android-specific
  androidAudioSourceId?: AndroidAudioSourceId,
  androidOutputFormatId?: AndroidOutputFormatId,
  androidAudioEncoderId?: AndroidAudioEncoderId,
  androidAudioEncodingBitRate?: number,
  androidAudioSamplingRate?: number,
  //Android WAV-specific
  androidWavByteDepth?: AndroidWavByteDepthId,
  androidWavNumberOfChannels?: AndroidWavNumberOfChannelsId
}

enum EventId {
  RecUpdate = "RecUpdate",
  PlayUpdate = "PlayUpdate",
  RecStop = "RecStop"
}

enum RecStopCode {
  UserRequest = "UserRequest",
  MaxDurationReached = "MaxDurationReached",
  Error = "Error",
}

export type RecStopMetadata = {
  recStopCode: RecStopCode,
}

export type RecUpdateMetadata = {
  isRecording?: boolean,
  recElapsedMs: number,
  recMeterLevel?: number,
}

export type PlayUpdateMetadata = {
  isMuted?: boolean,
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

    // Re: Android, see: https://developer.android.com/guide/topics/media/media-formats
    
    const o = recordingOptions
    const invalidRecOpsStr = 'Invalid recording options: '
    const lcFilePath = o.audioFilePath?.toLowerCase()

    //If number of channels > 2
    if (o.appleAVNumberOfChannels && o.appleAVNumberOfChannels > 2 || 
        o.androidWavNumberOfChannels && o.androidWavNumberOfChannels > 2) {
      ilog(invalidRecOpsStr + 'Number of channels must be < 2.')
      return false
    }
    
    //If filename ends with '.wav', and format/encoding/sampling rate don't match
    if (lcFilePath?.endsWith('.wav')) {
      if (//Android:
          o.androidOutputFormatId === AndroidOutputFormatId.WAV &&
          o.androidAudioEncoderId === AndroidAudioEncoderId.LPCM &&
          (o.androidWavByteDepth === 1 || 
          o.androidWavByteDepth === 2 ||
          o.androidWavByteDepth === undefined) &&
          //Apple:
          o.appleAudioFormatId === AppleAudioFormatId.lpcm) {
        return true 
      }
      else {
        ilog(invalidRecOpsStr + 'Is .wav, but one or more of [format/encoding/sampling rate] don\'t agree')
        return false
      }
    }

    //If filename DOESNT ends with .wav, and format/encoding ARE for wav...
    else if ((lcFilePath && lcFilePath!.endsWith('wav')) == false) {
      if (o.androidOutputFormatId === AndroidOutputFormatId.WAV ||
          o.androidAudioEncoderId === AndroidAudioEncoderId.LPCM) {
            ilog(invalidRecOpsStr + 'Filename isn\'t .wav, but one or more of [format/encoding] ARE .wav')
        return false
      }
      else {        
        return true
      }
    }

    //Default to valid
    return true
  }

  recordingWavOnAndroid = (path:string|undefined):boolean => {
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
        EventId.RecStop,
        augmentedCallback,
      )
    } else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._recStopSubscription = myModuleEvt.addListener(
        EventId.RecStop,
        augmentedCallback,
      )
    }
  }

  /**
   * Remove listener for recording stoppage events
   * @returns {void}
   */
  private removeRecStopCallback = (): void => {
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
    this._playUpdateCallback = callback
  }

  /**
   * remove listener for player.
   * @returns {void}
   */
  private removePlayUpdateCallback = (): void => {
    this._playUpdateCallback = null
  }

  /**
   * Returns recording state
   * @returns {Promise<boolean>}
   */
  isRecording = async (): Promise<boolean> => {
    return this._isRecording
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
  }:StartRecorderArgs): Promise<string> => {

    ilog('index.startRecorder()')

    if (this.recordingOptionsLooselyValidate(recordingOptions) == false) {
      return Promise.reject('Recording options don\'t validate.')
    }

    this._recordFilePath = recordingOptions.audioFilePath

    if (this.recordingWavOnAndroid(this._recordFilePath)) {
      ilog("  Is wav && android.")
      return this.startAndroidWavRecorder({
        recordingOptions,
        recUpdateCallback,
        recStopCallback 
      })
    }

    ilog("  Not wav && android.")

    if (!this._isRecording) {
      this._isRecording = true
      this._hasPausedRecord = false
      if (recUpdateCallback) {
        this.addRecUpdateCallback(recUpdateCallback)
      }
      this.addRecStopCallback(recStopCallback) //MUST call - even recStopCallback is null
      const [err, result] = await to<string>(RnAudio.startRecorder(recordingOptions))
      if (err) {
        this._isRecording = false
        this._hasPausedRecord = false  
        this.removeRecUpdateCallback()
        this.removeRecStopCallback()
        return 'startRecorder: Error: ' + err
      }
      return result
    }

    return 'startRecorder: Already recording.'
  }

  /**
   * Pause recording.
   * @returns {Promise<string>}
   */
  pauseRecorder = async (): Promise<string> => {
    ilog('index.pauseRecorder()')

    if (this.recordingWavOnAndroid(this._recordFilePath)) {
      return this.pauseAndroidWavRecorder()
    }

    if (this._isRecording && !this._hasPausedRecord) {
      this._hasPausedRecord = true

      ilog('   calling RNWRP.pauseRecorder()')
      return RnAudio.pauseRecorder()
    }

    return 'pauseRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Already paused.')
  }

  /**
   * Resume recording.
   * @returns {Promise<string>}
   */
  resumeRecorder = async (): Promise<string> => {

    ilog('index.resumeRecorder()')

    if (this.recordingWavOnAndroid(this._recordFilePath)) {
      return this.resumeAndroidWavRecorder()
    }

    if (this._isRecording && this._hasPausedRecord) {
      this._hasPausedRecord = false

      ilog('   Calling RNWRP.resumeRecorder()')
      return RnAudio.resumeRecorder()
    }

    return 'resumeRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Wasn\'t paused.')
  }

  /**
   * stop recording.
   * @returns {Promise<string>}
   */
  stopRecorder = async (): Promise<string> => {
    
    ilog('index.stopRecorder()')

    if (this.recordingWavOnAndroid(this._recordFilePath)) {
      return this.stopAndroidWavRecorder()
    }

    if (this._isRecording) {
      this._isRecording = false
      this._hasPausedRecord = false

      ilog('   Calling index.removeRecordBackListener()')
      this.removeRecUpdateCallback()

      ilog('   Calling index.removeRecordingStoppageListener()')
      this.removeRecStopCallback()

      ilog('   Calling RnAudio.stopRecorder()')
      return RnAudio.stopRecorder()
    }

    return 'stopRecorder: Wasn\'t recording (or was called twice).'
  }


  playerCallback = (event: PlayUpdateMetadata): void => {
    if (this._playUpdateCallback) {
      this._playUpdateCallback(event)
    }

    if (event.playElapsedMs === event.playDurationMs) {
      this.stopPlayer()
    }
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
      return RnAudio.startPlayer(uri, httpHeaders, playbackVolume)  
    }

    return 'startPlayer: Already playing, or not paused'
  }

  /**
   * Pause playing.
   * @returns {Promise<string>}
   */
  pausePlayer = async (): Promise<string> => {
    ilog('index.pausePlayer()')
    if (!this._isPlaying) {
      return 'pausePlayer: No audio playing to pause'
    }
    if (!this._hasPaused) {
      this._hasPaused = true
      ilog('   calling rnwrp.pausePlayer()')
      return RnAudio.pausePlayer()
    }
    return 'pausePlayer: Audio already paused'
  }

  /**
   * Resume playing.
   * @returns {Promise<string>}
   */
  resumePlayer = async (): Promise<string> => {
    ilog('index.pausePlayer()')
    if (!this._isPlaying) {
      return 'resumePlayer: No audio playing to resume'
    }
    if (this._hasPaused) {
      this._hasPaused = false
      return RnAudio.resumePlayer()
    }
    return 'resumePlayer: Audio already playing'
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
      return RnAudio.stopPlayer()
    }
  
    return 'stopPlayer: Already stopped playback'
  }

  /**
   * Seek to a particular time in a recording. Doesn't currently
   * work when playback is stopped; only when playing or paused.
   * @param {number} time position seek to in millisecond.
   * @returns {Promise<string>}
   */
  seekToPlayer = async (time: number): Promise<string> => {
    ilog('index.seekToPlayer()')
    ilog('   calling rnwrp.seekToPlayer()')
    return RnAudio.seekToPlayer(time)
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
       throw new Error('Value of volume should be between 0.0 to 1.0')
     }
     ilog('   calling rnwrp.setVolume()')
     return RnAudio.setVolume(volume)
  }

  /**
   * Set subscription duration.
   * @param {number} sec subscription callback duration in seconds.
   * @returns {Promise<string>}
   */
  setSubscriptionDuration = async (sec: number): Promise<string> => {
    ilog('index.setSubscriptionDuration()')
    return RnAudio.setSubscriptionDuration(sec)
  }

  // Android/Wav specific recording methods 

  private startAndroidWavRecorder = async ({
    recordingOptions,
    recUpdateCallback,
    recStopCallback = null
  }:StartRecorderArgs): Promise<string> => {
    ilog('index.startAndroidWavRecorder()')
    if (!this._isRecording) {
      this._isRecording = true
      this._hasPausedRecord = false
      if (recUpdateCallback) {
        this.addRecUpdateCallback(recUpdateCallback)
      }
      this.addRecStopCallback(recStopCallback) //MUST call even if recStopCallback is null
      ilog('   calling RnAudio.startAndroidWavRecorder()')
      return RnAudio.startAndroidWavRecorder(recordingOptions)
    }

    return 'startAndroidWavRecorder: Already recording' + (this._hasPausedRecord ? '; currently paused.' : '.')
  }

  private pauseAndroidWavRecorder = async (): Promise<string> => {
    ilog('index.pauseAndroidWavRecorder()')
    if (this._isRecording && !this._hasPausedRecord) {
      this._hasPausedRecord = true
      ilog('   calling RnAudio.pauseAndroidWavRecorder()')
      return RnAudio.pauseAndroidWavRecorder()
    }
    return 'pauseWavRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Already paused.')
  }

  private resumeAndroidWavRecorder = async (): Promise<string> => {
    ilog('index.resumeAndroidWavRecorder()')
    if (this._isRecording && this._hasPausedRecord) {
      this._hasPausedRecord = false
      ilog('   calling RnAudio.resumeAndroidWavRecorder()')
      return RnAudio.resumeAndroidWavRecorder()
    }
    return 'resumeAndroidWavRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Wasn\'t paused.')
  }

  private stopAndroidWavRecorder = async (): Promise<string> => {
    ilog('index.stopAndroidWavRecorder()')
    if (this._isRecording) {
      this._isRecording = false
      this._hasPausedRecord = false
      this.removeRecUpdateCallback()
      this.removeRecStopCallback()
      ilog('   calling RnAudio.stopAndroidWavRecorder()')
      const res = await RnAudio.stopAndroidWavRecorder()
      return res
    }
    return 'stopAndroidWavRecorder: Wasn\'t recording (or was called multiple times).'
  }
}




