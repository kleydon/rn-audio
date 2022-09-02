package com.rnaudio

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioRouting
import android.media.MediaRecorder.AudioSource
import android.media.audiofx.AutomaticGainControl
import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import com.facebook.react.modules.core.PermissionListener
import java.io.IOException
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.*
import kotlin.math.log10

// NOTE! In class declaration line below:
// * 'private val' makes reactContext accessible to member methods
// * ', PermissionListener' ensures that onRequestPermissionsResult() can be over-ridden and called in the class
class RnAudioModule(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext), PermissionListener {

  companion object {
    private val TAG = "RnAudio"  //NOTE: Must match module name!
  }

  override fun getName(): String {
    return TAG
  }

  private val DEFAULT_FILE_NAME_PLACEHOLDER = "DEFAULT"
  private val DEFAULT_FILE_NAME = "recording.mp4"
  private val DEFAULT_WAV_FILE_NAME = "recording.wav"

  private val DEFAULT_MAX_RECORDING_DURATION_SEC = 10.0
  private val DEFAULT_SUBSCRIPTION_DURATION_MS = 500
  
  private val MAX_METER_LEVEL_DB:Double = 0.0
  private val MIN_METER_LEVEL_DB:Double = -160.0

  private val PERMISSION_NOT_GRANTED_STR = "One or more required permissions (RECORD_AUDIO, WRITE_EXTERNAL_STORAGE) not granted."
  private val TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR = "Try again after adding permission(s)."

  private val ENCODER_ID_LPCM = 999
  private val OUTPUT_FORMAT_ID_WAV = 999

  //Events passed from native -> js
  enum class Event(val str: String) {
    RecUpdate("RecUpdate"),
    PlayUpdate("PlayUpdate"),
    RecStop("RecStop"),  // When recording is stopped, provides reason
    PlayStop("PlayStop"),  // When playback is stopped, provides reason
  }

  enum class RecStopCode(val str: String) {
    Requested("Requested"),  //By user, or app; not due to error or timeout
    MaxDurationReached("MaxDurationReached"),
    Error("Error")
  }

  enum class PlayStopCode(val str: String) {
    Requested("Requested"),  //By user, or app; not due to error or timeout
    MaxDurationReached("MaxDurationReached"),
    Error("Error")
  }

  enum class PlayerState(val str: String) {
    Playing("Playing"),
    Paused("Paused"),
    Stopped("Stopped")
  }

  enum class RecorderState(val str: String) {
    Recording("Recording"),
    Paused("Paused"),
    Stopped("Stopped")
  }

  enum class Key(val str: String) {
    //Recording Option Keys
    //++++++++
    //Cross-platform
    audioFileNameOrPath("audioFileNameOrPath"),
    recMeteringEnabled("recMeteringEnabled"),
    maxRecDurationSec("maxRecDurationSec"),
    sampleRate("sampleRate"),
    numChannels("numChannels"),
    lpcmByteDepth("lpcmByteDepth"),
    encoderBitRate("encoderBitRate"),
    //Android-specific
    androidAudioSourceId("androidAudioSourceId"),
    androidOutputFormatId("androidOutputFormatId"),
    androidAudioEncoderId("androidAudioEncoderId"),
    androidAudioEncodingBitRate("androidAudioEncodingBitRate"),
    //--------
    //Event detail and play/rec stop code, return value keys
    //++++++++
    isMuted("isMuted"),
    isRecording("isRecording"),
    recStopCode("recStopCode"),
    playStopCode("playStopCode"),
    recElapsedMs("recElapsedMs"),
    recMeterLevelDb("recMeterLevelDb"),
    playElapsedMs("playElapsedMs"),
    playDurationMs("playDurationMs"),
    audioFilePath("audioFilePath"),
    //--------
  }

  // Set this with resolveFilePathOrURL(). Can only be a URL when playing; not recording
  private var _audioFilePathOrURL:String = ""

  private var _recMeteringEnabled = false
  private var _sampleRate:Int = 44100
  private var _numChannels:Int = 1

  //Playback
  private var _mediaPlayer: MediaPlayer? = null
  private var _playUpdateTimerTask: TimerTask? = null
  private var _playUpdateTimer: Timer? = null

  //Recording
  private var _recStopCode = RecStopCode.Requested  // Updated while recording. Sent in event msg, and in response to stopRecorder request
  @Volatile private var _pausedRecordTimeMs = 0L  //Value of 0 used secondarily to signify "not paused"
  private var _totalPausedRecordTimeMs = 0L
  var _routingChangedListener = if (Build.VERSION.SDK_INT >= 24) {
    object : AudioRouting.OnRoutingChangedListener {
      override fun onRoutingChanged(p0: AudioRouting?) {
        onRoutingChangedInner()        
      }
    }
  } 
  else if (Build.VERSION.SDK_INT >= 23) {
    @Deprecated(message = "Replacing AudioRecord.OnRoutingChangedListener with null",
                replaceWith = ReplaceWith(expression = "null"),
                level = DeprecationLevel.HIDDEN)
    object : AudioRecord.OnRoutingChangedListener {
      @Deprecated(message = "Replacing onRoutingChanged() with function returning null")
      override fun onRoutingChanged(p0: AudioRecord?) {
        onRoutingChangedInner()
      }
    }
  }
  else {
    null
  }
  private fun onRoutingChangedInner() {
    var funcName = TAG + ".onRoutingChangedListener()"
    Log.d(TAG, funcName)
    val recorderState = getRecorderState()
    val playerState = getPlayerState()
    try {
      if (recorderState != RecorderState.Stopped) {
        if (_recordHandler != null) {
          _recorderRunnable?.let { _recordHandler!!.removeCallbacks(it) }
        }
        //In case recording non-LPCM
        resetMediaRecorder()
        //In case recording LPCM
        _currentlyRecordingLPCM = false
        resetAudioRecord()
      }
      if (playerState != PlayerState.Stopped) {
        resetMediaPlayer()
      }
    } 
    catch (e:Exception) {
      Log.e(TAG, funcName + " - " + e)
    }
    finally {
      if (recorderState != RecorderState.Stopped) {
        _recStopCode = RecStopCode.Error
        sendRecStopEvent()
      }
      if (playerState != PlayerState.Stopped) {
        sendPlayStopEvent(PlayStopCode.Error)
      }
    }
  }

  //Non-LPCM recording
  private var _mediaRecorder: MediaRecorder? = null
  private var _recorderRunnable: Runnable? = null
  var _recordHandler: Handler? = Handler(Looper.getMainLooper())
  private var _subscriptionDurationMs = DEFAULT_SUBSCRIPTION_DURATION_MS
  //LPCM recording
  private var _lpcmByteDepth:Int = 2
  private var _maxNumSamples:Int = 0  // Note: Int affords >> 4hrs @ 48000 samples/sec
  private var _audioRecord:AudioRecord? = null
  private var _lpcmFrameBufferSize:Int? = null
  private var _lpcmFrameData:ByteArray? = null
  private var _lpcmFrameDataContentSize:Int? = null
  @Volatile private var _currentlyRecordingLPCM:Boolean = false  // Recording thread polls this to see if done
  private var _tempRawPCMDataFilePath:String? = null

  //This is just a fallback; ReactNative's PermissionsAndroid should be invoked from main application code
  //Challenges:
  //https://stackoverflow.com/questions/60299621/how-to-use-onrequestpermissionsresult-to-handle-permissions-in-react-native-andr
  //https://stackoverflow.com/questions/32714787/android-m-permissions-onrequestpermissionsresult-not-being-called
  //https://stackoverflow.com/questions/44960363/how-do-you-implement-permissionawareactivity-for-react-native
  private fun ensurePermissionsSecured():Boolean {
    Log.d(TAG, "RnAudio.ensurePermissionsSecured()")
    try {
      if (Build.VERSION.SDK_INT >= 23 &&
          (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
           ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)) {
          
        ActivityCompat.requestPermissions((currentActivity)!!, arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.WRITE_EXTERNAL_STORAGE), 0)
        
        //Returning false is not ideal, but its simple; probably the least-worst solution.
        //If there are alternatives, they are MESSY.
        return false
      }
    } 
    catch (e: Exception) {
      Log.w(TAG, e.toString())
      return false
    }
    return true
  }

  //This isn't getting called. Even if it could be, its MESSY. See links above.
   override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray): Boolean {
    Log.d(TAG, "RnAudio.onRequestPermissionsResult()")
    
    // TODO: Should this incorporate WRITE_EXTERNAL_STORAGE permission, too?

    var requestRecordAudioPermission: Int = 200

    when (requestCode) {
      requestRecordAudioPermission -> if (grantResults[0] == PackageManager.PERMISSION_GRANTED) return true
    }
    return false
  }


  @ReactMethod
  private fun sendEvent(reactContext: ReactContext,
                        eventName: String,
                        params: WritableMap?) {
    val funcName = TAG + ".sendEvent()" 
    Log.d(TAG, funcName)
    reactContext
      .getJSModule<RCTDeviceEventEmitter>(RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }


  @ReactMethod
  fun getRecorderState(promise: Promise) {
    return promise.resolve(getRecorderState().str)
  }
  fun getRecorderState():RecorderState {
      Log.d(TAG, "getRecorderState()")

    if (encodingAsLPCM(_audioFilePathOrURL)) {
      if (_audioRecord == null) {
        Log.d(TAG, "  getRecorderState() - stopped")
        return RecorderState.Stopped
      }
      else if (_pausedRecordTimeMs != 0L) {
        Log.d(TAG, "  getRecorderState() - paused")
        return RecorderState.Paused
      }
      Log.d(TAG, "  getRecorderState() - recording")
      //Should this factor into "recording"?
      //audioRecordState == AudioRecord.RECORDSTATE_RECORDING ||
      //audioRecordState == AudioRecord.READ_NON_BLOCKING ||
      //audioRecordState == AudioRecord.READ_BLOCKING
      return RecorderState.Recording
    }
    else {
      if (_mediaRecorder == null) {
        Log.d(TAG, "  getRecorderState() - stopped")
        return RecorderState.Stopped
      }
      else if (_pausedRecordTimeMs != 0L) {
        Log.d(TAG, "  getRecorderState() - paused")
        return RecorderState.Paused
      }
      Log.d(TAG, "  getRecorderState() - recording")
      return RecorderState.Recording
    }
  }


  @ReactMethod
  fun getPlayerState(promise: Promise) {
    return promise.resolve(getPlayerState().str)
  }
  fun getPlayerState():PlayerState {
    //Use _mediaPlayer!!.currentPosition > 1 to disambiguate paused?
    if (_mediaPlayer == null) {
      return PlayerState.Stopped
    }
    else if (_mediaPlayer!!.isPlaying) {
      return PlayerState.Playing
    }
    return PlayerState.Paused
  }


  // Recorder methods


  @ReactMethod
  fun startRecorder(recordingOptions: ReadableMap, promise: Promise) {
    val funcName = TAG + ".startRecorder()"
    Log.d(TAG, funcName)

    val ro = recordingOptions
    val fileNameOrPath = 
      if (ro.hasKey(Key.audioFileNameOrPath.str)) ro.getString(Key.audioFileNameOrPath.str)!! 
      else DEFAULT_FILE_NAME_PLACEHOLDER

    //If recording LPCM

    if (encodingAsLPCM(fileNameOrPath)) {
      Log.d(TAG, funcName + " - calling RnAudio.startLPCMRecorder()")
      return startLPCMRecorder(recordingOptions, promise)
    }

    //NOT recording LPCM

    if (_mediaRecorder != null) {
      return promise.reject(funcName, "mediaRecorder currently exists.")
    }

    _currentlyRecordingLPCM = false
    _recStopCode = RecStopCode.Requested //Start by assuming a no-error result

    //Ensure permissions available    
    if (ensurePermissionsSecured() == false) {
      return promise.reject(funcName, PERMISSION_NOT_GRANTED_STR + TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR)
    }

    Log.d(TAG, funcName+ " - Requested recording options:")
    Log.d(TAG, " " + recordingOptions)

    //Set/coerce recording options

    //Cross-platform
    _audioFilePathOrURL = resolveFilePathOrURL(
      rawFileNameOrPathOrURL = fileNameOrPath,
      isWav = false
    )
    _recMeteringEnabled = if (ro.hasKey(Key.recMeteringEnabled.str)) ro.getBoolean(Key.recMeteringEnabled.str) else true
    var maxRecDurationSec = if (ro.hasKey(Key.maxRecDurationSec.str)) ro.getDouble(Key.maxRecDurationSec.str) else DEFAULT_MAX_RECORDING_DURATION_SEC
    _sampleRate = if (ro.hasKey(Key.sampleRate.str)) ro.getInt(Key.sampleRate.str) else 44100
    _numChannels = if (ro.hasKey(Key.numChannels.str)) ro.getInt(Key.numChannels.str) else 1
    val encoderBitRate = if (ro.hasKey(Key.encoderBitRate.str)) ro.getInt(Key.encoderBitRate.str) else 128000
    //Android-specific
    val audioSourceId = if (ro.hasKey(Key.androidAudioSourceId.str)) ro.getInt(Key.androidAudioSourceId.str) else MediaRecorder.AudioSource.MIC
    val outputFormatId = if (ro.hasKey(Key.androidOutputFormatId.str)) ro.getInt(Key.androidOutputFormatId.str) else MediaRecorder.OutputFormat.MPEG_4
    val audioEncoderId = if (ro.hasKey(Key.androidAudioEncoderId.str)) ro.getInt(Key.androidAudioEncoderId.str) else MediaRecorder.AudioEncoder.AAC
    //Android-non-wav-specific


    Log.d(TAG, " ")
    Log.d(TAG, "Coerced:")
    Log.d(TAG, "  audioFilePathOrURL: " + _audioFilePathOrURL)
    Log.d(TAG, "  recMeteringEnabled: " + _recMeteringEnabled)
    Log.d(TAG, "  maxRecDurationSec: " + maxRecDurationSec)
    Log.d(TAG, "  sampleRate:" + _sampleRate)
    Log.d(TAG, "  numChannels:" + _numChannels)
    Log.d(TAG, "  audioSourceId: " + audioSourceId)
    Log.d(TAG, "  outputFormatId: " + outputFormatId)
    Log.d(TAG, "  audioEncoderId: " + audioEncoderId)
    Log.d(TAG, "  encoderBitRate: " + encoderBitRate)

    //Configure media recorder
    if (_mediaRecorder == null) {
      if (Build.VERSION.SDK_INT < 31) {
        @Suppress("DEPRECATION")
        _mediaRecorder = MediaRecorder() //Old constructor
      }
      else {
        _mediaRecorder = MediaRecorder(reactContext) //New constructor
      }
    }

    _mediaRecorder!!.setOutputFile(_audioFilePathOrURL)
    _mediaRecorder!!.setAudioSamplingRate(_sampleRate)
    _mediaRecorder!!.setAudioChannels(_numChannels)
    _mediaRecorder!!.setAudioSource(audioSourceId)
    _mediaRecorder!!.setOutputFormat(outputFormatId)
    _mediaRecorder!!.setAudioEncoder(audioEncoderId)
    _mediaRecorder!!.setAudioEncodingBitRate(encoderBitRate)

    _mediaRecorder!!.setOnErrorListener { _, what, extra ->
      val fn = TAG + ".mediaRecorder.onErrorListener()"
      Log.d(TAG, fn)
      Log.d(TAG, fn + " - what: " + what + "  extra: " + extra)
      try {
        if (_recordHandler != null) {
          _recorderRunnable?.let { _recordHandler!!.removeCallbacks(it) }
        }
        resetMediaRecorder()
        _recStopCode = RecStopCode.Error
        sendRecStopEvent()
      } 
      catch (e: Exception) {
        Log.d(TAG, funcName + " - " + e)
      }
    }
   
    try {
      
      _mediaRecorder!!.prepare()
      _pausedRecordTimeMs = 0L
      _totalPausedRecordTimeMs = 0L
      _mediaRecorder!!.start()

      //Add after starting
      if (_routingChangedListener != null) {
        Log.d(TAG, funcName + " Adding routing changed listener... ")
        _mediaRecorder!!.addOnRoutingChangedListener(_routingChangedListener, null) 
      }
      
      val systemTimeMs = SystemClock.elapsedRealtime()

      _recorderRunnable = object : Runnable {
      
        override fun run() {
          val timeMs = SystemClock.elapsedRealtime() - systemTimeMs - _totalPausedRecordTimeMs
          if (timeMs.toDouble() > maxRecDurationSec * 1000) {
            if (_mediaRecorder != null) {
              Log.d(TAG, "Max recording duration reached")
              Log.d(TAG, "Sending stoppage event")
              _recStopCode = RecStopCode.MaxDurationReached
              sendRecStopEvent()
              Log.d(TAG, "Stopping recorder")
              stopRecorder(promise)
            }
            return
          }

          //Calculate meterLevelDb
          var meterLevelDb:Double = MIN_METER_LEVEL_DB
          if (_recMeteringEnabled) {
            var maxAmplitude = 0.0
            if (_mediaRecorder != null) {
              maxAmplitude = _mediaRecorder!!.maxAmplitude.toDouble()
            }
            //Assuming maxAudioSize is a 16 bit value:
            //https://stackoverflow.com/questions/10655703/what-does-androids-getmaxamplitude-function-for-the-mediarecorder-actually-gi
            val maxAudioSize:Double = Short.MAX_VALUE.toDouble() //Assuming 
            if (maxAmplitude > 0) {
                meterLevelDb = 20 * log10(maxAmplitude / maxAudioSize)
            }
          }
          val isRecording = true
          sendRecUpdateEvent(timeMs.toDouble(), isRecording, meterLevelDb)

          _recordHandler!!.postDelayed(this, _subscriptionDurationMs.toLong())
        }
      }
      (_recorderRunnable as Runnable).run()

      //NOTE: To determine the recording settings ACTUALLY used for MediaRecorder, we need:
      // * API 24: ActiveRecordingConfiguration
      // * API 29: MediaRecorder.getActiveRecordingConfiguration()
      // Not yet ready to bump up the minimum sdk for this, 
      // so we're making some assumptions.
      // Hopefully the metadata will be in the saved files anyway.
      val grantedOptions = Arguments.createMap()
      //Cross-platform
      grantedOptions.putString(Key.audioFilePath.str, "file:///{$_audioFilePathOrURL}")
      grantedOptions.putBoolean(Key.recMeteringEnabled.str, _recMeteringEnabled)
      grantedOptions.putDouble(Key.maxRecDurationSec.str, maxRecDurationSec)
      grantedOptions.putDouble(Key.sampleRate.str, _sampleRate.toDouble())
      grantedOptions.putDouble(Key.numChannels.str, _numChannels.toDouble())
      grantedOptions.putDouble(Key.encoderBitRate.str, encoderBitRate.toDouble())
      //Android specific
      grantedOptions.putDouble(Key.androidAudioSourceId.str, audioSourceId.toDouble())
      grantedOptions.putDouble(Key.androidOutputFormatId.str, outputFormatId.toDouble())
      grantedOptions.putDouble(Key.androidAudioEncoderId.str, audioEncoderId.toDouble())
      promise.resolve(grantedOptions)
    } 
    catch (e: Exception) {
      _recStopCode = RecStopCode.Error
      val errMsg = " - Exception: " + e
      Log.e(TAG, funcName + errMsg)
      return promise.reject(funcName, errMsg)
    }
  }


  @ReactMethod
  fun pauseRecorder(promise: Promise) {
    val funcName = TAG + ".pauseRecorder()"
    Log.d(TAG, funcName)

    //If recording LPCM
    if (encodingAsLPCM(_audioFilePathOrURL)) {
      Log.d(TAG, funcName + " - calling RnAudio.pauseLPCMRecorder()")
      return pauseLPCMRecorder(promise)
    }

    //NOT recording LPCM
    
    val recorderState = getRecorderState()
    if (recorderState == RecorderState.Stopped) {
      return promise.resolve(funcName + ": Can't pause; recorder not playing.")
    }
    else if (recorderState == RecorderState.Paused) {
      return promise.resolve(funcName + ": Can't pause; recorder already paused.")
    }

    if (_mediaRecorder == null) {
      return promise.reject(funcName, "Recorder is null.")
    }
    try {
      _mediaRecorder!!.pause()
      _pausedRecordTimeMs = SystemClock.elapsedRealtime()
      _recorderRunnable?.let { _recordHandler!!.removeCallbacks(it) }
      return promise.resolve(funcName + "Recorder paused.")
    } 
    catch (e: Exception) {
      val errMsg = funcName + "- exception: " + e
      Log.e(TAG, errMsg)
      return promise.reject(funcName, errMsg)
    }
  }


  @ReactMethod
  fun resumeRecorder(promise: Promise) {
    val funcName = TAG + ".resumeRecorder()"
    Log.d(TAG, funcName)

    //If recording LPCM
    if (encodingAsLPCM(_audioFilePathOrURL)) {
      Log.d(TAG, funcName + " - calling RnAudio.resumeLPCMRecorder()")
      return resumeLPCMRecorder(promise)
    }

    //NOT recording LPCM

    val recorderState = getRecorderState()
    if (recorderState == RecorderState.Stopped) {
      return promise.resolve(funcName + ": Can't resume; recorder not playing.")
    }
    else if (recorderState == RecorderState.Recording) {
      return promise.resolve(funcName + ": Can't resume; recorder already playing.")
    }

    try {
      _totalPausedRecordTimeMs += SystemClock.elapsedRealtime() - _pausedRecordTimeMs
      _pausedRecordTimeMs = 0L
      _mediaRecorder!!.resume()
      _recorderRunnable?.let { _recordHandler!!.postDelayed(it, _subscriptionDurationMs.toLong()) }
      return promise.resolve(funcName + "Recorder resumed.")
    } 
    catch (e: Exception) {
      Log.e(TAG, "Recorder resume: " + e.message)
      return promise.reject(funcName, e.message)
    }
  }


  @ReactMethod
  fun stopRecorder(promise: Promise) {
    val funcName = TAG + ".stopRecorder()"
    Log.d(TAG, funcName)

    //If recording LPCM
    if (encodingAsLPCM(_audioFilePathOrURL)) {
      Log.d(TAG, funcName + " - calling RnAudio.stopLPCMRecorder()")
      return stopLPCMRecorder(promise)
    }

    //NOT recording LPCM

    if (_recordHandler != null) {
      _recorderRunnable?.let { _recordHandler!!.removeCallbacks(it) }
    }

    if (_mediaRecorder == null) {
      return promise.resolve(funcName + " Recorder already stopped.")
    }

    try {
      resetMediaRecorder()
      sendRecStopEvent()
    } 
    catch (e: Exception) {
      Log.d(TAG, funcName + " - " + e)
      return promise.reject(funcName, "" + e)
    }

    return promise.resolve(createRecStopResult())
  }


  // LPCM recorder methods
  // Since MediaRecorder doesn't do WAV/LPCM, we use AudioRecord-based methods below


  @ReactMethod
  public fun startLPCMRecorder(recordingOptions: ReadableMap, promise:Promise) {
    val funcName = TAG + ".startLPCMRecorder()" 
    Log.d(TAG, funcName)

    _currentlyRecordingLPCM = true
    _recStopCode = RecStopCode.Requested //Start by assuming a no-error result

    if (ensurePermissionsSecured() == false) {
      return promise.reject(PERMISSION_NOT_GRANTED_STR, TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR)
    }

    val requestedOptions = recordingOptions
    val grantedOptions = Arguments.createMap()
    if (initLPCMRecorder(requestedOptions, grantedOptions) == false) {
      return promise.reject(funcName, "Unable to initialize the recorder. Check parameters, and try again.")
    }
    Log.d(TAG, funcName+ " - granted options: " + grantedOptions)
    
    val systemTime = SystemClock.elapsedRealtime()

    _recorderRunnable = object : Runnable {
      override fun run() {
        val time = SystemClock.elapsedRealtime() - systemTime - _totalPausedRecordTimeMs
        val meterLevelDb = if (_recMeteringEnabled) calcLPCMMeterLevelDb() else MIN_METER_LEVEL_DB
        Log.d(TAG, "recMeteringEnabled: " + _recMeteringEnabled + " meterLevelDb:" + meterLevelDb)
        val isRecording = true
        sendRecUpdateEvent(time.toDouble(), isRecording, meterLevelDb)
        _recordHandler!!.postDelayed(this, _subscriptionDurationMs.toLong())
      }
    }

    _pausedRecordTimeMs = 0L
    _totalPausedRecordTimeMs = 0L
    _audioRecord!!.startRecording()

    //Add after starting
    if (_routingChangedListener != null) {
      Log.d(TAG, funcName + " Adding routing changed listener... ")
      _audioRecord!!.addOnRoutingChangedListener(_routingChangedListener, null) 
    }

    Thread {
      var fos:FileOutputStream? = null
      try {
        var frameCount = 0
        var numSamplesProcessed = 0
        _lpcmFrameData = ByteArray(_lpcmFrameBufferSize!!){0}
        _lpcmFrameDataContentSize = _lpcmFrameBufferSize //Starting value
        
        (_recorderRunnable as Runnable).run()
        fos = FileOutputStream(File(_tempRawPCMDataFilePath!!), false)
        while (_currentlyRecordingLPCM && numSamplesProcessed < _maxNumSamples) {

          //Pause loop
          while (getRecorderState() == RecorderState.Paused && _currentlyRecordingLPCM) {
            Thread.sleep(30)
          }
          //If we've broken out of the pause loop because we're
          //no longer recording, i.e: stopping, not resuming...
          if (_currentlyRecordingLPCM == false) {
              break  // While recording loop
          }

          val bytesRead = _audioRecord!!.read(_lpcmFrameData!!, 0, _lpcmFrameData!!.size)
          if (bytesRead < 0) {
            throw Exception("Error while reading AudioRecord data")
          }
          if (bytesRead > 0 && ++frameCount > 2) { // skip first 2, to eliminate "click sound"

            val bytesPerPacket:Int = _lpcmByteDepth * _numChannels
            var numSamplesToProcess:Int = bytesRead / bytesPerPacket
            if (numSamplesProcessed + numSamplesToProcess >= _maxNumSamples) {
              numSamplesToProcess = _maxNumSamples - numSamplesProcessed
              _recStopCode = RecStopCode.MaxDurationReached
            }

            _lpcmFrameDataContentSize = numSamplesToProcess * bytesPerPacket
            fos.write(_lpcmFrameData!!, 0, _lpcmFrameDataContentSize!!)

            numSamplesProcessed += numSamplesToProcess
          }
        }

        resetAudioRecord()

        fos.close()
        
        saveAsWav()
      }
      catch (e:Exception) {
        e.printStackTrace()
        _recStopCode = RecStopCode.Error
      }
      finally {

        _currentlyRecordingLPCM = false

        resetAudioRecord()
        
        if (_recordHandler != null) {
          _recorderRunnable?.let { _recordHandler!!.removeCallbacks(it) }
        }

        if (fos != null) {
          try {
            fos.close()
          } catch (e:Exception) {
            e.printStackTrace()
            _recStopCode = RecStopCode.Error
          }
        }
        
        deleteTempFile()
      
        //If we arrived here due to an error or timeout, send stop code to app.
        if (_recStopCode !== RecStopCode.Requested) {
          sendRecStopEvent()
        }
      }
    }.start()
  
    return promise.resolve(grantedOptions)
  }


  @ReactMethod
  fun pauseLPCMRecorder(promise: Promise) {
    val funcName = TAG + ".pauseLPCMRecorder()" 
    Log.d(TAG, funcName)

    if (_audioRecord == null) {
      return promise.reject(funcName, "audioRecord was null on pause.")
    }

    val recorderState = getRecorderState()
    if (recorderState !== RecorderState.Recording) {
      return promise.resolve(funcName + ": Can't pause; not recording")
    }
    else if (recorderState == RecorderState.Paused) {
      return promise.resolve(funcName + ": Can't pause; already paused")
    }

    try {
      Log.d(TAG, funcName + " - removing record callbacks")
      _pausedRecordTimeMs = SystemClock.elapsedRealtime()
      _recorderRunnable?.let { _recordHandler!!.removeCallbacks(it) }
      return promise.resolve(funcName + ": Paused wav recording")
    } 
    catch (e: Exception) {
      Log.e(TAG, funcName + " - exception: " + e.message)
      return promise.reject(funcName + " - Error: ", e.message)
    }      
  }


  @ReactMethod
  fun resumeLPCMRecorder(promise: Promise) {
    val funcName = TAG + ".resumeLPCMRecorder()"
    Log.d(TAG, funcName)

    val recorderState = getRecorderState()
    if (recorderState == RecorderState.Stopped) {
      return promise.resolve(funcName + ": Can\'t resume; recorder not recording")
    }
    else if (recorderState != RecorderState.Paused) {
      Log.d(TAG, "   audioRecorderIsPaused() == false")
      return promise.resolve(funcName+ ": Can\'t resume; recorder was not paused")
    }

    try {
      _totalPausedRecordTimeMs += SystemClock.elapsedRealtime() - _pausedRecordTimeMs
      _pausedRecordTimeMs = 0L
      _recorderRunnable?.let { _recordHandler!!.postDelayed(it, _subscriptionDurationMs.toLong()) }
      return promise.resolve(funcName + ": Wav recording resumed.")
    } 
    catch (e: Exception) {
      Log.e(TAG, "resumeWavRecorder Error: " + e.message)
      return promise.reject(funcName + " - Error: ", e.message)
    } 
  }


  @ReactMethod
  fun stopLPCMRecorder(promise: Promise) {
    val funcName = TAG + ".stopLPCMRecorder()" 
    Log.d(TAG, funcName)

    if (_recordHandler != null) {
      Log.d(TAG, funcName + " - removing record callbacks")
      _recorderRunnable?.let { _recordHandler!!.removeCallbacks(it) }
    }

    if (getRecorderState() == RecorderState.Stopped) {
      return promise.resolve(funcName + " - recorder already stopped (audioRecord is null).")
    }

    //Clarify cause of stoppage
    _recStopCode = RecStopCode.Requested

    //This clears a flag; actually stopping the recorder
    //and informing the UI happens in thread launched from startLPCMRecorder()
    _currentlyRecordingLPCM = false

    //Wait for recorder thread to stop
    while (getRecorderState() != RecorderState.Stopped) {
      Log.d(TAG, funcName + ": Waiting for recorder to stop...")
      Thread.sleep(10)
    }

    sendRecStopEvent()

    return promise.resolve(createRecStopResult())
  }


  // Player methods


  //setPlayerVolume()
  //  * MediaPlayer must exist before calling this! Consider using startPlayer's playbackVolume 
  //    parameter instead of calling this.
  //  * relative to 100% of Media Volume
  @ReactMethod
  fun setPlayerVolume(volume: Double, promise: Promise) {
    val funcName = TAG + ".setPlayerVolume()"
    Log.d(TAG, funcName)
    if (getPlayerState() === PlayerState.Stopped) {
      return promise.reject(funcName, "Can\'t set volume; player stopped.")
    }
    try {
      setPlayerVolume(volume)
      return promise.resolve(funcName + " - volume set.")
    }
    catch (e: Exception) {
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(TAG, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }  
  }
  fun setPlayerVolume(volume: Double) {
    val mVolume = volume.toFloat()
    _mediaPlayer!!.setVolume(mVolume, mVolume)  // Left, right
  }


  @ReactMethod
  fun startPlayer(fileNameOrPathOrUrl: String, httpHeaders: ReadableMap?, playbackVolume:Double, promise: Promise) {
    val funcName = TAG + ".startPlayer()"
    Log.d(TAG, funcName)

    val playerState = getPlayerState()
    if (playerState == PlayerState.Playing) {
      val errMsg = funcName + " - Player already running"
      Log.e(TAG, errMsg)
      return promise.reject(funcName, errMsg)
    }
    else if (playerState == PlayerState.Paused) {
      _mediaPlayer?.start()
      return promise.resolve(_audioFilePathOrURL)
    }
    else { //PlayerState.Stopped
      _mediaPlayer = MediaPlayer()
    }

    //Set volume
    try {
      setPlayerVolume(playbackVolume)
    }
    catch (e: Exception) {
      sendPlayStopEvent(PlayStopCode.Error)
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(TAG, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }

    // NOTE: If rawFileNameOrPathOrURL is "DEFAULT"/""/null, defaults to non-wav, here; this could go wrong...
    var resolvedFilePathOrUrl = 
      resolveFilePathOrURL(rawFileNameOrPathOrURL = fileNameOrPathOrUrl, isWav = false)
    
    try {
      if (httpHeaders != null) {
        val headers: MutableMap<String, String?> = HashMap<String, String?>()
        val iterator = httpHeaders.keySetIterator()
        while (iterator.hasNextKey()) {
          val key = iterator.nextKey()
          headers.put(key, httpHeaders.getString(key))
        }
        _mediaPlayer!!.setDataSource(
          currentActivity!!.applicationContext, 
          Uri.parse(resolvedFilePathOrUrl), 
          headers
        )
      } 
      else {
        _mediaPlayer!!.setDataSource(resolvedFilePathOrUrl)
      }
      
      _mediaPlayer!!.setOnPreparedListener({ mp ->
        Log.d(TAG, "mediaplayer prepared and start")
        mp.start()
        //Set timer task to send event to RN.
        _playUpdateTimerTask = object : TimerTask() {
          override fun run() {
            try {  
              val elapsedMs = mp?.currentPosition  // This can throw IllegalStateExceptions
              val durationMs = mp?.duration  // This can throw IllegalStateExceptions
              if (elapsedMs != null && durationMs != null) {
                sendPlayUpdateEvent(elapsedMs, durationMs)
              }
            } catch (e:Exception) {
              Log.e(TAG, TAG+"."+funcName+".playTimerTask.run() - " + e)
            }
          }
        }
        _playUpdateTimer = Timer()
        _playUpdateTimer!!.schedule(_playUpdateTimerTask, 0, _subscriptionDurationMs.toLong())
      })

      _mediaPlayer!!.setOnErrorListener { _, what, extra ->
        val fn = TAG + "mediaPlayer.onErrorListener()"
        Log.d(TAG, fn)
        Log.d(TAG, fn + " - what: " + what + "  extra: " + extra)
        //Reset player
        _playUpdateTimer?.cancel()
        resetMediaPlayer()
        //Send event 
        sendPlayStopEvent(PlayStopCode.Error)
        true
      }

      //Detect when finish playing
      _mediaPlayer!!.setOnCompletionListener { _ ->
        Log.d(TAG, funcName + " completion listener: Playback completed.")
        //Reset player
        _playUpdateTimer?.cancel()
        resetMediaPlayer()
        //Send event 
        sendPlayStopEvent(PlayStopCode.MaxDurationReached)
      }

      //Add route change listener
      if (_routingChangedListener != null) {
        Log.d(TAG, funcName + " Adding routing changed listener... ")
        _mediaPlayer!!.addOnRoutingChangedListener(_routingChangedListener, null) 
      }

      _mediaPlayer!!.prepare()

      return promise.resolve(resolvedFilePathOrUrl)
    } 
    catch (e:Exception) { 
      sendPlayStopEvent(PlayStopCode.Error)
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(TAG, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }


  @ReactMethod
  fun pausePlayer(promise: Promise) {
    val funcName = TAG + ".pausePlayer()"
    Log.d(TAG, funcName)
    val playerState = getPlayerState()
    val msgPrefix = funcName + ": "
    if (playerState == PlayerState.Stopped) {
      val msg = "Can\'t pause; player is stopped."
      Log.d(TAG, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    else if (playerState == PlayerState.Paused) {
      val msg = "Player already paused."
      Log.d(TAG, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    try {
      _mediaPlayer!!.pause()
      return promise.resolve("pause player")
    } 
    catch (e:Exception) {
      val errMsg = "Error: " + e.message
      Log.e(TAG, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }


  @ReactMethod
  fun resumePlayer(promise: Promise) {
    val funcName = TAG + ".resumePlayer()"
    Log.d(TAG, funcName)
    val playerState = getPlayerState()
    val msgPrefix = funcName + ": "
    if (playerState == PlayerState.Stopped) {
      val msg = "Can\'t resume; player stopped."
      Log.d(TAG, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    else if (playerState == PlayerState.Playing) {
      val msg = "Player already playing."
      Log.d(TAG, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    try {
      _mediaPlayer!!.seekTo(_mediaPlayer!!.currentPosition)
      _mediaPlayer!!.start()
      return promise.resolve(funcName + " - resuming player")
    } 
    catch (e:Exception) {
      val errMsg = "Error: " + e.message
      Log.e(TAG, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }


  @ReactMethod
  fun stopPlayer(promise: Promise) {
    val funcName = TAG + ".stopPlayer()"
    Log.d(TAG, funcName)
    if (_playUpdateTimer != null) {
      _playUpdateTimer!!.cancel()
    }
    if (getPlayerState() == PlayerState.Stopped) {
      return promise.resolve(funcName + " - Player already stopped")
    }
    try { 
      sendPlayStopEvent(PlayStopCode.Requested)
      resetMediaPlayer()
      return promise.resolve(funcName + " - Stopped player.")
    } catch (e:Exception) {
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(TAG, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }


  @ReactMethod
  fun seekToPlayer(time: Double, promise: Promise) {
    val funcName = TAG + ".seekToPlayer()"
    Log.d(TAG, funcName)
    if (getPlayerState() == PlayerState.Stopped) {
      return promise.reject(funcName, "Player stopped on seek.")
    }
    try {
      _mediaPlayer!!.seekTo(time.toInt())
    }
    catch (e:Exception) {
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(TAG, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
    return promise.resolve(funcName + ": Seek successful")
  }


  @ReactMethod
  fun setSubscriptionDuration(sec: Double, promise: Promise) {
    val funcName = TAG + ".setSubscriptionDuration()"
    Log.d(TAG, funcName)
    _subscriptionDurationMs = (sec * 1000).toInt()
    return promise.resolve(funcName + " - Set subscription duration: $_subscriptionDurationMs")
  }


  // Helper methods


  private fun resolveFilePathOrURL(rawFileNameOrPathOrURL: String?, isWav:Boolean):String {
    val funcName = TAG + ".resolveFilePathOrURL()"
    Log.d(TAG, funcName)
    val v = rawFileNameOrPathOrURL
    if (v != null &&
        (v.startsWith("http://") || 
         v.startsWith("https://") || 
         v.startsWith("file://") ||
         v.startsWith("/") ||
         v.startsWith("./") ||
         v.startsWith("../"))) {
      return v
    }
    else if (v != null && v != "" && v != DEFAULT_FILE_NAME_PLACEHOLDER) {
      return "${reactContext.cacheDir}/$v"
    }
    // Could do more to provide the right filename based on knowing
    // the encoding...
    else if (isWav) {
      return "${reactContext.cacheDir}/$DEFAULT_WAV_FILE_NAME"
    }
    else {
      return "${reactContext.cacheDir}/$DEFAULT_FILE_NAME"
    }
  }


  private fun createRecStopResult(): WritableMap {
    val obj = Arguments.createMap()
    obj.putString(Key.recStopCode.str, _recStopCode.str)
    obj.putString(Key.audioFilePath.str, "file:///${_audioFilePathOrURL}")
    return obj
  }
  private fun sendRecStopEvent() {
    sendEvent(reactContext, Event.RecStop.str, createRecStopResult())
  }


  private fun sendRecUpdateEvent(elapsedMs:Double, isRecording:Boolean, meterLevelDb:Double) {
    val obj = Arguments.createMap()
    obj.putDouble(Key.recElapsedMs.str, elapsedMs)
    obj.putBoolean(Key.isRecording.str, isRecording)
    if (_recMeteringEnabled) {
      obj.putDouble(Key.recMeterLevelDb.str, meterLevelDb)
    }
    sendEvent(reactContext, Event.RecUpdate.str, obj)
  }


  private fun createPlayStopResult(playStopCode: PlayStopCode): WritableMap {
    val obj = Arguments.createMap()
    obj.putString(Key.playStopCode.str, playStopCode.str)
    obj.putString(Key.audioFileNameOrPath.str, "file:///${_audioFilePathOrURL}")
    return obj
  }
  private fun sendPlayStopEvent(playStopCode: PlayStopCode) {
    sendEvent(reactContext, Event.PlayStop.str, createPlayStopResult(playStopCode))
  }


  private fun sendPlayUpdateEvent(elapsedMs:Int, durationMs:Int) {
    val obj = Arguments.createMap()
    obj.putDouble(Key.playElapsedMs.str, elapsedMs.toDouble())
    obj.putDouble(Key.playDurationMs.str, durationMs.toDouble())
    sendEvent(reactContext, Event.PlayUpdate.str, obj)
  }


  fun resetMediaRecorder() {
    val funcName = TAG + ".resetMediaRecorder()"
    Log.d(TAG, funcName)

    //Seems heavy-handed, but Android's fragility is ridiculous.
    try {
      _mediaRecorder?.stop()
    } catch (e:Exception) {
      Log.e(TAG, funcName + " - Trouble calling MediaRecorder.stop(): " + e)
    }
    try {
      _mediaRecorder?.reset()
    } catch (e:Exception) {
      Log.e(TAG, funcName + " - Trouble calling MediaRecorder.reset(): " + e)
    }
    try {
      _mediaRecorder?.release()
    } catch (e:Exception) {
      Log.e(TAG, funcName + " - Trouble calling MediaRecorder.release(): " + e)
    }
    _mediaRecorder = null
  }


  private fun resetAudioRecord() {
    val funcName = TAG + ".resetAudioRecord()"
    Log.d(TAG, funcName)
    //Seems heavy-handed, but Android's fragility is ridiculous.
    try {
      _audioRecord?.stop()
    } catch (e:Exception) {
      Log.e(TAG, "Trouble calling audioRecord.stop(): ", e)
    }
    try {
      _audioRecord?.release()
    } catch (e:Exception) {
      Log.e(TAG, "Trouble calling audioRecord.release(): ", e)
    }
    finally {
      _audioRecord = null
    }
  }


  private fun resetMediaPlayer() {
    val funcName = TAG + ".resetMediaPlayer()"
    Log.d(TAG, funcName)
    //Seems heavy-handed, but Android's fragility is ridiculous.
    try {
      _mediaPlayer?.stop()
    } catch (e:Exception) {
      Log.e(TAG, funcName + " - Trouble calling MediaPlayer.stop(): " + e)
    }
    try {
      _mediaPlayer?.reset()
    } catch (e:Exception) {
      Log.e(TAG, funcName + " - Trouble calling MediaPlayer.reset(): " + e)
    }
    try {
      _mediaPlayer?.release()
    } catch (e:Exception) {
      Log.e(TAG, funcName + " - Trouble calling MediaPlayer.release(): " + e)
    }
    _mediaPlayer = null
  }


  private fun encodingAsLPCM(fileNameOrPathOrUrl:String): Boolean {
    val funcName = "RnAudio.encodingAsLPCM()"
    Log.d(TAG, funcName)

    //TODO: Should this be filename-based? Encoding based? Combination?

    //If filename ends with .wav
    val ignoreCase = true
    if (fileNameOrPathOrUrl.endsWith(".wav", ignoreCase)) {
      return true
    }
    
    return false
  }


  private fun initLPCMRecorder(requestedOptions: ReadableMap, 
                       grantedOptions: WritableMap):Boolean {
    val funcName = TAG + ".initLPCMRecorder()"

    Log.d(TAG, funcName)

    Log.d(TAG, funcName + " - Requested recording options:")
    Log.d(TAG, " " + requestedOptions)
    Log.d(TAG, " ")

    //Set/coerce recording options
    val ro = requestedOptions
    _audioFilePathOrURL = resolveFilePathOrURL(
      rawFileNameOrPathOrURL = (if (ro.hasKey(Key.audioFileNameOrPath.str)) ro.getString(Key.audioFileNameOrPath.str)!! else DEFAULT_FILE_NAME_PLACEHOLDER),
      isWav = true // is a wav file
    )
    _recMeteringEnabled = if (ro.hasKey(Key.recMeteringEnabled.str)) ro.getBoolean(Key.recMeteringEnabled.str) else true
    _sampleRate = if (ro.hasKey(Key.sampleRate.str)) ro.getInt(Key.sampleRate.str) else 44100
    _numChannels = if (ro.hasKey(Key.numChannels.str)) ro.getInt(Key.numChannels.str) else 1
    var maxRecDurationSec = if (ro.hasKey(Key.maxRecDurationSec.str)) ro.getDouble(Key.maxRecDurationSec.str) else DEFAULT_MAX_RECORDING_DURATION_SEC
    _maxNumSamples = _sampleRate * maxRecDurationSec.toInt()
    //Android specific
    val audioSourceId = if (ro.hasKey(Key.androidAudioSourceId.str)) ro.getInt(Key.androidAudioSourceId.str) else MediaRecorder.AudioSource.MIC
    val outputFormatId = if (ro.hasKey(Key.androidOutputFormatId.str)) ro.getInt(Key.androidOutputFormatId.str) else 999 //Co-opting 999 for WAV
    val audioEncoderId = if (ro.hasKey(Key.androidAudioEncoderId.str)) ro.getInt(Key.androidAudioEncoderId.str) else 999 //Co-opting 999 for LPCM
    //Android WAV/LPCM-specific
    _lpcmByteDepth = if (ro.hasKey(Key.lpcmByteDepth.str)) ro.getInt(Key.lpcmByteDepth.str) else 2

    Log.d(TAG, " ")
    Log.d(TAG, "Coerced:")
    Log.d(TAG, "  audioFilePathOrURL: " + _audioFilePathOrURL)
    Log.d(TAG, "  recMeteringEnabled: " + _recMeteringEnabled)
    Log.d(TAG, "  maxRecDurationSec: " + maxRecDurationSec)
    Log.d(TAG, "  sampleRate:" + _sampleRate)
    Log.d(TAG, "  numChannels:" + _numChannels)
    Log.d(TAG, "  audioSourceId: " + audioSourceId)
    Log.d(TAG, "  outputFormatId: " + outputFormatId)
    Log.d(TAG, "  audioEncoderId: " + audioEncoderId)
    Log.d(TAG, "  _lpcmByteDepth:" + _lpcmByteDepth)
    Log.d(TAG, " ") 
    Log.d(TAG, "  _maxNumSamples:" + _maxNumSamples)

    _tempRawPCMDataFilePath = "${reactContext.cacheDir}" + "/" + "temp.lpcm"
    
    val minFrameBufferSize = AudioRecord.getMinBufferSize(_sampleRate,
                                                          getAudioFormatChannelConfig(),
                                                          getAudioFormatPCMEncoding())

    if (minFrameBufferSize < 0) {
      if (minFrameBufferSize == AudioRecord.ERROR_BAD_VALUE) {
        Log.e(TAG, funcName + " - Error: minFrameBufferSize == " + 
                    AudioRecord.ERROR_BAD_VALUE + 
                    ". Recording parameters not supported by hardware, or invalid parameter passed.")
      }
      if (minFrameBufferSize == AudioRecord.ERROR) {
        Log.e(TAG, funcName + " - Error: minFrameBufferSize == " + 
                    AudioRecord.ERROR + 
                    ". Implementation unable to query hardware for input properties.")
      }
      return false
    }
    _lpcmFrameBufferSize = minFrameBufferSize * 2

    try {
      _audioRecord = AudioRecord(audioSourceId,
                                 _sampleRate,
                                 getAudioFormatChannelConfig(),
                                 getAudioFormatPCMEncoding(),
                                 _lpcmFrameBufferSize!!)
    }
    catch (e:Exception) {
      Log.e(TAG, e.toString())
      return false
    }

    if (_audioRecord!!.getState() != AudioRecord.STATE_INITIALIZED) {
      Log.e(TAG, funcName + "Error: Attempt to initialize AudioRecord failed.")
      return false
    }

    if (AutomaticGainControl.isAvailable()) {
      val agc = AutomaticGainControl.create(_audioRecord!!.getAudioSessionId())
      agc.setEnabled(false)
    }

    //Certain *granted* parameters may differ from *requested* parameters
    //update these parameters from the AudioRecord instance.
    _sampleRate = _audioRecord!!.getSampleRate()
    _numChannels = _audioRecord!!.getChannelCount()
    _lpcmByteDepth = if (_audioRecord!!.getAudioFormat() == android.media.AudioFormat.ENCODING_PCM_8BIT) 1 else 2

    //Granted parameters: 
    //Cross-platform 
    grantedOptions.putString(Key.audioFilePath.str, "file:///${_audioFilePathOrURL}")
    grantedOptions.putBoolean(Key.recMeteringEnabled.str, _recMeteringEnabled)
    grantedOptions.putDouble(Key.maxRecDurationSec.str, maxRecDurationSec)
    grantedOptions.putDouble(Key.sampleRate.str, _sampleRate.toDouble())
    grantedOptions.putDouble(Key.numChannels.str, _numChannels.toDouble())
    //Android-specific
    grantedOptions.putDouble(Key.androidAudioSourceId.str, audioSourceId.toDouble())
    grantedOptions.putDouble(Key.androidOutputFormatId.str, outputFormatId.toDouble())
    grantedOptions.putDouble(Key.androidAudioEncoderId.str, audioEncoderId.toDouble())
    //Android WAV/LPCM-specific
    grantedOptions.putDouble(Key.lpcmByteDepth.str, _lpcmByteDepth.toDouble())

    return true
  }


  private fun saveAsWav() {
    val funcName = TAG + ".saveAsWav()" 
    Log.d(TAG, funcName)

    if (_tempRawPCMDataFilePath == null  || _audioFilePathOrURL == "" || _audioFilePathOrURL == "DEFAULT") {
      throw Exception(funcName+ ": Null or empty file path.")
    }

    Log.d(TAG, funcName + ": Saving " + _audioFilePathOrURL + "...")

    //Write wav file
    //Approach: https://medium.com/@sujitpanda/file-read-write-with-kotlin-io-31eff564dfe3
    var fileInputStream = FileInputStream(_tempRawPCMDataFilePath!!)
    var fileOutputStream = FileOutputStream(File(_audioFilePathOrURL), false)
    fileInputStream.use { fis:FileInputStream ->
      fileOutputStream.use { fos:FileOutputStream ->
        //Header
        val numSampleDataBytes:Long = fis.getChannel().size()
        addWavHeader(fileOutputStream, numSampleDataBytes)
        //Data
        fileInputStream.copyTo(fileOutputStream)
        Log.d(TAG, funcName + ": wav file path:" + _audioFilePathOrURL)
        Log.d(TAG, funcName + ": wav file size:" + fos.getChannel().size())
        fos.flush()
        fos.close()
      }
      Log.d(TAG, funcName + ": Closing input file.")
      fileInputStream.close()
    }
    Log.d(TAG, funcName + ": Done save.")
  }


  private fun toByte(c:Char):Byte {
    return c.code.toByte() 
  }


  private fun addWavHeader(fileOutputStream:FileOutputStream, numSampleDataBytes:Long) {
      val funcName = TAG + ".addWavHeader()" 
      Log.d(TAG, funcName)

      val byteRate:Int = _sampleRate * _numChannels * _lpcmByteDepth
      val blockAlign:Int = _numChannels * _lpcmByteDepth

      val numHeaderBytes:Int = 44
      val header:ByteArray = ByteArray(numHeaderBytes)
      val numWavFileBytesLess8:Long = numSampleDataBytes + numHeaderBytes - 8

      header[0] = toByte('R')                                    // RIFF chunk
      header[1] = toByte('I')
      header[2] = toByte('F')
      header[3] = toByte('F')
      header[4] = (numWavFileBytesLess8 and 0xff).toByte()   //File Size, less 8 (for RIFF + file size)
      header[5] = ((numWavFileBytesLess8 shr 8) and 0xff).toByte()
      header[6] = ((numWavFileBytesLess8 shr 16) and 0xff).toByte()
      header[7] = ((numWavFileBytesLess8 shr 24) and 0xff).toByte()
      header[8] = toByte('W')                                  // WAVE chunk
      header[9] = toByte('A')
      header[10] = toByte('V')
      header[11] = toByte('E')
      header[12] = toByte('f')                                   // 'fmt ' chunk
      header[13] = toByte('m')
      header[14] = toByte('t')
      header[15] = toByte(' ')
      header[16] = 16.toByte()                                    // 4 bytes: size of 'fmt ' chunk
      header[17] = 0.toByte()
      header[18] = 0.toByte()
      header[19] = 0.toByte()
      header[20] = 1.toByte()                                     // format = 1 for PCM
      header[21] = 0.toByte()
      header[22] = (_numChannels and 0xFF).toByte()                       // mono or stereo
      header[23] = 0.toByte()
      header[24] = (_sampleRate and 0xff).toByte()            // samples per second
      header[25] = ((_sampleRate shr 8) and 0xff).toByte()
      header[26] = ((_sampleRate shr 16) and 0xff).toByte()
      header[27] = ((_sampleRate shr 24) and 0xff).toByte()
      header[28] = (byteRate and 0xff).toByte()              // bytes per second
      header[29] = ((byteRate shr 8) and 0xff).toByte()
      header[30] = ((byteRate shr 16) and 0xff).toByte()
      header[31] = ((byteRate shr 24) and 0xff).toByte()
      header[32] = blockAlign.toByte()                     // bytes in one sample, for all channels
      header[33] = 0.toByte()
      header[34] = (_lpcmByteDepth * 8).toByte()                  // bits in (one channel of a) sample
      header[35] = 0.toByte()
      header[36] = toByte('d')                                   // beginning of the data chunk
      header[37] = toByte('a')
      header[38] = toByte('t')
      header[39] = toByte('a')
      header[40] = (numSampleDataBytes and 0xff).toByte()         // how big is this data chunk
      header[41] = ((numSampleDataBytes shr 8) and 0xff).toByte()
      header[42] = ((numSampleDataBytes shr 16) and 0xff).toByte()
      header[43] = ((numSampleDataBytes shr 24) and 0xff).toByte()

      fileOutputStream.write(header, 0, 44)
  }


  private fun deleteTempFile() {
    val funcName = TAG + ".deleteTempFile()" 
    Log.d(TAG, funcName)
    if (_tempRawPCMDataFilePath != null) {
      val f:File = File(_tempRawPCMDataFilePath!!)
      f.delete()
    }
  }


  private fun getAudioFormatChannelConfig():Int {
    if (_numChannels == 2) {
      return AudioFormat.CHANNEL_IN_STEREO
    }
    else {
      return AudioFormat.CHANNEL_IN_MONO
    }
  }


  private fun getAudioFormatPCMEncoding():Int {
    if (_lpcmByteDepth == 2) {
      return AudioFormat.ENCODING_PCM_16BIT
    }
    else {
      return AudioFormat.ENCODING_PCM_8BIT
    }
  }


  private fun calcLPCMMeterLevelDb():Double { //channels interleaved
    val funcName = TAG + ".calcLPCMMeterLevelDb()"
    Log.d(TAG, funcName)

    // * Output in dBFS: dB relative to full scale
    // * Only includes contributions of channel-1 samples

    var sumVolume:Double = 0.0
    val numBytes:Int = _lpcmFrameDataContentSize!!
    var numSamples:Int = numBytes / (_lpcmByteDepth * _numChannels)
    if (_lpcmByteDepth == 2) {
      val bufferInt16:ShortArray = ShortArray(numSamples * _numChannels)
      val byteBuffer:ByteBuffer = ByteBuffer.wrap(_lpcmFrameData!!, 0, numBytes)
      byteBuffer.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(bufferInt16)
      for (i in 0..(numSamples-1)) {
        sumVolume += Math.abs((bufferInt16[i * _numChannels]).toDouble())
      }
    }
    else { //_lpcmByteDepth of 1
      for (i in 0..(numSamples-1)) {
        var s = (_lpcmFrameData!![i * _numChannels].toInt() and 0xFF) - 127        
        sumVolume +=  Math.abs(s.toDouble())
      }
    }

    var avgVolume:Double = sumVolume / numSamples
    if (_lpcmByteDepth == 1) {
      avgVolume /= Byte.MAX_VALUE.toDouble()
    } 
    else { //_lpcmByteDepth == 2
      avgVolume /= Short.MAX_VALUE.toDouble()
    }

    var dbFS:Double = 0.0 //Discontinuity at 0
    if (avgVolume > 0.0) {
      dbFS = 20 * Math.log10(avgVolume)
    }

    if (dbFS < MIN_METER_LEVEL_DB) {
      dbFS = MIN_METER_LEVEL_DB
    }
    if (dbFS > MAX_METER_LEVEL_DB) {
      dbFS = MAX_METER_LEVEL_DB
    }

    return dbFS
  }

}
