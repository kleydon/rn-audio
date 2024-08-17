"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.audio = exports.RecorderState = exports.RecStopCode = exports.PlayerState = exports.PlayStopCode = exports.NumberOfChannelsId = exports.EventId = exports.ByteDepthId = exports.Audio = exports.AppleAudioFormatId = exports.AppleAVLinearPCMBitDepthId = exports.AppleAVEncoderAudioQualityId = exports.AppleAVAudioSessionModeId = exports.AndroidOutputFormatId = exports.AndroidAudioSourceId = exports.AndroidAudioEncoderId = void 0;
var _reactNative = require("react-native");
var _awaitToJs = _interopRequireDefault(require("await-to-js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const LINKING_ERROR = `The package 'rn-audio' doesn't seem to be linked. Make sure: \n\n` + _reactNative.Platform.select({
  ios: "- You have run 'pod install'\n",
  default: ''
}) + '- You rebuilt the app after installing the package\n' + '- You are not using Expo managed workflow\n';
const RnAudio = _reactNative.NativeModules.RnAudio ? _reactNative.NativeModules.RnAudio : new Proxy({}, {
  get() {
    throw new Error(LINKING_ERROR);
  }
});
let AndroidAudioSourceId = exports.AndroidAudioSourceId = /*#__PURE__*/function (AndroidAudioSourceId) {
  AndroidAudioSourceId[AndroidAudioSourceId["DEFAULT"] = 0] = "DEFAULT";
  AndroidAudioSourceId[AndroidAudioSourceId["MIC"] = 1] = "MIC";
  AndroidAudioSourceId[AndroidAudioSourceId["VOICE_UPLINK"] = 2] = "VOICE_UPLINK";
  AndroidAudioSourceId[AndroidAudioSourceId["VOICE_DOWNLINK"] = 3] = "VOICE_DOWNLINK";
  AndroidAudioSourceId[AndroidAudioSourceId["VOICE_CALL"] = 4] = "VOICE_CALL";
  AndroidAudioSourceId[AndroidAudioSourceId["CAMCORDER"] = 5] = "CAMCORDER";
  AndroidAudioSourceId[AndroidAudioSourceId["VOICE_RECOGNITION"] = 6] = "VOICE_RECOGNITION";
  AndroidAudioSourceId[AndroidAudioSourceId["VOICE_COMMUNICATION"] = 7] = "VOICE_COMMUNICATION";
  AndroidAudioSourceId[AndroidAudioSourceId["REMOTE_SUBMIX"] = 8] = "REMOTE_SUBMIX";
  AndroidAudioSourceId[AndroidAudioSourceId["UNPROCESSED"] = 9] = "UNPROCESSED";
  AndroidAudioSourceId[AndroidAudioSourceId["VOICE_PERFORMANCE"] = 10] = "VOICE_PERFORMANCE";
  AndroidAudioSourceId[AndroidAudioSourceId["RADIO_TUNER"] = 1998] = "RADIO_TUNER";
  AndroidAudioSourceId[AndroidAudioSourceId["HOTWORD"] = 1999] = "HOTWORD";
  return AndroidAudioSourceId;
}({});
let AndroidOutputFormatId = exports.AndroidOutputFormatId = /*#__PURE__*/function (AndroidOutputFormatId) {
  AndroidOutputFormatId[AndroidOutputFormatId["DEFAULT"] = 0] = "DEFAULT";
  AndroidOutputFormatId[AndroidOutputFormatId["THREE_GPP"] = 1] = "THREE_GPP";
  AndroidOutputFormatId[AndroidOutputFormatId["MPEG_4"] = 2] = "MPEG_4";
  AndroidOutputFormatId[AndroidOutputFormatId["AMR_NB"] = 3] = "AMR_NB";
  AndroidOutputFormatId[AndroidOutputFormatId["AMR_WB"] = 4] = "AMR_WB";
  AndroidOutputFormatId[AndroidOutputFormatId["AAC_ADIF"] = 5] = "AAC_ADIF";
  AndroidOutputFormatId[AndroidOutputFormatId["AAC_ADTS"] = 6] = "AAC_ADTS";
  AndroidOutputFormatId[AndroidOutputFormatId["OUTPUT_FORMAT_RTP_AVP"] = 7] = "OUTPUT_FORMAT_RTP_AVP";
  AndroidOutputFormatId[AndroidOutputFormatId["MPEG_2_TS"] = 8] = "MPEG_2_TS";
  AndroidOutputFormatId[AndroidOutputFormatId["WEBM"] = 9] = "WEBM";
  AndroidOutputFormatId[AndroidOutputFormatId["WAV"] = 999] = "WAV";
  return AndroidOutputFormatId;
}({});
let AndroidAudioEncoderId = exports.AndroidAudioEncoderId = /*#__PURE__*/function (AndroidAudioEncoderId) {
  AndroidAudioEncoderId[AndroidAudioEncoderId["DEFAULT"] = 0] = "DEFAULT";
  AndroidAudioEncoderId[AndroidAudioEncoderId["AMR_NB"] = 1] = "AMR_NB";
  AndroidAudioEncoderId[AndroidAudioEncoderId["AMR_WB"] = 2] = "AMR_WB";
  AndroidAudioEncoderId[AndroidAudioEncoderId["AAC"] = 3] = "AAC";
  AndroidAudioEncoderId[AndroidAudioEncoderId["HE_AAC"] = 4] = "HE_AAC";
  AndroidAudioEncoderId[AndroidAudioEncoderId["AAC_ELD"] = 5] = "AAC_ELD";
  AndroidAudioEncoderId[AndroidAudioEncoderId["VORBIS"] = 6] = "VORBIS";
  AndroidAudioEncoderId[AndroidAudioEncoderId["LPCM"] = 999] = "LPCM";
  return AndroidAudioEncoderId;
}({});
let ByteDepthId = exports.ByteDepthId = /*#__PURE__*/function (ByteDepthId) {
  ByteDepthId[ByteDepthId["ONE"] = 1] = "ONE";
  ByteDepthId[ByteDepthId["TWO"] = 2] = "TWO";
  return ByteDepthId;
}({});
let NumberOfChannelsId = exports.NumberOfChannelsId = /*#__PURE__*/function (NumberOfChannelsId) {
  NumberOfChannelsId[NumberOfChannelsId["ONE"] = 1] = "ONE";
  NumberOfChannelsId[NumberOfChannelsId["TWO"] = 2] = "TWO";
  return NumberOfChannelsId;
}({});
let AppleAudioFormatId = exports.AppleAudioFormatId = /*#__PURE__*/function (AppleAudioFormatId) {
  AppleAudioFormatId["lpcm"] = "lpcm";
  AppleAudioFormatId["aac"] = "aac";
  AppleAudioFormatId["mp4"] = "mp4";
  AppleAudioFormatId["alac"] = "alac";
  AppleAudioFormatId["ilbc"] = "ilbc";
  AppleAudioFormatId["ulaw"] = "ulaw";
  AppleAudioFormatId["ima4"] = "ima4";
  AppleAudioFormatId["MAC3"] = "MAC3";
  AppleAudioFormatId["MAC6"] = "MAC6";
  AppleAudioFormatId["alaw"] = "alaw";
  AppleAudioFormatId["mp1"] = "mp1";
  AppleAudioFormatId["mp2"] = "mp2";
  AppleAudioFormatId["amr"] = "amr";
  AppleAudioFormatId["flac"] = "flac";
  AppleAudioFormatId["opus"] = "opus";
  return AppleAudioFormatId;
}({}); // kAudioFormatOpus
let AppleAVAudioSessionModeId = exports.AppleAVAudioSessionModeId = /*#__PURE__*/function (AppleAVAudioSessionModeId) {
  AppleAVAudioSessionModeId["gamechat"] = "gamechat";
  AppleAVAudioSessionModeId["measurement"] = "measurement";
  AppleAVAudioSessionModeId["movieplayback"] = "movieplayback";
  AppleAVAudioSessionModeId["spokenaudio"] = "spokenaudio";
  AppleAVAudioSessionModeId["videochat"] = "videochat";
  AppleAVAudioSessionModeId["videorecording"] = "videorecording";
  AppleAVAudioSessionModeId["voicechat"] = "voicechat";
  AppleAVAudioSessionModeId["voiceprompt"] = "voiceprompt";
  return AppleAVAudioSessionModeId;
}({});
let AppleAVEncoderAudioQualityId = exports.AppleAVEncoderAudioQualityId = /*#__PURE__*/function (AppleAVEncoderAudioQualityId) {
  AppleAVEncoderAudioQualityId[AppleAVEncoderAudioQualityId["min"] = 0] = "min";
  AppleAVEncoderAudioQualityId[AppleAVEncoderAudioQualityId["low"] = 32] = "low";
  AppleAVEncoderAudioQualityId[AppleAVEncoderAudioQualityId["medium"] = 64] = "medium";
  AppleAVEncoderAudioQualityId[AppleAVEncoderAudioQualityId["high"] = 96] = "high";
  AppleAVEncoderAudioQualityId[AppleAVEncoderAudioQualityId["max"] = 127] = "max";
  return AppleAVEncoderAudioQualityId;
}({});
let AppleAVLinearPCMBitDepthId = exports.AppleAVLinearPCMBitDepthId = /*#__PURE__*/function (AppleAVLinearPCMBitDepthId) {
  AppleAVLinearPCMBitDepthId[AppleAVLinearPCMBitDepthId["bit8"] = 8] = "bit8";
  AppleAVLinearPCMBitDepthId[AppleAVLinearPCMBitDepthId["bit16"] = 16] = "bit16";
  AppleAVLinearPCMBitDepthId[AppleAVLinearPCMBitDepthId["bit24"] = 24] = "bit24";
  AppleAVLinearPCMBitDepthId[AppleAVLinearPCMBitDepthId["bit32"] = 32] = "bit32";
  return AppleAVLinearPCMBitDepthId;
}({});
let PlayerState = exports.PlayerState = /*#__PURE__*/function (PlayerState) {
  PlayerState["Playing"] = "Playing";
  PlayerState["Paused"] = "Paused";
  PlayerState["Stopped"] = "Stopped";
  return PlayerState;
}({});
let RecorderState = exports.RecorderState = /*#__PURE__*/function (RecorderState) {
  RecorderState["Recording"] = "Recording";
  RecorderState["Paused"] = "Paused";
  RecorderState["Stopped"] = "Stopped";
  return RecorderState;
}({});
let EventId = exports.EventId = /*#__PURE__*/function (EventId) {
  EventId["RecStop"] = "RecStop";
  EventId["PlayStop"] = "PlayStop";
  EventId["RecUpdate"] = "RecUpdate";
  EventId["PlayUpdate"] = "PlayUpdate";
  return EventId;
}({});
let RecStopCode = exports.RecStopCode = /*#__PURE__*/function (RecStopCode) {
  RecStopCode["Requested"] = "Requested";
  RecStopCode["MaxDurationReached"] = "MaxDurationReached";
  RecStopCode["WasNotRecording"] = "WasNotRecording";
  RecStopCode["Error"] = "Error";
  return RecStopCode;
}({});
let PlayStopCode = exports.PlayStopCode = /*#__PURE__*/function (PlayStopCode) {
  PlayStopCode["Requested"] = "Requested";
  PlayStopCode["MaxDurationReached"] = "MaxDurationReached";
  PlayStopCode["WasNotPlaying"] = "WasNotPlaying";
  PlayStopCode["Error"] = "Error";
  return PlayStopCode;
}({});
const ilog = console.log;
// @ts-ignore
const wlog = console.warn;
// @ts-ignore
const elog = console.error;
const pad = num => {
  return ('0' + num).slice(-2);
};
const DEFAULT_WAV_FILE_NAME = 'recording.wav';
const DEFAULT_FILE_NAME_PLACEHOLDER = 'DEFAULT'; //Keep snyced w/ native implementations

/**
 * Audio class.
 * Consider using this module's provided `audio` instance (at the bottom of this file) as a singleton, 
 * rather than creating new/multiple instances of this class.
 */
class Audio {
  constructor() {
    this._playUpdateCallback = null;
    this._recStopSubscription = null;
    this._recUpdateSubscription = null;
    this._playUpdateScription = null;
    this._playStopSubscription = null;
  }

  /**
   * Verify required Android permissions are enabled; requesting that
   * they be enabled, if necessary. Returns true if all required 
   * permissions are enabled, false otherwise.
   * @returns Promise<boolean>
   */
  async verifyAndroidPermissionsEnabled() {
    const funcName = 'index.androidPermissionsEnabled()';
    ilog(funcName);
    if (_reactNative.Platform.OS === 'android') {
      try {
        const grants = await _reactNative.PermissionsAndroid.requestMultiple([_reactNative.PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, _reactNative.PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, _reactNative.PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]);
        ilog(funcName + ' - Android platform.version:', _reactNative.Platform.Version);
        ilog(funcName + ' - Android permission grants:', grants);
        // TODO: Android 13 (API 33) storage permissions should be handled differently / more completely...
        // https://developer.android.com/reference/android/Manifest.permission#READ_EXTERNAL_STORAGE
        // https://developer.android.com/reference/android/Manifest.permission#WRITE_EXTERNAL_STORAGE
        // See: https://stackoverflow.com/questions/72948052/android-13-read-external-storage-permission-still-usable/73630987#73630987
        if (grants['android.permission.RECORD_AUDIO'] === _reactNative.PermissionsAndroid.RESULTS.GRANTED && (_reactNative.Platform.Version >= 33 || grants['android.permission.WRITE_EXTERNAL_STORAGE'] === _reactNative.PermissionsAndroid.RESULTS.GRANTED && grants['android.permission.READ_EXTERNAL_STORAGE'] === _reactNative.PermissionsAndroid.RESULTS.GRANTED)) {
          return true;
        } else {
          wlog(funcName + ' - Required android permissions NOT granted');
          return false;
        }
      } catch (err) {
        wlog(err);
        return false;
      }
    }
    return true;
  }

  /**
   * Verify that Android's RECORD_AUDIO permission is enabled; 
   * requesting that it be enabled, if necessary. 
   * Returns true if enabled, false otherwise.
   * @returns Promise<boolean>
   */
  async verifyAndroidRecordAudioEnabled() {
    const funcName = 'index.androidRecordAudioEnabled()';
    ilog(funcName);
    if (_reactNative.Platform.OS === 'android') {
      try {
        if (await _reactNative.PermissionsAndroid.request(_reactNative.PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)) {
          return true;
        } else {
          elog(funcName + ' - Android RECORD_AUDIO permission NOT granted');
          return false;
        }
      } catch (err) {
        wlog(err);
        return false;
      }
    }
    return true;
  }

  /**
   * Verify that Android's WRITE_EXTERNAL_STORAGE permission is enabled; 
   * requesting that it be enabled, if necessary. 
   * Returns true if enabled, false otherwise.
   * @returns Promise<boolean>
   */
  async verifyAndroidWriteExternalStorageEnabled() {
    const funcName = 'index.androidWriteExternalStorageEnabled()';
    ilog(funcName);
    if (_reactNative.Platform.OS === 'android') {
      try {
        // TODO: Android 13 (API 33) storage permissions should be handled differently / more completely...
        if (_reactNative.Platform.Version >= 33 || (await _reactNative.PermissionsAndroid.request(_reactNative.PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE))) {
          return true;
        } else {
          wlog(funcName + ' - Android WRITE_EXTERNAL_STORAGE permissions NOT granted');
          return false;
        }
      } catch (err) {
        wlog(err);
        return false;
      }
    }
    return true;
  }

  /**
   * Verify that Android's READ_EXTERNAL_STORAGE permission is enabled; 
   * requesting that it be enabled, if necessary. 
   * Returns true if enabled, false otherwise.
   * @returns Promise<boolean>
   */
  async verifyAndroidReadExternalStorageEnabled() {
    const funcName = 'index.androidReadExternalStorageEnabled()';
    ilog(funcName);
    if (_reactNative.Platform.OS === 'android') {
      try {
        // TODO: Android 13 (API 33) storage permissions should be handled differently / more completely...
        if (_reactNative.Platform.Version >= 33 || (await _reactNative.PermissionsAndroid.request(_reactNative.PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE))) {
          return true;
        } else {
          wlog(funcName + ' - Android READ_EXTERNAL_STORAGE permissions NOT granted');
          return false;
        }
      } catch (err) {
        wlog(err);
        return false;
      }
    }
    return true;
  }
  async resolveAndValidateRecordingOptions(recordingOptions) {
    // This function is FAR from complete. 
    // Currently, it mainly helps to ensure successful wav file recording.

    // Useful for the future, re: Android:
    //  https://developer.android.com/guide/topics/media/media-formats

    ilog('index.resolveAndValidateRecordingOptions()');
    const ro = recordingOptions;
    var lcFileNameOrPath = ro.fileNameOrPath?.toLowerCase();
    ilog('Validating recording options...');
    let res = true; // Default to valid
    let errMsgs = [];

    //Allow empty set of options (to get default set of options)
    if (recordingOptions === undefined || Object.keys(recordingOptions).length === 0) {
      return res;
    }

    //INDEPENDENT parameter coercion/validation
    //++++++++++++++++++++

    //Coercing empty numChannels
    if (ro.numChannels === undefined) {
      ilog('Coercing (empty) numChannels to 1');
      ro.numChannels = 1;
    }

    //Coercing empty lpcmByteDepth
    if (ro.lpcmByteDepth === undefined) {
      ilog('Coercing (empty) lpcmByteDepth to 2');
      ro.lpcmByteDepth = ByteDepthId.TWO;
    }

    //Coercing empty sample rate
    if (ro.sampleRate === undefined) {
      ilog('Coercing (empty) sampleRate to 44100');
      ro.sampleRate = 44100;
    }

    //File name/path validation
    if (lcFileNameOrPath && lcFileNameOrPath !== DEFAULT_FILE_NAME_PLACEHOLDER) {
      //If file name/path doesn't have a .suffix
      if (lcFileNameOrPath.includes('.') === false) {
        const errMsg = 'File name/path must end with .<suffix>';
        elog(errMsg);
        errMsgs.push(errMsg);
        res = false;
      }
      //If file name/path is accidentally a URL
      if (lcFileNameOrPath.startsWith('http:') || lcFileNameOrPath.startsWith('https:')) {
        const errMsg = 'Recording file name/path cannot be a URL.';
        elog(errMsg);
        errMsgs.push(errMsg);
        res = false;
      }
    }

    //numChannels validation
    if (ro.numChannels !== undefined && (ro.numChannels < 1 || ro.numChannels > 2)) {
      const errMsg = 'Number of channels must be > 0 and <= 2.';
      elog(errMsg);
      errMsgs.push(errMsg);
      res = false;
    }

    //lpcmByteDepth validation
    if (ro.lpcmByteDepth !== undefined && (ro.lpcmByteDepth < 1 || ro.lpcmByteDepth > 2)) {
      const errMsg = 'lpcmByteDepth must be >0 and <= 2.';
      elog(errMsg);
      errMsgs.push(errMsg);
      res = false;
    }
    //--------------------

    //COMBINED parameter coercion / validation
    //++++++++++++++++++++

    if (ro.androidOutputFormatId === AndroidOutputFormatId.WAV && ro.androidAudioEncoderId === undefined) {
      ro.androidAudioEncoderId = AndroidAudioEncoderId.LPCM;
      ilog('androidOutputFormatId is for WAV; coercing (empty) androidAudioEncoderId accordingly');
    }
    if (ro.androidAudioEncoderId === AndroidAudioEncoderId.LPCM && ro.androidOutputFormatId === undefined) {
      ro.androidOutputFormatId = AndroidOutputFormatId.WAV;
      ilog('androidAudioEncoderId is for LPCM; coercing (empty) androidOutputFormatId accordingly for WAV');
    }

    //If file name/path is undefined...
    if (lcFileNameOrPath === undefined) {
      //If format/encoding unambiguously indicate .WAV...
      if (_reactNative.Platform.OS === 'android' && ro.androidAudioEncoderId === AndroidAudioEncoderId.LPCM && ro.androidOutputFormatId === AndroidOutputFormatId.WAV || _reactNative.Platform.OS === 'ios' && ro.appleAudioFormatId === AppleAudioFormatId.lpcm) {
        ro.fileNameOrPath = DEFAULT_WAV_FILE_NAME;
        lcFileNameOrPath = ro.fileNameOrPath.toLowerCase(); // Update lowercase version
        ilog('Format/encoding are for .wav; coercing (empty) fileNameOrPath to: ', ro.fileNameOrPath);
      }
    }

    //If file name/path ends with '.wav'...
    if (lcFileNameOrPath?.endsWith('.wav')) {
      //Coerce empty format/encoding/sampling params to match .wav file name/path
      const fileNameOrPathEndsWithWavPrefix = 'File name/path ends with \'.wav\'; ';
      if (ro.androidAudioEncoderId === undefined) {
        ro.androidAudioEncoderId = AndroidAudioEncoderId.LPCM;
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) androidAudioEncoderId accordingly.');
      }
      if (ro.androidOutputFormatId === undefined) {
        ro.androidOutputFormatId = AndroidOutputFormatId.WAV;
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) androidOutputFormat accordingly.');
      }
      if (ro.appleAudioFormatId === undefined) {
        ro.appleAudioFormatId = AppleAudioFormatId.lpcm;
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) appleAudioFormatId accordingly.');
      }
      if (ro.lpcmByteDepth === undefined) {
        ro.lpcmByteDepth = ByteDepthId.TWO;
        ilog(fileNameOrPathEndsWithWavPrefix + 'coercing (empty) lpcmByteDepth accordingly.');
      }

      //Validate supplied format/encoding params against .wav file name/path
      const fileIsWavPrefixStr = 'File name/path ends with \'.wav\', but ';
      if (_reactNative.Platform.OS === 'android') {
        if (ro.androidOutputFormatId !== undefined && ro.androidOutputFormatId !== AndroidOutputFormatId.WAV) {
          const errMsg = fileIsWavPrefixStr + 'androidOutputFormatId is: ' + ro.androidOutputFormatId;
          elog(errMsg);
          errMsgs.push(errMsg);
          res = false;
        }
        if (ro.androidAudioEncoderId !== undefined && ro.androidAudioEncoderId !== AndroidAudioEncoderId.LPCM) {
          const errMsg = fileIsWavPrefixStr + 'androidAudioEncoderId is: ' + ro.androidAudioEncoderId;
          elog(errMsg);
          errMsgs.push(errMsg);
          res = false;
        }
      } else if (_reactNative.Platform.OS === 'ios') {
        if (ro.appleAudioFormatId !== AppleAudioFormatId.lpcm) {
          const errMsg = fileIsWavPrefixStr + 'appleAudioFormatId is: ' + ro.appleAudioFormatId;
          elog(errMsg);
          errMsgs.push(errMsg);
          res = false;
        }
      }
    }

    //If file name/path exists, and DOESN'T end with .wav, bug format / encoding indicate wav...
    if (lcFileNameOrPath !== undefined && lcFileNameOrPath.endsWith('.wav') === false) {
      const fileIsntWavPrefixStr = 'File name/path doesn\'t end with .wav, but ';
      if (_reactNative.Platform.OS === 'android') {
        if (ro.androidOutputFormatId === AndroidOutputFormatId.WAV) {
          const errMsg = fileIsntWavPrefixStr + 'androidOutputFormatId is: ' + ro.androidOutputFormatId;
          elog(errMsg);
          errMsgs.push(errMsg);
          res = false;
        }
        if (ro.androidAudioEncoderId === AndroidAudioEncoderId.LPCM) {
          const errMsg = fileIsntWavPrefixStr + 'androidAudioEncoderId is: ' + ro.androidAudioEncoderId;
          elog(errMsg);
          errMsgs.push(errMsg);
          res = false;
        }
      }
      if (_reactNative.Platform.OS === 'ios') {
        if (ro.appleAudioFormatId === AppleAudioFormatId.lpcm) {
          const errMsg = fileIsntWavPrefixStr + 'appleAudioFormatId is: ' + ro.appleAudioFormatId;
          elog(errMsg);
          errMsgs.push(errMsg);
          res = false;
        }
      }
    }
    //--------------------
    ilog('Done resolving and validating. Res:', res);
    return res ? Promise.resolve(res) : Promise.reject('Recording Option resolution errors: ' + errMsgs.toString());
  }
  mmss(secs) {
    let minutes = Math.floor(secs / 60);
    secs = secs % 60;
    minutes = minutes % 60;
    return pad(minutes) + ':' + pad(secs);
  }
  mmssss(ms) {
    const secs = Math.floor(ms / 1000);
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    const miliseconds = Math.floor(ms % 1000 / 10);
    return pad(minutes) + ':' + pad(seconds) + ':' + pad(miliseconds);
  }
  addRecUpdateCallback(callback) {
    const funcName = 'index.addRecUpdateCallback()';
    ilog(funcName);
    this._recUpdateSubscription?.remove();
    if (_reactNative.Platform.OS === 'android') {
      this._recUpdateSubscription = _reactNative.DeviceEventEmitter.addListener(EventId.RecUpdate, callback);
    } else {
      const myModuleEvt = new _reactNative.NativeEventEmitter(RnAudio);
      this._recUpdateSubscription = myModuleEvt.addListener(EventId.RecUpdate, callback);
    }
  }
  removeRecUpdateCallback() {
    const funcName = 'index.removeRecUpdateCallback()';
    ilog(funcName);
    if (this._recUpdateSubscription) {
      this._recUpdateSubscription.remove();
      this._recUpdateSubscription = null;
    }
  }
  addRecStopCallback(callback) {
    const funcName = 'index.addRecStopCallback()';
    ilog(funcName);
    //Ensure recording-related callbacks get removed when recording stops
    const self = this;
    async function augmentedCallback(recStopMetadata) {
      // not async () => ... until Hermes supports it
      self.removeRecUpdateCallback();
      self.removeRecStopCallback();
      if (callback) {
        callback(recStopMetadata);
      }
    }
    this._recStopSubscription?.remove();
    if (_reactNative.Platform.OS === 'android') {
      this._recStopSubscription = _reactNative.DeviceEventEmitter.addListener(EventId.RecStop, augmentedCallback);
    } else {
      const myModuleEvt = new _reactNative.NativeEventEmitter(RnAudio);
      this._recStopSubscription = myModuleEvt.addListener(EventId.RecStop, augmentedCallback);
    }
  }
  removeRecStopCallback() {
    const funcName = 'index.removeRecStopCallback()';
    ilog(funcName);
    if (this._recStopSubscription) {
      this._recStopSubscription.remove();
      this._recStopSubscription = null;
    }
  }
  addPlayUpdateCallback(callback) {
    const funcName = 'index.addPlayUpdateCallback()';
    ilog(funcName);
    this._playUpdateScription?.remove();
    if (!callback) {
      return;
    }
    if (_reactNative.Platform.OS === 'android') {
      this._playUpdateScription = _reactNative.DeviceEventEmitter.addListener(EventId.PlayUpdate, callback);
    } else {
      const myModuleEvt = new _reactNative.NativeEventEmitter(RnAudio);
      this._playUpdateScription = myModuleEvt.addListener(EventId.PlayUpdate, callback);
    }
  }
  removePlayUpdateCallback() {
    const funcName = 'index.removePlayUpdateCallback()';
    ilog(funcName);
    if (this._playUpdateScription) {
      this._playUpdateScription.remove();
      this._playUpdateScription = null;
    }
  }
  addPlayStopCallback(callback) {
    const funcName = 'index.addPlayStopCallback()';
    ilog(funcName);
    //Ensure play-related callbacks get removed when playing stops
    const self = this;
    async function augmentedCallback(playStopMetadata) {
      // not async () => ... until Hermes supports it
      self.removePlayUpdateCallback();
      self.removePlayStopCallback();
      if (callback) {
        callback(playStopMetadata);
      }
    }
    this._playStopSubscription?.remove();
    if (_reactNative.Platform.OS === 'android') {
      this._playStopSubscription = _reactNative.DeviceEventEmitter.addListener(EventId.PlayStop, augmentedCallback);
    } else {
      const myModuleEvt = new _reactNative.NativeEventEmitter(RnAudio);
      this._playStopSubscription = myModuleEvt.addListener(EventId.PlayStop, augmentedCallback);
    }
  }
  removePlayStopCallback() {
    const funcName = 'index.removePlayStopCallback()';
    ilog(funcName);
    if (this._playStopSubscription) {
      this._playStopSubscription.remove();
      this._playStopSubscription = null;
    }
  }

  /**
   * Resolves to the current player state.
   * @returns {Promise<PlayerState>}
   */
  async getPlayerState() {
    const funcName = 'index.getPlayerState(): ' + RnAudio.getPlayerState(); // Casting to string doesn't work... Is there a better way?
    ilog(funcName);
    return await RnAudio.getPlayerState();
  }

  /**
   * Resolves to the current recorder state.
   * @returns {Promise<RecorderState>}
   */
  async getRecorderState() {
    const funcName = 'index.getRecorderState()';
    ilog(funcName);
    return await RnAudio.getRecorderState();
  }
  async resetRecorder(dontCallStop = false) {
    const funcName = 'index.resetRecorder()';
    ilog(funcName);
    try {
      const recorderState = await this.getRecorderState();
      ilog(funcName + ' - recorderState: ' + recorderState);
      if (recorderState != RecorderState.Stopped && dontCallStop === false) {
        ilog(funcName + ' - calling stopRecorder()');
        const silently = true;
        await this.stopRecorder(silently);
      }
    } catch (e) {
      const errStr = funcName + ' - ' + e;
      elog(errStr);
    } finally {
      this.removeRecUpdateCallback();
      this.removeRecStopCallback();
    }
  }

  /**
   * Start recording
   * @param {StartRecorderArgs} startRecorderArgs param.
   * @returns {Promise<StartRecorderResult>}
   */
  async startRecorder({
    recordingOptions,
    recUpdateCallback,
    recStopCallback = null
  }) {
    const funcName = 'index.startRecorder()';
    ilog(funcName);
    const [resolveErr] = await (0, _awaitToJs.default)(this.resolveAndValidateRecordingOptions(recordingOptions));
    if (resolveErr) {
      return Promise.reject(funcName + '- Recording options don\'t validate: ' + resolveErr);
    }
    ilog('  index.startRecorder() - resetting recorder in preparation');
    await this.resetRecorder();
    if ((await this.getRecorderState()) !== RecorderState.Stopped) {
      return Promise.reject(funcName + ' - Unable to reset recorder');
    }

    // Add callbacks
    if (recUpdateCallback) {
      this.addRecUpdateCallback(recUpdateCallback);
    }
    this.addRecStopCallback(recStopCallback); //MUST call - even recStopCallback is null

    // Call RnAudio.startRecorder
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.startRecorder(recordingOptions));
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      await this.resetRecorder();
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * Pause recording.
   * @returns {Promise<string>}
   */
  async pauseRecorder() {
    const funcName = 'index.pauseRecorder()';
    ilog(funcName);
    const recorderState = await this.getRecorderState();
    if (recorderState !== RecorderState.Recording) {
      return funcName + ' - No need to pause; recorder ' + (recorderState === RecorderState.Stopped ? 'isn\'t recording.' : 'is already paused.');
    }
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.pauseRecorder());
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      await this.resetRecorder();
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * Resume recording.
   * @returns {Promise<string>}
   */
  async resumeRecorder() {
    const funcName = 'index.resumeRecorder()';
    ilog(funcName);
    const recorderState = await this.getRecorderState();
    if (recorderState !== RecorderState.Paused) {
      return funcName + ' - No need to resume; recorder isn\'t ' + (recorderState === RecorderState.Stopped ? 'recording' : 'paused');
    }
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.resumeRecorder());
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      await this.resetRecorder();
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * stop recording.
   * @returns {Promise<StopRecorderResult>}
   */
  async stopRecorder(silent) {
    const funcName = 'index.stopRecorder()';
    ilog(funcName);
    this.removeRecUpdateCallback();
    //NOTE: RecStopCallback gets removed when recStopCallback fires; see addRecStopCallback
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.stopRecorder());
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      await this.resetRecorder(true);
      return Promise.reject(errStr);
    }
    if (silent !== true) {
      ilog(funcName + ' - Result: ', res);
    }
    return res;
  }
  async resetPlayer() {
    const funcName = 'index.resetPlayer()';
    ilog(funcName);
    try {
      const playerState = await this.getPlayerState();
      if (playerState !== PlayerState.Stopped) {
        ilog(funcName + ' - calling index.stopPlayer()');
        await this.stopPlayer();
      }
    } catch (e) {
      elog(funcName + ' - ' + e);
    } finally {
      this.removePlayUpdateCallback();
      this._playUpdateCallback = null;
    }
  }

  /**
   * Start playing with param.
   * @param {StartPlayerArgs} startPlayerArgs params.
   * @returns {Promise<StartPlayerResult>}
   */
  async startPlayer({
    fileNameOrPathOrURL = DEFAULT_FILE_NAME_PLACEHOLDER,
    httpHeaders,
    playUpdateCallback,
    playStopCallback = null,
    playVolume: playbackVolume = 1.0
  }) {
    const funcName = 'index.startPlayer()';
    ilog(funcName);

    //Basic validation of fileNameOrPathOrURL
    const lcFileNameOrPathOrURL = fileNameOrPathOrURL.toLowerCase();
    if (lcFileNameOrPathOrURL && lcFileNameOrPathOrURL !== DEFAULT_FILE_NAME_PLACEHOLDER) {
      //If file name/path doesn't have a .suffix
      if (lcFileNameOrPathOrURL.includes('.') === false) {
        const errMsg = 'File name/path must end with .<suffix>';
        elog(errMsg);
        return Promise.reject(funcName + ' - ' + errMsg);
      }
    }
    await this.resetPlayer();
    if (playUpdateCallback) {
      this._playUpdateCallback = playUpdateCallback;
      this.addPlayUpdateCallback(playUpdateCallback);
    }
    this.addPlayStopCallback(playStopCallback); //MUST call - even playStopCallback is null

    ilog(funcName + ' - calling RnAudio.startPlayer()');
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.startPlayer(fileNameOrPathOrURL, httpHeaders, playbackVolume));
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      await this.resetPlayer();
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * Pause playing.
   * @returns {Promise<string>}
   */
  async pausePlayer() {
    const funcName = 'index.pausePlayer()';
    ilog(funcName);
    const playerState = await this.getPlayerState();
    ilog('  playerState: ' + playerState);
    if (playerState !== PlayerState.Playing) {
      return funcName + ' - No need to pause; player ' + (playerState === PlayerState.Stopped ? 'isn\'t running' : 'is already paused');
    }
    this.removePlayUpdateCallback();
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.pausePlayer());
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      await this.resetPlayer();
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * Resume playing.
   * @returns {Promise<string>}
   */
  async resumePlayer() {
    const funcName = 'index.resumePlayer()';
    ilog(funcName);
    const playerState = await this.getPlayerState();
    ilog(funcName + ' - playerState: ', playerState);
    if (playerState !== PlayerState.Paused) {
      return funcName + ' - No need to resume; player isn\'t ' + (playerState === PlayerState.Stopped ? 'playing' : 'paused');
    }
    this.addPlayUpdateCallback(this._playUpdateCallback);
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.resumePlayer());
    if (err) {
      const errStr = funcName + ' - Error: ' + err;
      elog(errStr);
      await this.resetPlayer();
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * Stops player
   * @returns {Promise<StopPlayerResult>}
   */
  async stopPlayer() {
    const funcName = 'index.stopPlayer()';
    ilog(funcName);
    this.removePlayUpdateCallback();
    //NOTE: PlayStopCallback gets removed when playStopCallback fires; see addRecStopCallback
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.stopPlayer());
    if (err) {
      const errStr = funcName + '- ' + err;
      elog(errStr);
      await this.resetPlayer();
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * Seek to a particular time in a recording. Doesn't currently
   * work when playback is stopped; only when playing or paused.
   * @param {number} timeMs position seek to in millisecond.
   * @returns {Promise<string>}
   */
  async seekToPlayer(timeMs) {
    const funcName = 'index.seekToPlayer()';
    ilog(funcName);
    const playerState = await this.getPlayerState();
    ilog(funcName + ' - playerState: ' + playerState);
    if (playerState === PlayerState.Stopped) {
      return Promise.resolve(funcName + ' - Can\'t seek; player isn\'t playing');
    }
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.seekToPlayer(timeMs));
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
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
  async setPlayerVolume(volume) {
    const funcName = 'index.setPlayerVolume()';
    ilog(funcName);
    if (volume < 0 || volume > 1) {
      return Promise.reject(funcName + 'Volume parameter should be between 0.0 to 1.0');
    }
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.setPlayerVolume(volume));
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }

  /**
   * Set subscription duration.
   * @param {number} sec subscription callback duration in seconds.
   * @returns {Promise<string>}
   */
  async setSubscriptionDuration(sec) {
    const funcName = 'index.setSubscriptionDuration()';
    ilog(funcName);
    const [err, res] = await (0, _awaitToJs.default)(RnAudio.setSubscriptionDuration(sec));
    if (err) {
      const errStr = funcName + ' - ' + err;
      elog(errStr);
      return Promise.reject(errStr);
    }
    ilog(funcName + ' - Result: ', res);
    return res;
  }
}

//Export one instance
exports.Audio = Audio;
const audio = exports.audio = new Audio();
//# sourceMappingURL=index.js.map