import {
  DeviceEventEmitter,
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid
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

export enum PlayerState {
  Playing = "Playing",
  Paused = "Paused",
  Stopped = "Stopped"
}

export enum RecorderState {
  Recording = "Recording",
  Paused = "Paused",
  Stopped = "Stopped"
}


export interface RecordingOptions {
  
  fileNameOrPath?: string,
  recMeteringEnabled?: boolean,
  maxRecDurationSec?: number,
  sampleRate?: number,
  numChannels?: NumberOfChannelsId,
  encoderBitRate?: number,
  lpcmByteDepth?: ByteDepthId,
  
  //Apple-specific
  appleAudioFormatId?: AppleAudioFormatId,
  appleAVAudioSessionModeId?: AppleAVAudioSessionModeId,
  //Apple encoded/compressed-specific
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
  //(None)
}

export enum EventId {
  RecStop = "RecStop",
  PlayStop = "PlayStop",
  RecUpdate = "RecUpdate",
  PlayUpdate = "PlayUpdate",
}

export enum RecStopCode {
  Requested = "Requested",  // By user or app; not due to error or timeout
  MaxDurationReached = "MaxDurationReached",
  WasNotRecording = "WasNotRecording",  // Response to request to stopRecording, when not recording
  Error = "Error",
}

export enum PlayStopCode {
  Requested = "Requested",  // By user or app; not due to error or timeout
  MaxDurationReached = "MaxDurationReached",
  WasNotPlaying = "WasNotPlaying",
  Error = "Error",
}

export type RecStopMetadata = {
  filePath?: string,  // Available if recStopCode !== "Error"
  recStopCode: RecStopCode,
}

export type PlayStopMetadata = {
  filePathOrUrl?: string,  // Available ****TRUE?****** if recStopCode !== "Error"
  playStopCode: PlayStopCode,
}

export type RecUpdateMetadata = {
  isRecording: boolean,
  recElapsedMs: number,
  recMeterLevelDb?: number,
}

export type PlayUpdateMetadata = {
  isMuted: boolean,
  playElapsedMs: number,
  playDurationMs: number,
}

interface StartPlayerArgs {
  fileNameOrPathOrURL?: string,
  httpHeaders?: Record<string, string>,
  playUpdateCallback?: ((playUpdateMetadata: PlayUpdateMetadata) => void) | null
  playStopCallback?: ((playStopMetadata: PlayStopMetadata) => void) | null
  playVolume?: number 
}
export type StartPlayerResult = {
  filePathOrURL: string, 
}
export type StopPlayerResult = PlayStopMetadata


interface StartRecorderArgs {
  recordingOptions: RecordingOptions,
  recUpdateCallback?: ((recUpdateMetadata: RecUpdateMetadata) => void) | null
  recStopCallback?: ((recStopMetadata: RecStopMetadata) => void) | null
}
export interface StartRecorderResult extends Omit<RecordingOptions, 'fileNameOrPath'> {
  filePath: string
}
export type StopRecorderResult = RecStopMetadata


const ilog = console.log
// @ts-ignore
const wlog = console.warn
// @ts-ignore
const elog = console.error

const pad = (num: number): string => {
  return ('0' + num).slice(-2)
}

const DEFAULT_WAV_FILE_NAME = 'recording.wav'
const DEFAULT_FILE_NAME_PLACEHOLDER = 'DEFAULT'  //Keep snyced w/ native implementations


/**
 * Audio class.
 * Consider using this module's provided `audio` instance (at the bottom of this file) as a singleton, 
 * rather than creating new/multiple instances of this class.
 */
export class Audio {
  private _playUpdateCallback: ((playUpdateMetadata: PlayUpdateMetadata) => void) | null
  private _recUpdateSubscription: EmitterSubscription | null
  private _recStopSubscription: EmitterSubscription | null
  private _playUpdateScription: EmitterSubscription | null
  private _playStopSubscription: EmitterSubscription | null

  constructor() {
    this._playUpdateCallback = null
    this._recStopSubscription = null
    this._recUpdateSubscription = null
    this._playUpdateScription = null
    this._playStopSubscription = null
  }

  /**
   * Verify required Android permissions are enabled; requesting that
   * they be enabled, if necessary. Returns true if all required 
   * permissions are enabled, false otherwise.
   * @returns Promise<boolean>
   */
  verifyAndroidPermissionsEnabled = async ():Promise<boolean> => {
    const funcName = 'index.androidPermissionsEnabled()'
    ilog(funcName)
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE!,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE!,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!,
        ])
        ilog(funcName + ' - Android platform.version:', Platform.Version)
        ilog(funcName + ' - Android permission grants:', grants)
        // Post Android 13 (API 33), WRITE/READ_EXTERNAL_STORAGE change to scoped storage
        // See: https://stackoverflow.com/questions/72948052/android-13-read-external-storage-permission-still-usable/73630987#73630987
        if (
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED &&
          (
            Platform.Version >= 33 || 
            (
              grants['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
              grants['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
            )
          )
        ) {
          return true
        } 
        else {
          wlog(funcName + ' - Required android permissions NOT granted')
          return false
        }
      } catch (err) {
        wlog(err)
        return false
      }
    }
    return true
  }

  /**
   * Verify that Android's RECORD_AUDIO permission is enabled; 
   * requesting that it be enabled, if necessary. 
   * Returns true if enabled, false otherwise.
   * @returns Promise<boolean>
   */
  verifyAndroidRecordAudioEnabled = async ():Promise<boolean> => {
    const funcName = 'index.androidRecordAudioEnabled()'
    ilog(funcName)
    if (Platform.OS === 'android') {
      try {
        if (await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!)) {
          return true
        } 
        else {
          elog(funcName + ' - Android RECORD_AUDIO permission NOT granted')
          return false
        }
      } catch (err) {
        wlog(err)
        return false
      }
    }
    return true
  }

  /**
   * Verify that Android's WRITE_EXTERNAL_STORAGE permission is enabled; 
   * requesting that it be enabled, if necessary. 
   * Returns true if enabled, false otherwise.
   * @returns Promise<boolean>
   */
  verifyAndroidWriteExternalStorageEnabled = async ():Promise<boolean> => {
    const funcName = 'index.androidWriteExternalStorageEnabled()'
    ilog(funcName)
    if (Platform.OS === 'android') {
      try {
        if (await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE!)) {
          return true
        } 
        else {
          wlog(funcName + ' - Android WRITE_EXTERNAL_STORAGE permissions NOT granted')
          return false
        }
      } catch (err) {
        wlog(err)
        return false
      }
    }
    return true
  }

  /**
   * Verify that Android's READ_EXTERNAL_STORAGE permission is enabled; 
   * requesting that it be enabled, if necessary. 
   * Returns true if enabled, false otherwise.
   * @returns Promise<boolean>
   */
  verifyAndroidReadExternalStorageEnabled = async ():Promise<boolean> => {
    const funcName = 'index.androidReadExternalStorageEnabled()'
    ilog(funcName)
    if (Platform.OS === 'android') {
      try {
        if (await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE!)) {
          return true
        } 
        else {
          wlog(funcName + ' - Android READ_EXTERNAL_STORAGE permissions NOT granted')
          return false
        }
      } catch (err) {
        wlog(err)
        return false
      }
    }
    return true
  }


  resolveAndValidateRecordingOptions = async (recordingOptions:RecordingOptions): Promise<boolean> => {

    // This function is FAR from complete. 
    // Currently, it mainly helps to ensure successful wav file recording.

    // Useful for the future, re: Android:
    //  https://developer.android.com/guide/topics/media/media-formats

    ilog('index.resolveAndValidateRecordingOptions()')
    
    const ro = recordingOptions
    var lcFileNameOrPath = ro.fileNameOrPath?.toLowerCase()

    ilog('Validating recording options...')

    let res = true;  // Default to valid
    let errMsgs:String[] = [] 

    //Allow empty set of options (to get default set of options)
    if (recordingOptions === undefined || 
        Object.keys(recordingOptions).length === 0) {
      return res;
    }

    //INDEPENDENT parameter coercion/validation
    //++++++++++++++++++++

    //Coercing empty numChannels
    if (ro.numChannels === undefined) {
      ilog('Coercing (empty) numChannels to 1')
      ro.numChannels = 1
    }

    //Coercing empty lpcmByteDepth
    if (ro.lpcmByteDepth === undefined) {
      ilog('Coercing (empty) lpcmByteDepth to 2')
      ro.lpcmByteDepth = ByteDepthId.TWO
    }

    //Coercing empty sample rate
    if (ro.sampleRate === undefined) {
      ilog('Coercing (empty) sampleRate to 44100')
      ro.sampleRate = 44100
    }

    //File name/path validation
    if (lcFileNameOrPath && 
      lcFileNameOrPath !== DEFAULT_FILE_NAME_PLACEHOLDER) {
      //If file name/path doesn't have a .suffix
      if (lcFileNameOrPath.includes('.') === false) {
        const errMsg = 'File name/path must end with .<suffix>'
        elog(errMsg); errMsgs.push(errMsg)
        res = false
      }
      //If file name/path is accidentally a URL
      if (lcFileNameOrPath.startsWith('http:') || 
          lcFileNameOrPath.startsWith('https:')) {
        const errMsg = 'Recording file name/path cannot be a URL.'
        elog(errMsg); errMsgs.push(errMsg)
        res = false
      }
    }

    //numChannels validation
    if (ro.numChannels !== undefined && (ro.numChannels < 1 || ro.numChannels > 2)) {
      const errMsg = 'Number of channels must be > 0 and <= 2.'
      elog(errMsg); errMsgs.push(errMsg)
      res = false
    }

    //lpcmByteDepth validation
    if (ro.lpcmByteDepth !== undefined && (ro.lpcmByteDepth < 1 || ro.lpcmByteDepth > 2)) {
      const errMsg = 'lpcmByteDepth must be >0 and <= 2.'
      elog(errMsg); errMsgs.push(errMsg)
      res = false
    }
    //--------------------

    //COMBINED parameter coercion / validation
    //++++++++++++++++++++

    if (ro.androidOutputFormatId === AndroidOutputFormatId.WAV &&
        ro.androidAudioEncoderId === undefined) {
      ro.androidAudioEncoderId = AndroidAudioEncoderId.LPCM
      ilog('androidOutputFormatId is for WAV; coercing (empty) androidAudioEncoderId accordingly')
    }

    if (ro.androidAudioEncoderId === AndroidAudioEncoderId.LPCM &&
        ro.androidOutputFormatId === undefined) {
      ro.androidOutputFormatId = AndroidOutputFormatId.WAV
      ilog('androidAudioEncoderId is for LPCM; coercing (empty) androidOutputFormatId accordingly for WAV')
    }

    //If file name/path is undefined...
    if (lcFileNameOrPath === undefined) {
      //If format/encoding unambiguously indicate .WAV...
      if ((Platform.OS === 'android' && 
           ro.androidAudioEncoderId === AndroidAudioEncoderId.LPCM && 
           ro.androidOutputFormatId === AndroidOutputFormatId.WAV) ||
          (Platform.OS === 'ios' &&
           ro.appleAudioFormatId === AppleAudioFormatId.lpcm)) {
        ro.fileNameOrPath = DEFAULT_WAV_FILE_NAME
        lcFileNameOrPath = ro.fileNameOrPath.toLowerCase()  // Update lowercase version
        ilog('Format/encoding are for .wav; coercing (empty) fileNameOrPath to: ', ro.fileNameOrPath)
      }
    }

    //If file name/path ends with '.wav'...
    if (lcFileNameOrPath?.endsWith('.wav')) {

      //Coerce empty format/encoding/sampling params to match .wav file name/path
      const fileNameOrPathEndsWithWavPrefix = 'File name/path ends with \'.wav\'; '
      if (ro.androidAudioEncoderId === undefined) {
        ro.androidAudioEncoderId = AndroidAudioEncoderId.LPCM
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) androidAudioEncoderId accordingly.')
      }
      if (ro.androidOutputFormatId === undefined) {
        ro.androidOutputFormatId = AndroidOutputFormatId.WAV
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) androidOutputFormat accordingly.')
      }  
      if (ro.appleAudioFormatId === undefined) {
        ro.appleAudioFormatId = AppleAudioFormatId.lpcm
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) appleAudioFormatId accordingly.')
      }
      if (ro.lpcmByteDepth === undefined) {
        ro.lpcmByteDepth = ByteDepthId.TWO
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) lpcmByteDepth accordingly.')
      }

      //Validate supplied format/encoding params against .wav file name/path
      const fileIsWavPrefixStr = 'File name/path ends with \'.wav\', but '
      if (Platform.OS === 'android') {
        if (ro.androidOutputFormatId !== undefined && 
            ro.androidOutputFormatId !== AndroidOutputFormatId.WAV) {
          const errMsg = fileIsWavPrefixStr + 'androidOutputFormatId is: ' + ro.androidOutputFormatId
          elog(errMsg); errMsgs.push(errMsg)
          res = false
        }
        if (ro.androidAudioEncoderId !== undefined && 
            ro.androidAudioEncoderId !== AndroidAudioEncoderId.LPCM) {
          const errMsg = fileIsWavPrefixStr + 'androidAudioEncoderId is: ' + ro.androidAudioEncoderId
          elog(errMsg); errMsgs.push(errMsg)
          res = false
        }
      }
      else if (Platform.OS === 'ios') {
        if (ro.appleAudioFormatId !== AppleAudioFormatId.lpcm) {
          const errMsg = fileIsWavPrefixStr + 'appleAudioFormatId is: ' + ro.appleAudioFormatId
          elog(errMsg); errMsgs.push(errMsg)
          res = false
        }
      }
    } 

    //If file name/path exists, and DOESN'T end with .wav, bug format / encoding indicate wav...
    if (lcFileNameOrPath !== undefined && (lcFileNameOrPath.endsWith('.wav') === false)) {
      const fileIsntWavPrefixStr = 'File name/path doesn\'t end with .wav, but '
      if (Platform.OS === 'android') {
        if (ro.androidOutputFormatId === AndroidOutputFormatId.WAV) {
          const errMsg = fileIsntWavPrefixStr + 'androidOutputFormatId is: ' + ro.androidOutputFormatId
          elog(errMsg); errMsgs.push(errMsg)
          res = false
        }
        if (ro.androidAudioEncoderId === AndroidAudioEncoderId.LPCM) {
          const errMsg = fileIsntWavPrefixStr + 'androidAudioEncoderId is: ' + ro.androidAudioEncoderId
          elog(errMsg); errMsgs.push(errMsg)
          res = false
        }
      } 
      if (Platform.OS === 'ios') {
        if (ro.appleAudioFormatId === AppleAudioFormatId.lpcm) {
          const errMsg = fileIsntWavPrefixStr + 'appleAudioFormatId is: ' + ro.appleAudioFormatId
          elog(errMsg); errMsgs.push(errMsg)
          res = false
        }  
      }
    }
    //--------------------
    
    return res ? Promise.resolve(res) : Promise.reject('Recording Option resolution errors: ' + errMsgs.toString())
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

  private addRecUpdateCallback = (
    callback: (recUpdateMetadata: RecUpdateMetadata) => void,
  ): void => {
    const funcName = 'index.addRecUpdateCallback()'
    ilog(funcName)
    this._recUpdateSubscription?.remove()
    if (Platform.OS === 'android') {
      this._recUpdateSubscription = DeviceEventEmitter.addListener(EventId.RecUpdate, callback)
    } else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._recUpdateSubscription = myModuleEvt.addListener(EventId.RecUpdate, callback)
    }
  }
  private removeRecUpdateCallback = (): void => {
    const funcName = 'index.removeRecUpdateCallback()'
    ilog(funcName)
    if (this._recUpdateSubscription) {
      this._recUpdateSubscription.remove()
      this._recUpdateSubscription = null
    }
  }

  private addRecStopCallback = (
    callback: ((recStopMetadata: RecStopMetadata) => void) | null,
  ): void => {
    const funcName = 'index.addRecStopCallback()'
    ilog(funcName)
    //Ensure recording-related callbacks get removed when recording stops
    const augmentedCallback = async (recStopMetadata: RecStopMetadata) => {
      this.removeRecUpdateCallback()
      this.removeRecStopCallback()
      if (callback) { callback(recStopMetadata) }
    }
    this._recStopSubscription?.remove()
    if (Platform.OS === 'android') {
      this._recStopSubscription = DeviceEventEmitter.addListener(EventId.RecStop, augmentedCallback)
    } else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._recStopSubscription = myModuleEvt.addListener(EventId.RecStop, augmentedCallback)
    }
  }
  private removeRecStopCallback = (): void => {
    const funcName = 'index.removeRecStopCallback()'
    ilog(funcName)
    if (this._recStopSubscription) {
      this._recStopSubscription.remove()
      this._recStopSubscription = null
    }
  }

  private addPlayUpdateCallback = (
    callback: ((playUpdateMetadata: PlayUpdateMetadata) => void) | null,
  ): void => {
    const funcName = 'index.addPlayUpdateCallback()'
    ilog(funcName)
    this._playUpdateScription?.remove()
    if (!callback) { return }
    if (Platform.OS === 'android') {
      this._playUpdateScription = DeviceEventEmitter.addListener(EventId.PlayUpdate, callback)
    } 
    else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._playUpdateScription = myModuleEvt.addListener(EventId.PlayUpdate, callback)
    }
  }
  private removePlayUpdateCallback = (): void => {
    const funcName = 'index.removePlayUpdateCallback()'
    ilog(funcName)
    if (this._playUpdateScription) {
      this._playUpdateScription.remove()
      this._playUpdateScription = null
    }
  }
  
  private addPlayStopCallback = (
    callback: ((playStopMetadata: PlayStopMetadata) => void) | null,
  ): void => {
    const funcName = 'index.addPlayStopCallback()'
    ilog(funcName)
    //Ensure play-related callbacks get removed when playing stops
    const augmentedCallback = async (playStopMetadata: PlayStopMetadata) => {
      this.removePlayUpdateCallback()
      this.removePlayStopCallback()
      if (callback) { callback(playStopMetadata) }
    }
    this._playStopSubscription?.remove()
    if (Platform.OS === 'android') {
      this._playStopSubscription = DeviceEventEmitter.addListener(EventId.PlayStop, augmentedCallback)
    } else {
      const myModuleEvt = new NativeEventEmitter(RnAudio)
      this._playStopSubscription = myModuleEvt.addListener(EventId.PlayStop, augmentedCallback)
    }
  }
  private removePlayStopCallback = (): void => {
    const funcName = 'index.removePlayStopCallback()'
    ilog(funcName)
    if (this._playStopSubscription) {
      this._playStopSubscription.remove()
      this._playStopSubscription = null
    }
  }

  /**
   * Resolves to the current player state.
   * @returns {Promise<PlayerState>}
   */
  getPlayerState = async (): Promise<PlayerState> => {
    const funcName = 'index.getPlayerState(): ' + RnAudio.getPlayerState()  // Casting to string doesn't work... Is there a better way?
    ilog(funcName)
    return await RnAudio.getPlayerState()
  }

  /**
   * Resolves to the current recorder state.
   * @returns {Promise<RecorderState>}
   */
  getRecorderState = async (): Promise<RecorderState> => {
    const funcName = 'index.getRecorderState()'
    ilog(funcName)
    return await RnAudio.getRecorderState()
  }

  private resetRecorder = async (dontCallStop = false) => {
    const funcName = 'index.resetRecorder()'
    ilog(funcName)
    try {
      const recorderState = await this.getRecorderState()
      ilog(funcName + ' - recorderState: ' + recorderState)
      if (recorderState != RecorderState.Stopped && dontCallStop === false) {
        ilog(funcName + ' - calling stopRecorder()')
        const silently = true
        await this.stopRecorder(silently)  
      }  
    }
    catch (e) {
      const errStr = funcName + ' - ' + e
      elog(errStr)
    }
    finally {
      this.removeRecUpdateCallback()
      this.removeRecStopCallback()
    }
  }

  /**
   * Start recording
   * @param {StartRecorderArgs} startRecorderArgs param.
   * @returns {Promise<StartRecorderResult>}
   */
  startRecorder = async ({
    recordingOptions,
    recUpdateCallback,
    recStopCallback = null
  }:StartRecorderArgs): Promise<StartRecorderResult> => {
    const funcName = 'index.startRecorder()'
    ilog(funcName)

    const [resolveErr, ] = await to(this.resolveAndValidateRecordingOptions(recordingOptions))
    if (resolveErr) {
      return Promise.reject(funcName + '- Recording options don\'t validate: ' + resolveErr)
    }
    
    ilog('  index.startRecorder() - resetting recorder in preparation')
    await this.resetRecorder()
    if (await this.getRecorderState() !== RecorderState.Stopped) {
      return Promise.reject(funcName + ' - Unable to reset recorder')
    }
    
    // Add callbacks
    if (recUpdateCallback) {
      this.addRecUpdateCallback(recUpdateCallback)
    }
    this.addRecStopCallback(recStopCallback) //MUST call - even recStopCallback is null

    // Call RnAudio.startRecorder
    const [err, res] = await to<StartRecorderResult>(RnAudio.startRecorder(recordingOptions))
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      await this.resetRecorder()
      return Promise.reject(errStr)
    }

    ilog(funcName + ' - Result: ', res)
    return res
  }

  /**
   * Pause recording.
   * @returns {Promise<string>}
   */
  pauseRecorder = async (): Promise<string> => {
    const funcName = 'index.pauseRecorder()'
    ilog(funcName)
    const recorderState = await this.getRecorderState()
    if (recorderState !== RecorderState.Recording) {
      return funcName + ' - No need to pause; recorder ' + 
          ((recorderState === RecorderState.Stopped) ? 'isn\'t recording.' : 'is already paused.')
    }
    const [err, res] = await to<string>(RnAudio.pauseRecorder())
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      await this.resetRecorder()
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

  /**
   * Resume recording.
   * @returns {Promise<string>}
   */
  resumeRecorder = async (): Promise<string> => {
    const funcName = 'index.resumeRecorder()'
    ilog(funcName)
    const recorderState = await this.getRecorderState()
    if (recorderState !== RecorderState.Paused) {
      return funcName + ' - No need to resume; recorder isn\'t ' + 
          ((recorderState === RecorderState.Stopped) ? 'recording' : 'paused')
    }
    const [err, res] = await to<string>(RnAudio.resumeRecorder())
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      await this.resetRecorder()
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }


  /**
   * stop recording.
   * @returns {Promise<StopRecorderResult>}
   */
  stopRecorder = async (silent?:boolean): Promise<StopRecorderResult> => {
    const funcName = 'index.stopRecorder()'
    ilog(funcName)
    this.removeRecUpdateCallback()
    //NOTE: RecStopCallback gets removed when recStopCallback fires; see addRecStopCallback
    const [err, res] = await to<StopRecorderResult>(RnAudio.stopRecorder())
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      await this.resetRecorder(true)
      return Promise.reject(errStr)
    }
    if (silent !== true) {
      ilog(funcName + ' - Result: ', res)
    }
    return res
  }

  private resetPlayer = async () => {
    const funcName = 'index.resetPlayer()'
    ilog(funcName)
    try {
      const playerState = await this.getPlayerState()
      if (playerState !== PlayerState.Stopped) {
        ilog(funcName + ' - calling index.stopPlayer()')
        await this.stopPlayer()
      }
    }
    catch (e) {
      elog(funcName + ' - ' + e)
    }
    finally {
      this.removePlayUpdateCallback()
      this._playUpdateCallback = null
    }
  }

  /**
   * Start playing with param.
   * @param {StartPlayerArgs} startPlayerArgs params.
   * @returns {Promise<StartPlayerResult>}
   */
  startPlayer = async ({
    fileNameOrPathOrURL = DEFAULT_FILE_NAME_PLACEHOLDER,
    httpHeaders,
    playUpdateCallback,
    playStopCallback = null,
    playVolume: playbackVolume = 1.0
  }:StartPlayerArgs): Promise<StartPlayerResult> => {
    const funcName = 'index.startPlayer()'
    ilog(funcName)

    //Basic validation of fileNameOrPathOrURL
    const lcFileNameOrPathOrURL = fileNameOrPathOrURL.toLowerCase()
    if (lcFileNameOrPathOrURL && 
        lcFileNameOrPathOrURL !== DEFAULT_FILE_NAME_PLACEHOLDER) {
      //If file name/path doesn't have a .suffix
      if (lcFileNameOrPathOrURL.includes('.') === false) {
        const errMsg = 'File name/path must end with .<suffix>'
        elog(errMsg)
        return Promise.reject(funcName + ' - ' + errMsg)
      }
    }

    await this.resetPlayer()

    if (playUpdateCallback) {
      this._playUpdateCallback = playUpdateCallback
      this.addPlayUpdateCallback(playUpdateCallback)
    }
    this.addPlayStopCallback(playStopCallback) //MUST call - even playStopCallback is null

    ilog(funcName + ' - calling RnAudio.startPlayer()')
    const [err, res] = await to<StartPlayerResult>(
        RnAudio.startPlayer(fileNameOrPathOrURL, httpHeaders, playbackVolume)
    )
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      await this.resetPlayer()
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

  /**
   * Pause playing.
   * @returns {Promise<string>}
   */
  pausePlayer = async (): Promise<string> => {
    const funcName = 'index.pausePlayer()'
    ilog(funcName)
    const playerState = await this.getPlayerState()
    ilog('  playerState: ' + playerState)
    if (playerState !== PlayerState.Playing) {
      return funcName + ' - No need to pause; player ' +
        ((playerState === PlayerState.Stopped) ? 'isn\'t running' : 'is already paused')
    }
    this.removePlayUpdateCallback()
    const [err, res] = await to<string>(RnAudio.pausePlayer())
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      await this.resetPlayer()
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res  
  }

  /**
   * Resume playing.
   * @returns {Promise<string>}
   */
  resumePlayer = async (): Promise<string> => {
    const funcName = 'index.resumePlayer()'
    ilog(funcName)
    const playerState = await this.getPlayerState()
    ilog(funcName + ' - playerState: ', playerState)
    if (playerState !== PlayerState.Paused) {
      return funcName + ' - No need to resume; player isn\'t ' + 
          ((playerState === PlayerState.Stopped) ? 'playing' : 'paused')
    }
    this.addPlayUpdateCallback(this._playUpdateCallback)
    const [err, res] = await to<string>(RnAudio.resumePlayer())
    if (err) {
      const errStr = funcName + ' - Error: ' + err
      elog(errStr)
      await this.resetPlayer()
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

  /**
   * Stops player
   * @returns {Promise<StopPlayerResult>}
   */
  stopPlayer = async (): Promise<StopPlayerResult> => {
    const funcName = 'index.stopPlayer()'
    ilog(funcName)
    this.removePlayUpdateCallback()
    //NOTE: PlayStopCallback gets removed when playStopCallback fires; see addRecStopCallback
    const [err, res] = await to<StopPlayerResult>(RnAudio.stopPlayer())
    if (err) {
      const errStr = funcName + '- ' + err
      elog(errStr)
      await this.resetPlayer()
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res  
  }

  /**
   * Seek to a particular time in a recording. Doesn't currently
   * work when playback is stopped; only when playing or paused.
   * @param {number} timeMs position seek to in millisecond.
   * @returns {Promise<string>}
   */
  seekToPlayer = async (timeMs: number): Promise<string> => {
    const funcName = 'index.seekToPlayer()'
    ilog(funcName)
    const playerState = await this.getPlayerState()
    ilog(funcName + ' - playerState: ' + playerState)
    if (playerState === PlayerState.Stopped) {
      Promise.resolve(funcName + ' - Can\'t seek; player isn\'t playing')      
    }
    const [err, res] = await to<string>(RnAudio.seekToPlayer(timeMs))
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

  /**
   * Sets player volume; in the case of Android its a % relative to the current MediaVolume.
   * 
   * NOTE! For Android, MediaPlayer must exist before calling this.
   * Consider using startPlayer's playbackVolume parameter instead
   *  * relative to 100% of Media Volume
   * @param {number} volume New volume (% of Media Volume) for pre-existing media player 
   * @returns {Promise<string>}
   */
  setPlayerVolume = async (volume: number): Promise<string> => {
     const funcName = 'index.setPlayerVolume()'
     ilog(funcName)
     if (volume < 0 || volume > 1) {
       return Promise.reject(funcName + 'Volume parameter should be between 0.0 to 1.0')
     }
     const [err, res] = await to<string>(RnAudio.setPlayerVolume(volume))
     if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

  /**
   * Set subscription duration.
   * @param {number} sec subscription callback duration in seconds.
   * @returns {Promise<string>}
   */
  setSubscriptionDuration = async (sec: number): Promise<string> => {
    const funcName = 'index.setSubscriptionDuration()'
    ilog(funcName)
    const [err, res] = await to<string>(RnAudio.setSubscriptionDuration(sec))
    if (err) {
      const errStr = funcName + ' - ' + err
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

}

//Export one instance
export const audio = new Audio()



