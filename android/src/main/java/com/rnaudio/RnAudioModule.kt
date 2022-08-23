package com.rnaudio

import android.media.AudioFormat
import android.media.AudioRecord
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
    private val tag = "RnAudio"  // Keep up-to-date, if module name changes!
    private val DEFAULT_FILENAME_PLACEHOLDER = "DEFAULT"
    private val DEFAULT_FILE_NAME = "recording.mp4"
    private val DEFAULT_WAV_FILE_NAME = "recording.wav"
  }

  override fun getName(): String {
    return tag
  }

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

  enum class EventDetailKey(val str: String) {
    IsMuted("isMuted"),
    IsRecording("isRecording"),
    RecStopCode("recStopCode"),
    PlayStopCode("playStopCode"),
    RecElapsedMs("recElapsedMs"),
    RecMeterLevel("recMeterLevel"),
    PlayElapsedMs("playElapsedMs"),
    PlayDurationMs("playDurationMs"),
  }

  //Misc. Keys - for event details, and resolved promise values
  //Cross-platform
  private val audioFilePathKey = "audioFilePath"
  private val recMeteringEnabledKey = "recMeteringEnabled"
  private val maxRecDurationSecKey = "maxRecDurationSec"
  private val sampleRateKey = "sampleRate"
  private val numChannelsKey = "numChannels"
  private val lpcmByteDepthKey = "lpcmByteDepth"
  //Android-specific
  private val androidAudioSourceIdKey = "androidAudioSourceId"
  private val androidOutputFormatIdKey = "androidOutputFormatId"
  private val androidAudioEncoderIdKey = "androidAudioEncoderId"
  private val androidAudioEncodingBitRateKey = "androidAudioEncodingBitRate"
 
  private var audioFileURL:String = ""
  private var recMeteringEnabled = false
  private var sampleRate:Int = 44100
  private var numChannels:Int = 1

  //Playback
  private var mediaPlayer: MediaPlayer? = null
  private var playStopCode = PlayStopCode.Requested
  private var playUpdateTimerTask: TimerTask? = null
  private var playUpdateTimer: Timer? = null

  //Recording
  private var recStopCode = RecStopCode.Requested  // Updated while recording. Sent in event msg, and in response to stopRecorder request
  @Volatile private var pausedRecordTimeMs = 0L  //Value of 0 used secondarily to signify "not paused"
  private var totalPausedRecordTimeMs = 0L
  //Non-LPCM recording
  private var mediaRecorder: MediaRecorder? = null
  private var recorderRunnable: Runnable? = null
  var recordHandler: Handler? = Handler(Looper.getMainLooper())
  private var subscriptionDurationMs = DEFAULT_SUBSCRIPTION_DURATION_MS
  //LPCM recording
  private var lpcmByteDepth:Int = 2
  private var maxNumSamples:Int = 0  // Note: Int affords >> 4hrs @ 48000 samples/sec
  private var audioRecord:AudioRecord? = null
  private var lpcmFrameBufferSize:Int? = null
  private var lpcmFrameData:ByteArray? = null
  private var lpcmFrameDataContentSize:Int? = null
  @Volatile private var currentlyRecordingLPCM:Boolean = false  // Recording thread polls this to see if done
  private var tempRawPCMDataFilePath:String? = null

  //This is just a fallback; ReactNative's PermissionsAndroid should be invoked from main application code
  //Challenges:
  //https://stackoverflow.com/questions/60299621/how-to-use-onrequestpermissionsresult-to-handle-permissions-in-react-native-andr
  //https://stackoverflow.com/questions/32714787/android-m-permissions-onrequestpermissionsresult-not-being-called
  //https://stackoverflow.com/questions/44960363/how-do-you-implement-permissionawareactivity-for-react-native
  private fun ensurePermissionsSecured():Boolean {
    Log.d(tag, "RnAudio.ensurePermissionsSecured()")
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&  // Marshmellow - API 23
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
      Log.w(tag, e.toString())
      return false
    }
    return true
  }

  //This isn't getting called. Even if it could be, its MESSY. See links above.
   override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray): Boolean {
    Log.d(tag, "RnAudio.onRequestPermissionsResult()")
    
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
    val funcName = tag + ".sendEvent()" 
    Log.d(tag, funcName)
    reactContext
      .getJSModule<RCTDeviceEventEmitter>(RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  private fun createRecStopResult(): WritableMap {
    val obj = Arguments.createMap()
    obj.putString(EventDetailKey.RecStopCode.str, recStopCode.str)
    obj.putString(audioFilePathKey, "file:///$audioFileURL")
    return obj
  }
  private fun sendRecStopEvent() {
    sendEvent(reactContext, Event.RecStop.str, createRecStopResult())
  }

  private fun sendRecUpdateEvent(elapsedMs:Double, isRecording:Boolean, meterLevelDb:Double) {
    val obj = Arguments.createMap()
    obj.putDouble(EventDetailKey.RecElapsedMs.str, elapsedMs)
    obj.putBoolean(EventDetailKey.IsRecording.str, isRecording)
    if (recMeteringEnabled) {
      obj.putDouble(EventDetailKey.RecMeterLevel.str, meterLevelDb)
    }
    sendEvent(reactContext, Event.RecUpdate.str, obj)
  }

  private fun createPlayStopResult(playStopCode: PlayStopCode): WritableMap {
    val obj = Arguments.createMap()
    obj.putString(EventDetailKey.PlayStopCode.str, playStopCode.str)
    obj.putString(audioFilePathKey, "file:///$audioFileURL")
    return obj
  }
  private fun sendPlayStopEvent(playStopCode: PlayStopCode) {
    sendEvent(reactContext, Event.PlayStop.str, createPlayStopResult(playStopCode))
  }

  private fun sendPlayUpdateEvent(elapsedMs:Int, durationMs:Int) {
    val obj = Arguments.createMap()
    obj.putDouble(EventDetailKey.PlayElapsedMs.str, elapsedMs.toDouble())
    obj.putDouble(EventDetailKey.PlayDurationMs.str, durationMs.toDouble())
    sendEvent(reactContext, Event.PlayUpdate.str, obj)
  }


  @ReactMethod
  fun getRecorderState(promise: Promise) {
    return promise.resolve(getRecorderState().str)
  }
  fun getRecorderState():RecorderState {
      Log.d(tag, "getRecorderState()")

    if (encodingAsLPCM(audioFileURL)) {
      if (audioRecord == null) {
        Log.d(tag, "  getRecorderState() - stopped")
        return RecorderState.Stopped
      }
      else if (pausedRecordTimeMs != 0L) {
        Log.d(tag, "  getRecorderState() - paused")
        return RecorderState.Paused
      }
      Log.d(tag, "  getRecorderState() - recording")
      //Should this factor into "recording"?
      //audioRecordState == AudioRecord.RECORDSTATE_RECORDING ||
      //audioRecordState == AudioRecord.READ_NON_BLOCKING ||
      //audioRecordState == AudioRecord.READ_BLOCKING
      return RecorderState.Recording
    }
    else {
      if (mediaRecorder == null) {
        Log.d(tag, "  getRecorderState() - stopped")
        return RecorderState.Stopped
      }
      else if (pausedRecordTimeMs != 0L) {
        Log.d(tag, "  getRecorderState() - paused")
        return RecorderState.Paused
      }
      Log.d(tag, "  getRecorderState() - recording")
      return RecorderState.Recording
    }
  }


  @ReactMethod
  fun getPlayerState(promise: Promise) {
    return promise.resolve(getPlayerState().str)
  }
  fun getPlayerState():PlayerState {
    //Use mediaPlayer!!.currentPosition > 1 to disambiguate paused?
    if (mediaPlayer == null) {
      return PlayerState.Stopped
    }
    else if (mediaPlayer!!.isPlaying) {
      return PlayerState.Playing
    }
    return PlayerState.Paused
  }


  @ReactMethod
  fun startRecorder(recordingOptions: ReadableMap, promise: Promise) {
    val funcName = tag + ".startRecorder()"
    Log.d(tag, funcName)

    Log.d(tag, funcName + 'A')

    val ro = recordingOptions
    val fileNamePathOrUrl = if (ro.hasKey(audioFilePathKey)) ro.getString(audioFilePathKey)!! else DEFAULT_FILENAME_PLACEHOLDER

    //If recording LPCM
    if (encodingAsLPCM(fileNamePathOrUrl)) {
      Log.d(tag, funcName + " - calling RnAudio.startLPCMRecorder()")
      return startLPCMRecorder(recordingOptions, promise)
    }

    Log.d(tag, funcName + 'B')


    //NOT recording LPCM

    if (mediaRecorder != null) {
      return promise.reject(funcName, "mediaRecorder currently exists.")
    }

    currentlyRecordingLPCM = false
    recStopCode = RecStopCode.Requested //Start by assuming a no-error result

    //Ensure permissions available    
    if (ensurePermissionsSecured() == false) {
      return promise.reject(funcName, PERMISSION_NOT_GRANTED_STR + TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR)
    }

    Log.d(tag, funcName+ " - Requested recording options:")
    Log.d(tag, " " + recordingOptions)

    //Set/coerce recording options

    //Cross-platform
    this.audioFileURL = constructAudioFileURL(
        fileNamePathOrUrl,
        false //Isn't WAV file
    )
    recMeteringEnabled = if (ro.hasKey(recMeteringEnabledKey)) ro.getBoolean(recMeteringEnabledKey) else true
    var maxRecDurationSec = if (ro.hasKey(maxRecDurationSecKey)) ro.getDouble(maxRecDurationSecKey) else DEFAULT_MAX_RECORDING_DURATION_SEC
    this.sampleRate = if (ro.hasKey(sampleRateKey)) ro.getInt(sampleRateKey) else 44100
    this.numChannels = if (ro.hasKey(numChannelsKey)) ro.getInt(numChannelsKey) else 1
    //Android-specific
    val audioSourceId = if (ro.hasKey(androidAudioSourceIdKey)) ro.getInt(androidAudioSourceIdKey) else MediaRecorder.AudioSource.MIC
    val outputFormatId = if (ro.hasKey(androidOutputFormatIdKey)) ro.getInt(androidOutputFormatIdKey) else MediaRecorder.OutputFormat.MPEG_4
    val audioEncoderId = if (ro.hasKey(androidAudioEncoderIdKey)) ro.getInt(androidAudioEncoderIdKey) else MediaRecorder.AudioEncoder.AAC
    //Android-non-wav-specific
    val encodingBitRate = if (ro.hasKey(androidAudioEncodingBitRateKey)) ro.getInt(androidAudioEncodingBitRateKey) else 128000

    Log.d(tag, " ")
    Log.d(tag, "Coerced:")
    Log.d(tag, "  audioFileURL: " + audioFileURL)
    Log.d(tag, "  recMeteringEnabled: " + recMeteringEnabled)
    Log.d(tag, "  maxRecDurationSec: " + maxRecDurationSec)
    Log.d(tag, "  sampleRate:" + sampleRate)
    Log.d(tag, "  numChannels:" + numChannels)
    Log.d(tag, "  audioSourceId: " + audioSourceId)
    Log.d(tag, "  outputFormatId: " + outputFormatId)
    Log.d(tag, "  audioEncoderId: " + audioEncoderId)
    Log.d(tag, "  encodingBitRate: " + encodingBitRate)

    //Configure media recorder
    if (mediaRecorder == null) {
      if (Build.VERSION.SDK_INT < 31) {
        @Suppress("DEPRECATION")
        mediaRecorder = MediaRecorder() //Old constructor
      }
      else {
        mediaRecorder = MediaRecorder(reactContext) //New constructor
      }
    }

    mediaRecorder!!.setOutputFile(audioFileURL)
    mediaRecorder!!.setAudioSamplingRate(sampleRate)
    mediaRecorder!!.setAudioChannels(numChannels)
    mediaRecorder!!.setAudioSource(audioSourceId)
    mediaRecorder!!.setOutputFormat(outputFormatId)
    mediaRecorder!!.setAudioEncoder(audioEncoderId)
    mediaRecorder!!.setAudioEncodingBitRate(encodingBitRate)
   
    try {
      mediaRecorder!!.prepare()
      pausedRecordTimeMs = 0L
      totalPausedRecordTimeMs = 0L
      mediaRecorder!!.start()
      val systemTimeMs = SystemClock.elapsedRealtime()
      recorderRunnable = object : Runnable {
        override fun run() {
          val timeMs = SystemClock.elapsedRealtime() - systemTimeMs - totalPausedRecordTimeMs
          if (timeMs.toDouble() > maxRecDurationSec * 1000) {
            if (mediaRecorder != null) {
              Log.d(tag, "Max recording duration reached")
              Log.d(tag, "Sending stoppage event")
              recStopCode = RecStopCode.MaxDurationReached
              sendRecStopEvent()
              Log.d(tag, "Stopping recorder")
              stopRecorder(promise)
            }
            return
          }

          //Calculate meterLevelDb
          var meterLevelDb:Double = MIN_METER_LEVEL_DB
          if (recMeteringEnabled) {
            var maxAmplitude = 0.0
            if (mediaRecorder != null) {
              maxAmplitude = mediaRecorder!!.maxAmplitude.toDouble()
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

          recordHandler!!.postDelayed(this, subscriptionDurationMs.toLong())
        }
      }
      (recorderRunnable as Runnable).run()

      //NOTE: To determine the recording settings ACTUALLY used for MediaRecorder, we need:
      // * API 24: ActiveRecordingConfiguration
      // * API 29: MediaRecorder.getActiveRecordingConfiguration()
      // Not yet ready to bump up the minimum sdk for this, 
      // so we're making some assumptions.
      // Hopefully the metadata will be in the saved files anyway.
      val grantedOptions = Arguments.createMap()
      //Cross-platform
      grantedOptions.putString(audioFilePathKey, "file:///$audioFileURL")
      grantedOptions.putBoolean(recMeteringEnabledKey, recMeteringEnabled)
      grantedOptions.putDouble(maxRecDurationSecKey, maxRecDurationSec)
      grantedOptions.putDouble(sampleRateKey, sampleRate.toDouble())
      grantedOptions.putDouble(numChannelsKey, numChannels.toDouble())
      //Android specific
      grantedOptions.putDouble(androidAudioSourceIdKey, audioSourceId.toDouble())
      grantedOptions.putDouble(androidOutputFormatIdKey, outputFormatId.toDouble())
      grantedOptions.putDouble(androidAudioEncoderIdKey, audioEncoderId.toDouble())
      promise.resolve(grantedOptions)
    } 
    catch (e: Exception) {
      recStopCode = RecStopCode.Error
      val errMsg = " - Exception: " + e
      Log.e(tag, funcName + errMsg)
      return promise.reject(funcName, errMsg)
    }
  }

  @ReactMethod
  fun pauseRecorder(promise: Promise) {
    val funcName = tag + ".pauseRecorder()"
    Log.d(tag, funcName)

    //If recording LPCM
    if (encodingAsLPCM(audioFileURL)) {
      Log.d(tag, funcName + " - calling RnAudio.pauseLPCMRecorder()")
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

    if (mediaRecorder == null) {
      return promise.reject(funcName, "Recorder is null.")
    }
    try {
      mediaRecorder!!.pause()
      pausedRecordTimeMs = SystemClock.elapsedRealtime()
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
      return promise.resolve(funcName + "Recorder paused.")
    } 
    catch (e: Exception) {
      val errMsg = funcName + "- exception: " + e
      Log.e(tag, errMsg)
      return promise.reject(funcName, errMsg)
    }
  }

  @ReactMethod
  fun resumeRecorder(promise: Promise) {
    val funcName = tag + ".resumeRecorder()"
    Log.d(tag, funcName)

    //If recording LPCM
    if (encodingAsLPCM(audioFileURL)) {
      Log.d(tag, funcName + " - calling RnAudio.resumeLPCMRecorder()")
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
      totalPausedRecordTimeMs += SystemClock.elapsedRealtime() - pausedRecordTimeMs
      pausedRecordTimeMs = 0L
      mediaRecorder!!.resume()
      recorderRunnable?.let { recordHandler!!.postDelayed(it, subscriptionDurationMs.toLong()) }
      return promise.resolve(funcName + "Recorder resumed.")
    } 
    catch (e: Exception) {
      Log.e(tag, "Recorder resume: " + e.message)
      return promise.reject(funcName, e.message)
    }
  }

  @ReactMethod
  fun stopRecorder(promise: Promise) {
    val funcName = tag + ".stopRecorder()"
    Log.d(tag, funcName)

    //If recording LPCM
    if (encodingAsLPCM(audioFileURL)) {
      Log.d(tag, funcName + " - calling RnAudio.stopLPCMRecorder()")
      return stopLPCMRecorder(promise)
    }

    //NOT recording LPCM

    if (recordHandler != null) {
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
    }

    if (mediaRecorder == null) {
      return promise.resolve(createRecStopResult())
    }

    try {
      //Seems heavy-handed, but Android's fragility is ridiculous.
      try {
        mediaRecorder?.stop()
      } catch (e:Exception) {
        Log.e(tag, funcName + " - Trouble calling MediaRecorder.stop(): " + e)
      }
      try {
        mediaRecorder?.reset()
      } catch (e:Exception) {
        Log.e(tag, funcName + " - Trouble calling MediaRecorder.reset(): " + e)
      }
      try {
        mediaRecorder?.release()
      } catch (e:Exception) {
        Log.e(tag, funcName + " - Trouble calling MediaRecorder.release(): " + e)
      }
      mediaRecorder = null
      sendRecStopEvent()
    } 
    catch (e: Exception) {
      Log.d(tag, funcName + " - " + e)
      return promise.reject(funcName, "" + e)
    }

    return promise.resolve(createRecStopResult())
  }

  //setPlayerVolume()
  //  * MediaPlayer must exist before calling this! Consider using startPlayer's playbackVolume 
  //    parameter instead of calling this.
  //  * relative to 100% of Media Volume
  @ReactMethod
  fun setPlayerVolume(volume: Double, promise: Promise) {
    val funcName = tag + ".setPlayerVolume()"
    Log.d(tag, funcName)
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
      Log.e(tag, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }  
  }
  fun setPlayerVolume(volume: Double) {
    val mVolume = volume.toFloat()
    mediaPlayer!!.setVolume(mVolume, mVolume)  // Left, right
  }

  @ReactMethod
  fun startPlayer(uri: String, httpHeaders: ReadableMap?, playbackVolume:Double, promise: Promise) {
    val funcName = tag + ".startPlayer()"
    Log.d(tag, funcName)

    val playerState = getPlayerState()
    if (playerState == PlayerState.Playing) {
      val errMsg = funcName + " - Player already running"
      Log.e(tag, errMsg)
      return promise.reject(funcName, errMsg)
    }
    else if (playerState == PlayerState.Paused) {
      mediaPlayer?.start()
      return promise.resolve(audioFileURL)
    }
    else { //PlayerState.Stopped
      mediaPlayer = MediaPlayer()
    }

    //Set volume
    try {
      setPlayerVolume(playbackVolume)
    }
    catch (e: Exception) {
      sendPlayStopEvent(PlayStopCode.Error)
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(tag, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }

    // NOTE: If uri is "DEFAULT", defaults to non-wav, here; this could go wrong...
    var resolvedUri = constructAudioFileURL(uri, false)
    
    try {
      if (httpHeaders != null) {
        val headers: MutableMap<String, String?> = HashMap<String, String?>()
        val iterator = httpHeaders.keySetIterator()
        while (iterator.hasNextKey()) {
          val key = iterator.nextKey()
          headers.put(key, httpHeaders.getString(key))
        }
        mediaPlayer!!.setDataSource(currentActivity!!.applicationContext, Uri.parse(uri), headers)
      } 
      else {
        mediaPlayer!!.setDataSource(resolvedUri)
      }
      
      mediaPlayer!!.setOnPreparedListener { mp ->
        Log.d(tag, "mediaplayer prepared and start")
        mp.start()
        //Set timer task to send event to RN.
        playUpdateTimerTask = object : TimerTask() {
          override fun run() {
            sendPlayUpdateEvent(mp.currentPosition, mp.duration)
          }
        }
        playUpdateTimer = Timer()
        playUpdateTimer!!.schedule(playUpdateTimerTask, 0, subscriptionDurationMs.toLong())
      }

      //Detect when finish playing
      mediaPlayer!!.setOnCompletionListener { mp ->
        
        Log.d(tag, funcName + " completion listener: Playback completed.")

        //Send event 
        sendPlayStopEvent(PlayStopCode.MaxDurationReached)
        
        //Reset player
        playUpdateTimer!!.cancel()
        mp.stop()
        mp.reset()
        mp.release()
        mediaPlayer = null
      }

      mediaPlayer!!.prepare()

      return promise.resolve(resolvedUri)
    } 
    catch (e:Exception) { 
      sendPlayStopEvent(PlayStopCode.Error)
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(tag, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }

  @ReactMethod
  fun pausePlayer(promise: Promise) {
    val funcName = tag + ".pausePlayer()"
    Log.d(tag, funcName)
    val playerState = getPlayerState()
    val msgPrefix = funcName + ": "
    if (playerState == PlayerState.Stopped) {
      val msg = "Can\'t pause; player is stopped."
      Log.d(tag, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    else if (playerState == PlayerState.Paused) {
      val msg = "Player already paused."
      Log.d(tag, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    try {
      mediaPlayer!!.pause()
      return promise.resolve("pause player")
    } 
    catch (e:Exception) {
      val errMsg = "Error: " + e.message
      Log.e(tag, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }

  @ReactMethod
  fun resumePlayer(promise: Promise) {
    val funcName = tag + ".resumePlayer()"
    Log.d(tag, funcName)
    val playerState = getPlayerState()
    val msgPrefix = funcName + ": "
    if (playerState == PlayerState.Stopped) {
      val msg = "Can\'t resume; player stopped."
      Log.d(tag, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    else if (playerState == PlayerState.Playing) {
      val msg = "Player already playing."
      Log.d(tag, msgPrefix + msg)
      return promise.resolve(msgPrefix + msg)
    }
    try {
      mediaPlayer!!.seekTo(mediaPlayer!!.currentPosition)
      mediaPlayer!!.start()
      return promise.resolve(funcName + " - resuming player")
    } 
    catch (e:Exception) {
      val errMsg = "Error: " + e.message
      Log.e(tag, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }

  @ReactMethod
  fun stopPlayer(promise: Promise) {
    val funcName = tag + ".stopPlayer()"
    Log.d(tag, funcName)
    if (playUpdateTimer != null) {
      playUpdateTimer!!.cancel()
    }
    if (getPlayerState() == PlayerState.Stopped) {
      return promise.resolve(funcName + " - Player already stopped")
    }
    try { 
      sendPlayStopEvent(PlayStopCode.Requested)

      mediaPlayer!!.release()
      mediaPlayer = null
      return promise.resolve(funcName + " - Stopped player.")
    } catch (e:Exception) {
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(tag, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
  }

  @ReactMethod
  fun seekToPlayer(time: Double, promise: Promise) {
    val funcName = tag + ".seekToPlayer()"
    Log.d(tag, funcName)
    if (getPlayerState() == PlayerState.Stopped) {
      return promise.reject(funcName, "Player stopped on seek.")
    }
    try {
      mediaPlayer!!.seekTo(time.toInt())
    }
    catch (e:Exception) {
      val msgPrefix = funcName + ": "
      val errMsg = "Error: " + e.message
      Log.e(tag, msgPrefix + errMsg)
      return promise.reject(msgPrefix, errMsg)
    }
    return promise.resolve(funcName + ": Seek successful")
  }

  @ReactMethod
  fun setSubscriptionDuration(sec: Double, promise: Promise) {
    val funcName = tag + ".setSubscriptionDuration()"
    Log.d(tag, funcName)
    subscriptionDurationMs = (sec * 1000).toInt()
    return promise.resolve(funcName + " - Set subscription duration: $subscriptionDurationMs")
  }


  fun encodingAsLPCM(fileNameOrPathOrUrl:String): Boolean {
    val funcName = "RnAudio.encodingAsLPCM()"
    Log.d(tag, funcName)

    //TODO: Should this be filename-based? Encoding based? Combination?

    //If filename ends with .wav
    val ignoreCase = true
    if (fileNameOrPathOrUrl.endsWith(".wav", ignoreCase)) {
      return true
    }
    
    return false
  }


  private fun constructAudioFileURL(path: String?, isWav:Boolean):String {
    val funcName = tag + ".constructAudioFileURL()"
    Log.d(tag, funcName)
    if (path != null &&
        (path.startsWith("http://") || 
         path.startsWith("https://") || 
         path.startsWith("file://") ||
         path.startsWith("/") ||
         path.startsWith("./") ||
         path.startsWith("../"))) {
      return path
    }
    else if (path != null && path != "" && path != DEFAULT_FILENAME_PLACEHOLDER) {
      return "${reactContext.cacheDir}/$path"
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


  fun initLPCMRecorderOptions(requestedOptions: ReadableMap, 
                              grantedOptions: WritableMap):Boolean {
    val funcName = tag + ".initLPCMRecorderOptions()"

    Log.d(tag, funcName)

    Log.d(tag, funcName + " - Requested recording options:")
    Log.d(tag, " " + requestedOptions)
    Log.d(tag, " ")

    //Set/coerce recording options
    val ro = requestedOptions
    this.audioFileURL = constructAudioFileURL(
      (if (ro.hasKey(audioFilePathKey)) ro.getString(audioFilePathKey)!! else DEFAULT_FILENAME_PLACEHOLDER),
      true // is a wav file
    )
    this.recMeteringEnabled = if (ro.hasKey(recMeteringEnabledKey)) ro.getBoolean(recMeteringEnabledKey) else true
    this.sampleRate = if (ro.hasKey(sampleRateKey)) ro.getInt(sampleRateKey) else 44100
    this.numChannels = if (ro.hasKey(numChannelsKey)) ro.getInt(numChannelsKey) else 1
    var maxRecDurationSec = if (ro.hasKey(maxRecDurationSecKey)) ro.getDouble(maxRecDurationSecKey) else DEFAULT_MAX_RECORDING_DURATION_SEC
    maxNumSamples = sampleRate * maxRecDurationSec.toInt()
    //Android specific
    val audioSourceId = if (ro.hasKey(androidAudioSourceIdKey)) ro.getInt(androidAudioSourceIdKey) else MediaRecorder.AudioSource.MIC
    val outputFormatId = if (ro.hasKey(androidOutputFormatIdKey)) ro.getInt(androidOutputFormatIdKey) else 999 //Co-opting 999 for WAV
    val audioEncoderId = if (ro.hasKey(androidAudioEncoderIdKey)) ro.getInt(androidAudioEncoderIdKey) else 999 //Co-opting 999 for LPCM
    //Android WAV/LPCM-specific
    this.lpcmByteDepth = if (ro.hasKey(lpcmByteDepthKey)) ro.getInt(lpcmByteDepthKey) else 2

    Log.d(tag, " ")
    Log.d(tag, "Coerced:")
    Log.d(tag, "  audioFilePath: " + audioFileURL)
    Log.d(tag, "  recMeteringEnabled: " + recMeteringEnabled)
    Log.d(tag, "  maxRecDurationSec: " + maxRecDurationSec)
    Log.d(tag, "  sampleRate:" + sampleRate)
    Log.d(tag, "  numChannels:" + numChannels)
    Log.d(tag, "  audioSourceId: " + audioSourceId)
    Log.d(tag, "  outputFormatId: " + outputFormatId)
    Log.d(tag, "  audioEncoderId: " + audioEncoderId)
    Log.d(tag, "  lpcmByteDepth:" + lpcmByteDepth)
    Log.d(tag, " ") 
    Log.d(tag, "  maxNumSamples:" + maxNumSamples)

    tempRawPCMDataFilePath = "${reactContext.cacheDir}" + "/" + "temp.lpcm"
    
    val minFrameBufferSize = AudioRecord.getMinBufferSize(sampleRate, getChannelConfig(), getPCMEncoding())
    if (minFrameBufferSize < 0) {
      if (minFrameBufferSize == AudioRecord.ERROR_BAD_VALUE) {
        Log.e(tag, "RnAudio.initLPCMRecorderOptions() - Error: minFrameBufferSize == " + 
                    AudioRecord.ERROR_BAD_VALUE + 
                    ". Recording parameters not supported by hardware, or invalid parameter passed.")
      }
      if (minFrameBufferSize == AudioRecord.ERROR) {
        Log.e(tag, "RnAudio.initLPCMRecorderOptions() - Error: minFrameBufferSize == " + 
                    AudioRecord.ERROR + 
                    ". Implementation unable to query hardware for input properties.")
      }
      return false
    }
    lpcmFrameBufferSize = minFrameBufferSize * 2

    try {
      audioRecord = AudioRecord(audioSourceId, sampleRate, getChannelConfig(), getPCMEncoding(), lpcmFrameBufferSize!!)
    }
    catch (e:Exception) {
      Log.e(tag, e.toString())
      return false
    }

    if (audioRecord!!.getState() != AudioRecord.STATE_INITIALIZED) {
      Log.e(tag, "Error: Attempt to initialize AudioRecord failed.")
      return false
    }

    if (AutomaticGainControl.isAvailable()) {
      val agc = AutomaticGainControl.create(audioRecord!!.getAudioSessionId())
      agc.setEnabled(false)
    }

    //Certain *granted* parameters may differ from *requested* parameters
    //update these parameters from the AudioRecord instance.
    sampleRate = audioRecord!!.getSampleRate()
    numChannels = audioRecord!!.getChannelCount()
    lpcmByteDepth = if (audioRecord!!.getAudioFormat() == android.media.AudioFormat.ENCODING_PCM_8BIT) 1 else 2

    //Granted parameters: 
    //Cross-platform 
    grantedOptions.putString(audioFilePathKey, "file:///$audioFileURL")
    grantedOptions.putBoolean(recMeteringEnabledKey, recMeteringEnabled)
    grantedOptions.putDouble(maxRecDurationSecKey, maxRecDurationSec)
    grantedOptions.putDouble(sampleRateKey, sampleRate.toDouble())
    grantedOptions.putDouble(numChannelsKey, numChannels.toDouble())
    //Android-specific
    grantedOptions.putDouble(androidAudioSourceIdKey, audioSourceId.toDouble())
    grantedOptions.putDouble(androidOutputFormatIdKey, outputFormatId.toDouble())
    grantedOptions.putDouble(androidAudioEncoderIdKey, audioEncoderId.toDouble())
    //Android WAV/LPCM-specific
    grantedOptions.putDouble(lpcmByteDepthKey, lpcmByteDepth.toDouble())

    return true
  }


  // Recording WAV
  // Since MediaRecorder does not record WAV/LPCM, we use methods below based on AudioRecord.


  @ReactMethod
  public fun startLPCMRecorder(recordingOptions: ReadableMap, promise:Promise) {
    val funcName = tag + ".startLPCMRecorder()" 
    Log.d(tag, funcName)

    currentlyRecordingLPCM = true
    recStopCode = RecStopCode.Requested //Start by assuming a no-error result

    if (ensurePermissionsSecured() == false) {
      return promise.reject(PERMISSION_NOT_GRANTED_STR, TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR)
    }

    val requestedOptions = recordingOptions
    val grantedOptions = Arguments.createMap()
    if (initLPCMRecorderOptions(requestedOptions, grantedOptions) == false) {
      return promise.reject(funcName, "Unable to initialize the recorder. Check parameters, and try again.")
    }
    Log.d(tag, funcName+ " - granted options: " + grantedOptions)
    
    val systemTime = SystemClock.elapsedRealtime()

    recorderRunnable = object : Runnable {
      override fun run() {
        val time = SystemClock.elapsedRealtime() - systemTime - totalPausedRecordTimeMs
        val meterLevelDb = if (recMeteringEnabled) calcLPCMMeterLevelDb() else MIN_METER_LEVEL_DB
        Log.d(tag, "recMeteringEnabled: " + recMeteringEnabled + " meterLevelDb:" + meterLevelDb)
        val isRecording = true
        sendRecUpdateEvent(time.toDouble(), isRecording, meterLevelDb)
        recordHandler!!.postDelayed(this, subscriptionDurationMs.toLong())
      }
    }
    
    fun stopAndNullifyAudioRecord() {
      if (audioRecord != null) {
        //Seems heavy-handed, but Android's fragility is ridiculous.
        try {
          audioRecord?.stop()
        } catch (e:Exception) {
          Log.e(tag, "Trouble calling audioRecord.stop(): ", e)
        }
        try {
          audioRecord?.release()
        } catch (e:Exception) {
          Log.e(tag, "Trouble calling audioRecord.release(): ", e)
        }
        audioRecord = null
      }
    }

    pausedRecordTimeMs = 0L
    totalPausedRecordTimeMs = 0L
    audioRecord!!.startRecording()

    Thread {
      var fos:FileOutputStream? = null
      try {
        var frameCount = 0
        var numSamplesProcessed = 0
        lpcmFrameData = ByteArray(lpcmFrameBufferSize!!){0}
        lpcmFrameDataContentSize = lpcmFrameBufferSize //Starting value
        
        (recorderRunnable as Runnable).run()
        fos = FileOutputStream(File(tempRawPCMDataFilePath!!), false)
        while (currentlyRecordingLPCM && numSamplesProcessed < maxNumSamples) {

          //Pause loop
          while (getRecorderState() == RecorderState.Paused && currentlyRecordingLPCM) {
            Thread.sleep(30)
          }
          //If we've broken out of the pause loop because we're
          //no longer recording, i.e: stopping, not resuming...
          if (currentlyRecordingLPCM == false) {
              break  // While recording loop
          }

          val bytesRead = audioRecord!!.read(lpcmFrameData!!, 0, lpcmFrameData!!.size)
          if (bytesRead > 0 && ++frameCount > 2) { // skip first 2, to eliminate "click sound"

            val bytesPerPacket:Int = lpcmByteDepth * numChannels
            var numSamplesToProcess:Int = bytesRead / bytesPerPacket
            if (numSamplesProcessed + numSamplesToProcess >= maxNumSamples) {
              numSamplesToProcess = maxNumSamples - numSamplesProcessed
              recStopCode = RecStopCode.MaxDurationReached
            }

            lpcmFrameDataContentSize = numSamplesToProcess * bytesPerPacket
            fos.write(lpcmFrameData!!, 0, lpcmFrameDataContentSize!!)

            numSamplesProcessed += numSamplesToProcess
          }
        }

        stopAndNullifyAudioRecord()

        fos.close()
        
        saveAsWav()
      }
      catch (e:Exception) {
        e.printStackTrace()
        recStopCode = RecStopCode.Error
      }
      finally {

        currentlyRecordingLPCM = false

        stopAndNullifyAudioRecord()
        
        if (recordHandler != null) {
          recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
        }

        if (fos != null) {
          try {
            fos.close()
          } catch (e:Exception) {
            e.printStackTrace()
            recStopCode = RecStopCode.Error
          }
        }
        
        deleteTempFile()
      
        //If we arrived here due to an error or timeout, send stop code to app.
        if (recStopCode !== RecStopCode.Requested) {
          sendRecStopEvent()
        }
      }
    }.start()
  
    return promise.resolve(grantedOptions)
  }

  @ReactMethod
  fun pauseLPCMRecorder(promise: Promise) {
    val funcName = tag + ".pauseLPCMRecorder()" 
    Log.d(tag, funcName)

    if (audioRecord == null) {
      Log.d(tag, "   audioRecord == null")
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
      Log.d(tag, funcName + " - removing record callbacks")
      pausedRecordTimeMs = SystemClock.elapsedRealtime()
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
      return promise.resolve(funcName + ": Paused wav recording")
    } 
    catch (e: Exception) {
      Log.e(tag, funcName + " - exception: " + e.message)
      return promise.reject(funcName + " - Error: ", e.message)
    }      
  }

  @ReactMethod
  fun resumeLPCMRecorder(promise: Promise) {
    val funcName = tag + ".resumeLPCMRecorder()"
    Log.d(tag, funcName)

    val recorderState = getRecorderState()
    if (recorderState == RecorderState.Stopped) {
      return promise.resolve(funcName + ": Can\'t resume; recorder not recording")
    }
    else if (recorderState != RecorderState.Paused) {
      Log.d(tag, "   audioRecorderIsPaused() == false")
      return promise.resolve(funcName+ ": Can\'t resume; recorder was not paused")
    }

    try {
      totalPausedRecordTimeMs += SystemClock.elapsedRealtime() - pausedRecordTimeMs
      pausedRecordTimeMs = 0L
      recorderRunnable?.let { recordHandler!!.postDelayed(it, subscriptionDurationMs.toLong()) }
      return promise.resolve(funcName + ": Wav recording resumed.")
    } 
    catch (e: Exception) {
      Log.e(tag, "resumeWavRecorder Error: " + e.message)
      return promise.reject(funcName + " - Error: ", e.message)
    } 
  }

  @ReactMethod
  fun stopLPCMRecorder(promise: Promise) {
    val funcName = tag + ".stopLPCMRecorder()" 
    Log.d(tag, funcName)

    if (recordHandler != null) {
      Log.d(tag, funcName + " - removing record callbacks")
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
    }

    if (getRecorderState() == RecorderState.Stopped) {
      return promise.resolve(funcName + " - recorder already stopped (audioRecord is null).")
    }

    //Clarify cause of stoppage
    recStopCode = RecStopCode.Requested

    //This clears a flag; actually stopping the recorder
    //and informing the UI happens in thread launched from startLPCMRecorder()
    currentlyRecordingLPCM = false

    //Wait for recorder thread to stop
    while (getRecorderState() != RecorderState.Stopped) {
      Log.d(tag, funcName + ": Waiting for recorder to stop...")
      Thread.sleep(10)
    }

    sendRecStopEvent()

    return promise.resolve(createRecStopResult())
  }


  private fun saveAsWav() {
    val funcName = tag + ".saveAsWav()" 
    Log.d(tag, funcName)

    if (tempRawPCMDataFilePath == null  || audioFileURL == "" || audioFileURL == "DEFAULT") {
      throw Exception(funcName+ ": Null or empty file path.")
    }

    Log.d(tag, funcName + ": Saving " + audioFileURL + "...")

    //Write wav file
    //Approach: https://medium.com/@sujitpanda/file-read-write-with-kotlin-io-31eff564dfe3
    var fileInputStream = FileInputStream(tempRawPCMDataFilePath!!)
    var fileOutputStream = FileOutputStream(File(audioFileURL), false)
    fileInputStream.use { fis:FileInputStream ->
      fileOutputStream.use { fos:FileOutputStream ->
        //Header
        val numSampleDataBytes:Long = fis.getChannel().size()
        addWavHeader(fileOutputStream, numSampleDataBytes)
        //Data
        fileInputStream.copyTo(fileOutputStream)
        Log.d(tag, funcName + ": wav file path:" + audioFileURL)
        Log.d(tag, funcName + ": wav file size:" + fos.getChannel().size())
        fos.flush()
        fos.close()
      }
      Log.d(tag, funcName + ": Closing input file.")
      fileInputStream.close()
    }
    Log.d(tag, funcName + ": Done save.")
  }

  private fun toByte(c:Char):Byte {
    return c.code.toByte() 
  }

  private fun addWavHeader(fileOutputStream:FileOutputStream, numSampleDataBytes:Long) {
      val funcName = tag + ".addWavHeader()" 
      Log.d(tag, funcName)

      val byteRate:Int = sampleRate * numChannels * lpcmByteDepth
      val blockAlign:Int = numChannels * lpcmByteDepth

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
      header[22] = (numChannels and 0xFF).toByte()                       // mono or stereo
      header[23] = 0.toByte()
      header[24] = (sampleRate and 0xff).toByte()            // samples per second
      header[25] = ((sampleRate shr 8) and 0xff).toByte()
      header[26] = ((sampleRate shr 16) and 0xff).toByte()
      header[27] = ((sampleRate shr 24) and 0xff).toByte()
      header[28] = (byteRate and 0xff).toByte()              // bytes per second
      header[29] = ((byteRate shr 8) and 0xff).toByte()
      header[30] = ((byteRate shr 16) and 0xff).toByte()
      header[31] = ((byteRate shr 24) and 0xff).toByte()
      header[32] = blockAlign.toByte()                     // bytes in one sample, for all channels
      header[33] = 0.toByte()
      header[34] = (lpcmByteDepth * 8).toByte()                  // bits in (one channel of a) sample
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
    val funcName = tag + ".deleteTempFile()" 
    Log.d(tag, funcName)
    if (tempRawPCMDataFilePath != null) {
      val f:File = File(tempRawPCMDataFilePath!!)
      f.delete()
    }
  }

  private fun getChannelConfig():Int {
    if (numChannels == 2) {
      return AudioFormat.CHANNEL_IN_STEREO
    }
    else {
      return AudioFormat.CHANNEL_IN_MONO
    }
  }

  private fun getPCMEncoding():Int {
    if (lpcmByteDepth == 2) {
      return AudioFormat.ENCODING_PCM_16BIT
    }
    else {
      return AudioFormat.ENCODING_PCM_8BIT
    }
  }


  private fun calcLPCMMeterLevelDb():Double { //channels interleaved
    val funcName = tag + ".calcLPCMMeterLevelDb()"
    Log.d(tag, funcName)

    // * Output in dBFS: dB relative to full scale
    // * Only includes contributions of channel-1 samples

    var sumVolume:Double = 0.0
    val numBytes:Int = lpcmFrameDataContentSize!!
    var numSamples:Int = numBytes / (lpcmByteDepth * numChannels)
    if (lpcmByteDepth == 2) {
      val bufferInt16:ShortArray = ShortArray(numSamples * numChannels)
      val byteBuffer:ByteBuffer = ByteBuffer.wrap(lpcmFrameData!!, 0, numBytes)
      byteBuffer.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(bufferInt16)
      for (i in 0..(numSamples-1)) {
        sumVolume += Math.abs((bufferInt16[i * numChannels]).toDouble())
      }
    }
    else { //lpcmByteDepth of 1
      for (i in 0..(numSamples-1)) {
        var s = (lpcmFrameData!![i * numChannels].toInt() and 0xFF) - 127        
        sumVolume +=  Math.abs(s.toDouble())
      }
    }

    var avgVolume:Double = sumVolume / numSamples
    if (lpcmByteDepth == 1) {
      avgVolume /= Byte.MAX_VALUE.toDouble()
    } 
    else { //lpcmByteDepth == 2
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
