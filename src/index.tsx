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
}

export enum AndroidAudioEncoderId {
  DEFAULT = 0,
  AMR_NB,
  AMR_WB,
  AAC,
  HE_AAC,
  AAC_ELD,
  VORBIS,
}

export enum AndroidWavByteDepthId {
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
  
  //Shared
  audioFilePath?: string,
  meteringEnabled?: boolean,
  maxRecordingDurationSec?: number,
  
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
}

enum EventId {
  RECORDBACK = "rn-recording-callback",
  PLAYBACK = "rn-playing-callback",
  STOPPAGE = "rn-stoppage-callback"
}

enum StopCode {
  USER_REQUEST = "user-request",
  MAX_RECORDING_DURATION_REACHED = "max-recording-duration-reached",
  ERROR = "error",
}

export type StoppageCallbackMetadata = {
  stopCode: StopCode,
}

export type RecordingCallbackMetadata = {
  isRecording?: boolean,
  recordingElapsedMs: number,
  meterLevel?: number,
}

export type PlaybackCallbackMetadata = {
  isMuted?: boolean,
  playbackElapsedMs: number,
  playbackDurationMs: number,
}


interface RequestedWavParams {
  sampleRate: number,
  numChannels: number,
  byteDepth: number
}

interface StartPlayerArgs {
  uri?: string,
  httpHeaders?: Record<string, string>,
  playbackCallback?: (playbackMetadata: PlaybackCallbackMetadata) => void
  playbackVolume?: number 
}

interface StartRecorderArgs {
  recordingOptions: RecordingOptions,
  recordingCallback?: ((recordingMetadata: RecordingCallbackMetadata) => void) | null
  stoppageCallback?: ((stoppageMetadata: StoppageCallbackMetadata) => void) | null
}

interface StartWavRecorderArgs {
  requestedWavParams: RequestedWavParams,
  path?: string,
  meteringEnabled?: boolean,
  maxRecordingDurationSec?: number,
  recordingCallback?: ((recordingMetadata: RecordingCallbackMetadata) => void) | null
  stoppageCallback?: ((stoppageMetadata: StoppageCallbackMetadata) => void) | null
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

  private _isRecording: boolean
  private _isPlaying: boolean
  private _hasPaused: boolean
  private _hasPausedRecord: boolean
  private _recorderSubscription: EmitterSubscription | null
  private _playerSubscription: EmitterSubscription | null
  private _stoppageSubscription: EmitterSubscription | null
  private _playerCallback: ((playbackMetadata: PlaybackCallbackMetadata) => void) | null

  constructor() {
    this._isRecording = false
    this._isPlaying = false
    this._hasPaused = false
    this._hasPausedRecord = false
    this._recorderSubscription = null
    this._playerSubscription = null
    this._stoppageSubscription = null
    this._playerCallback = null
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
   * @param { (recordingMetadata: RecordingCallbackMetadata) => void } callback parameter
   * @returns { void }
  */
  private addRecordBackListener = (
    callback: (recordingMetadata: RecordingCallbackMetadata) => void,
  ): void => {
    if (Platform.OS === 'android') {
      this._recorderSubscription = DeviceEventEmitter.addListener(
        EventId.RECORDBACK,
        callback,
      )
    } else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._recorderSubscription = myModuleEvt.addListener(
        EventId.RECORDBACK,
        callback,
      )
    }
  }

  /**
   * Remove listener for recorder.
   * @returns {void}
   */
  private removeRecordBackListener = (): void => {
    if (this._recorderSubscription) {
      this._recorderSubscription.remove()
      this._recorderSubscription = null
    }
  }

  /**
   * Set listener from native module for stoppage.
   * @param { (stoppageMetadata: StoppageCallbackMetadata) => void } callback parameter. The callback MUST 
   * @returns { void }
   */
   private addRecordingStoppageListener = (
    callback: ((stoppageMetadata: StoppageCallbackMetadata) => void) | null,
  ): void => {

    const augmentedCallback = (stoppageMetadata: StoppageCallbackMetadata) => {
      this.removeRecordBackListener()
      this.removeRecordingStoppageListener()
      this._isRecording = false
      this._hasPausedRecord = false
      if (callback) {
        callback(stoppageMetadata)
      }
    }

    if (Platform.OS === 'android') {
      this._stoppageSubscription = DeviceEventEmitter.addListener(
        EventId.STOPPAGE,
        augmentedCallback,
      )
    } else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._stoppageSubscription = myModuleEvt.addListener(
        EventId.STOPPAGE,
        augmentedCallback,
      )
    }
  }

  /**
   * Remove listener for recorder.
   * @returns {void}
   */
  private removeRecordingStoppageListener = (): void => {
    if (this._stoppageSubscription) {
      this._stoppageSubscription.remove()
      this._stoppageSubscription = null
    }
  }

  /**
   * Set listener from native module for player.
   * @param {(playbackMetadata: PlaybackCallbackMetadata) => void} callback - Callback parameter
   * @returns {void}
   */
  private addPlayBackListener = (
    callback: (playbackMetadata: PlaybackCallbackMetadata) => void,
  ): void => {
    this._playerCallback = callback
  }

  /**
   * remove listener for player.
   * @returns {void}
   */
  private removePlayBackListener = (): void => {
    this._playerCallback = null
  }

  /**
   * Returns recording state
   * @returns {Promise<boolean>}
   */
   isRecording = async (): Promise<boolean> => {
    return this._isRecording
  }

  /**
   * start recording with param.
   * @param {StartRecorderArgs} startRecorder params.
   * @returns {Promise<string>}
   */
  startRecorder = async ({
    recordingOptions,
    recordingCallback,
    stoppageCallback = null
  }:StartRecorderArgs): Promise<string> => {

    ilog('index.startRecorder()')

    if (!this._isRecording) {
      this._isRecording = true
      this._hasPausedRecord = false
      if (recordingCallback) {
        this.addRecordBackListener(recordingCallback)
      }
      //MUST add stoppage listener, even if null
      this.addRecordingStoppageListener(stoppageCallback)
      const [err, result] = await to<string>(RnAudio.startRecorder(recordingOptions))
      if (err) {
        this._isRecording = false
        this._hasPausedRecord = false  
        this.removeRecordBackListener()
        this.removeRecordingStoppageListener()
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
    if (this._isRecording) {
      this._isRecording = false
      this._hasPausedRecord = false

      ilog('   Calling index.removeRecordBackListener()')
      this.removeRecordBackListener()

      ilog('   Calling index.removeRecordingStoppageListener()')
      this.removeRecordingStoppageListener()

      ilog('   Calling RNWRP.stopRecorder()')
      return RnAudio.stopRecorder()
    }

    return 'stopRecorder: Wasn\'t recording (or was called twice).'
  }

  playerCallback = (event: PlaybackCallbackMetadata): void => {
    if (this._playerCallback) {
      this._playerCallback(event)
    }

    if (event.playbackElapsedMs === event.playbackDurationMs) {
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
    playbackCallback,
    playbackVolume = 1.0
  }:StartPlayerArgs): Promise<string> => {

    ilog('index.startPlayer()')

    if (playbackCallback) {
      ilog('   Calling index.addPlayBackListener()')
      this.addPlayBackListener(playbackCallback)
    }
    else {
      ilog('   Calling index.removePlayBackListener()')
      this.removePlayBackListener()
    }

    if (!this._playerSubscription) {

      ilog('   adding callback.')

      if (Platform.OS === 'android') {
        this._playerSubscription = DeviceEventEmitter.addListener(
          EventId.PLAYBACK,
          this.playerCallback,
        )
      } 
      else {
        const myModuleEvt = new NativeEventEmitter(RnAudio)
        this._playerSubscription = myModuleEvt.addListener(
          EventId.PLAYBACK,
          this.playerCallback,
        )
      }
    }

    if (!this._isPlaying || this._hasPaused) {
      this._isPlaying = true
      this._hasPaused = false

      ilog('   Calling RNWRP.startPlayer()')

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

      ilog('index.pausePlayer()')
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

      ilog('   calling index.removePlayBackListener()')
      this.removePlayBackListener()

      ilog('   calling rnwrp.stopPlayer()')
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
   * Sets playback volume.
   * Android:
   *  * MediaPlayer must exist before calling this! Consider using startPlayer's playbackVolume parameter instead
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

  /**
   * startWavRecorder
   * @param {StartWavRecorderArgs} startWavRecordArgs
   * @returns {Promise<string>}
   */
  startWavRecorder = async ({
    requestedWavParams,
    path = 'DEFAULT',
    meteringEnabled = false,
    //maxRecordingDurationSec = 4.0, //sec
    recordingCallback,
    stoppageCallback = null
  }:StartWavRecorderArgs): Promise<string> => {
    ilog('index.startWavRecorder()')
    if (!this._isRecording) {

      this._isRecording = true
      this._hasPausedRecord = false

      if (recordingCallback) {
        ilog('   calling index.addRecordBackListener()')
        this.addRecordBackListener(recordingCallback)
      }

      ilog('   calling index.addRecordingStoppageListener()')
      //Must add stoppage listener; even if its null
      this.addRecordingStoppageListener(stoppageCallback)

      ilog('   calling rnwrp.startWavRecorder()')
      return RnAudio.startWavRecorder(
        requestedWavParams,
        path,
        meteringEnabled,
        maxRecordingDurationSec
      )
    }

    return 'startWavRecorder: Already recording' + (this._hasPausedRecord ? '; currently paused.' : '.')
  }

  /**
   * Pause wav recording.
   * @returns {Promise<string>}
   */
   pauseWavRecorder = async (): Promise<string> => {
    ilog('index.pauseWavRecorder()')
    ilog('   isRecording:', this._isRecording)
    ilog('   isPaused:', this._isRecording)
    if (this._isRecording && !this._hasPausedRecord) {
      this._hasPausedRecord = true
      ilog('   calling rnwrp.pauseWavRecorder()')
      return RnAudio.pauseWavRecorder()
    }

    return 'pauseWavRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Already paused.')
  }

  /**
   * Resume wav recording.
   * @returns {Promise<string>}
   */
  resumeWavRecorder = async (): Promise<string> => {
    ilog('index.resumeWavRecorder()')
    if (this._isRecording && this._hasPausedRecord) {
      this._hasPausedRecord = false
      ilog('   calling rnwrp.resumeWavRecorder()')
      return RnAudio.resumeWavRecorder()
    }

    return 'resumeWavRecorder: ' + (!this._isRecording ? 'Wasn\'t recording.' : 'Wasn\'t paused.')
  }

  /**
   * stopWavRecorder
   * @returns {Promise<string>}
   */
  stopWavRecorder = async (): Promise<string> => {
    ilog('index.stopWavRecorder()')
    if (this._isRecording) {

      this._isRecording = false
      this._hasPausedRecord = false

      ilog('   calling index.removeRecordBackListener()')
      this.removeRecordBackListener()

      ilog('   calling index.removeRecordingStoppageListener()')
      this.removeRecordingStoppageListener()

      ilog('   calling rnwrp.stopWavRecorder()')
      const res = await RnAudio.stopWavRecorder()
      return res
    }

    return 'stopWavRecorder: Wasn\'t recording (or was called multiple times).'
  }



  // ****
  multiply = async (a: number, b: number): Promise<number> => {
    return RnAudio.multiply(a, b);
  }

}




