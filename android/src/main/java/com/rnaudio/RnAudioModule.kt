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
class RnAudioModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), PermissionListener {

  companion object {
    private val tag = "RnAudio"  // Keep up-to-date, if module name changes!
    private val DEFAULT_FILE_NAME = "recording.mp4"
    private val DEFAULT_WAV_FILE_NAME = "recording.wav"
  }

  override fun getName(): String {
    return tag
  }

  private val ABSOLUTE_MAX_DURATION_SEC = 2 * 60.0 * 60.0
  private val DEFAULT_MAX_RECORDING_DURATION_SEC = 10.0

  private val PERMISSION_NOT_GRANTED_STR = "One or more required permissions (RECORD_AUDIO, WRITE_EXTERNAL_STORAGE) not granted."
  private val TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR = "Try again after adding permission(s)."

  //Events passed from native -> js
  enum class Event(val str: String) {
    RecUpdate("RecUpdate"),
    PlayUpdate("PlayUpdate"),
    RecStop("RecStop")  // When recording (and playback?) is stopped, provides reason
  }

  enum class RecStopCode(val str: String) {
    UserRequest("UserRequest"),
    MaxDurationReached("MaxDurationReached"),
    Error("Error")
  }

  enum class EventDetailKey(val str: String) {
    IsMuted("isMuted"),
    IsRecording("isRecording"),
    RecStopCode("recStopCode"),
    RecElapsedMs("recElapsedMs"),
    RecMeterLevel("recMeterLevel"),
    PlayElapsedMs("playElapsedMs"),
    PlayDurationMs("playDurationMs"),
  }

  private val audioFilePathKey = "audioFilePath"
  private val recMeteringEnabledKey = "recMeteringEnabled"
  private val maxRecDurationSecKey = "maxRecDurationSec"
  private val androidAudioSourceIdKey = "androidAudioSourceId"
  private val androidOutputFormatIdKey = "androidOutputFormatId"
  private val androidAudioEncoderIdKey = "androidAudioEncoderId"
  private val androidAudioEncodingBitRateKey = "androidAudioEncodingBitRate"
  private val androidAudioSamplingRateKey = "androidAudioSamplingRate"
  private val androidWavByteDepthKey = "androidWavByteDepth"
  private val androidWavNumberOfChannelsKey = "androidWavNumberOfChannels"

  private var audioFileURL = "${reactContext.cacheDir}/$DEFAULT_FILE_NAME"
  private var recMeteringEnabled = false

  //Recording-related
  private var recStopCode = RecStopCode.UserRequest
  @Volatile
  private var pausedRecordTime = 0L  //Value of 0 used secondarily to signify "not paused"
  private var totalPausedRecordTime = 0L

  private var mediaRecorder: MediaRecorder? = null
  private var recorderRunnable: Runnable? = null
  var recordHandler: Handler? = Handler(Looper.getMainLooper())
  private var subsDurationMillis = 500

  //Wav recording specific
  private var sampleRate:Int = 44100
  private var numChannels:Int = 1
  private var byteDepth:Int = 2
  private var maxNumSamples:Int = 0 //Temporary value
  private var audioRecord:AudioRecord? = null
  private var frameBufferSize:Int? = null
  private var wavFrameData:ByteArray? = null
  private var wavFrameDataContentSize:Int? = null
  @Volatile
  private var isRecordingWav:Boolean = false
  private var tempRawPCMDataFilePath:String? = null

  //Playback-related
  private var mediaPlayer: MediaPlayer? = null
  private var mTask: TimerTask? = null
  private var mTimer: Timer? = null



  //Perhaps this function is unnecessary, if permissions taken care of 
  //at the (react-native) app level?
  private fun ensurePermissionsSecured():Boolean {
    Log.i(tag, "ensurePermissionsSecured()")
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
          (ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
          ActivityCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)) {
          
        ActivityCompat.requestPermissions((currentActivity)!!, arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.WRITE_EXTERNAL_STORAGE), 0)
        //Perhaps something smarter to do than returning false here...
        return false
      }
    } catch (ne: NullPointerException) {
      Log.w(tag, ne.toString())
      return false
    }
    return true
  }


  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray): Boolean {
    Log.i(tag, "onRequestPermissionsResult()")
    
    // TODO: Should this incorporate WRITE_EXTERNAL_STORAGE permission, too?

    var requestRecordAudioPermission: Int = 200

    when (requestCode) {
      requestRecordAudioPermission -> if (grantResults[0] == PackageManager.PERMISSION_GRANTED) return true
    }
    return false
  }


  fun setAudioFileURL(path: String?) {
    if (path == null || path == "DEFAULT" || path == "") {
      this.audioFileURL = "${reactContext.cacheDir}/$DEFAULT_FILE_NAME"
    } 
    else {
      this.audioFileURL = path
    }
  }


  @ReactMethod
  fun startRecorder(recordingOptions: ReadableMap, promise: Promise) {

    //NOTE: To determine the recording settings actually used for MediaRecorder, we need:
    // * API 24: ActiveRecordingConfiguration
    // * API 29: MediaRecorder.getActiveRecordingConfiguration()
    // Not yet ready to bump up the minimum sdk for this

    //Ensure permissions available    
    if (ensurePermissionsSecured() == false) {
      return promise.reject(PERMISSION_NOT_GRANTED_STR, TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR)
    }

    Log.i(tag, "Requested recording options:")
    Log.i(tag, " " + recordingOptions)

    //Set/coerce recording options
    val ro = recordingOptions
    setAudioFileURL(if (ro.hasKey(audioFilePathKey)) ro.getString(audioFilePathKey) else DEFAULT_FILE_NAME)
    val recMeteringEnabled = if (ro.hasKey(recMeteringEnabledKey)) ro.getBoolean(recMeteringEnabledKey) else true
    var maxRecDurationSec = if (ro.hasKey(maxRecDurationSecKey)) ro.getDouble(maxRecDurationSecKey) else DEFAULT_MAX_RECORDING_DURATION_SEC
    if (maxRecDurationSec > ABSOLUTE_MAX_DURATION_SEC) {
      maxRecDurationSec = ABSOLUTE_MAX_DURATION_SEC
    }
    //Android specific
    val audioSourceId = if (ro.hasKey(androidAudioSourceIdKey)) ro.getInt(androidAudioSourceIdKey) else MediaRecorder.AudioSource.MIC
    val outputFormatId = if (ro.hasKey(androidOutputFormatIdKey)) ro.getInt(androidOutputFormatIdKey) else MediaRecorder.OutputFormat.MPEG_4
    val audioEncoderId = if (ro.hasKey(androidAudioEncoderIdKey)) ro.getInt(androidAudioEncoderIdKey) else MediaRecorder.AudioEncoder.AAC
    val encodingBitRate = if (ro.hasKey(androidAudioEncodingBitRateKey)) ro.getInt(androidAudioEncodingBitRateKey) else 128000
    this.sampleRate = if (ro.hasKey(androidAudioSamplingRateKey)) ro.getInt(androidAudioSamplingRateKey) else 44100

    Log.i(tag, " ")
    Log.i(tag, "Coerced:")
    Log.i(tag, "  audioFileURL: " + audioFileURL)
    Log.i(tag, "  recMeteringEnabled: " + recMeteringEnabled)
    Log.i(tag, "  maxRecDurationSec: " + maxRecDurationSec)
    Log.i(tag, "  audioSourceId: " + audioSourceId)
    Log.i(tag, "  outputFormatId: " + outputFormatId)
    Log.i(tag, "  audioEncoderId: " + audioEncoderId)
    Log.i(tag, "  encodingBitRate: " + encodingBitRate)
    Log.i(tag, "  sampleRate:" + this.sampleRate)
    Log.i(tag, "  byteDepth:" + this.byteDepth)
  
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
    mediaRecorder!!.setAudioSource(audioSourceId)
    mediaRecorder!!.setOutputFormat(outputFormatId)
    mediaRecorder!!.setAudioEncoder(audioEncoderId)
    mediaRecorder!!.setAudioEncodingBitRate(encodingBitRate)
    mediaRecorder!!.setAudioSamplingRate(this.sampleRate)
    mediaRecorder!!.setOutputFile(this.audioFileURL)
    
    try {
      mediaRecorder!!.prepare()
      pausedRecordTime = 0L
      totalPausedRecordTime = 0L
      mediaRecorder!!.start()
      val systemTime = SystemClock.elapsedRealtime()
      recorderRunnable = object : Runnable {
        override fun run() {
          val time = SystemClock.elapsedRealtime() - systemTime - totalPausedRecordTime
          if (time.toDouble() > maxRecDurationSec * 1000) {
            if (mediaRecorder != null) {
              Log.i(tag, "Max recording duration reached")
              Log.i(tag, "Sending stoppage event")
              val obj = Arguments.createMap()
              recStopCode = RecStopCode.MaxDurationReached
              obj.putString(EventDetailKey.RecStopCode.str, recStopCode.str)
              sendEvent(reactContext, Event.RecStop.str, obj)
              Log.i(tag, "Stopping recorder")
              stopRecorder(promise)
            }
            return
          }
          val obj = Arguments.createMap()
          obj.putDouble(EventDetailKey.RecElapsedMs.str, time.toDouble())
          obj.putBoolean(EventDetailKey.IsRecording.str, true)
          if (recMeteringEnabled) {
              var maxAmplitude = 0
              if (mediaRecorder != null) {
                  maxAmplitude = mediaRecorder!!.maxAmplitude
              }
              var dB = -160.0
              val maxAudioSize = 32767.0
              if (maxAmplitude > 0) {
                  dB = 20 * log10(maxAmplitude / maxAudioSize)
              }
              obj.putDouble(EventDetailKey.RecMeterLevel.str, dB)
          }
          sendEvent(reactContext, Event.RecUpdate.str, obj)
          recordHandler!!.postDelayed(this, subsDurationMillis.toLong())
        }
      }
      (recorderRunnable as Runnable).run()

      val obj = Arguments.createMap()
      obj.putString("audioFilePath", "file:///$audioFileURL")
      promise.resolve(obj)
    } 
    catch (e: Exception) {
      Log.e(tag, "Exception: ", e)
      return promise.reject("startRecord", e.message)
    }
  }

  @ReactMethod
  fun pauseRecorder(promise: Promise) {
    if (mediaRecorder == null) {
      return promise.reject("pauseRecorder", "Recorder is null.")
    }

    try {
      mediaRecorder!!.pause()
      pausedRecordTime = SystemClock.elapsedRealtime()
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
      return promise.resolve("Recorder paused.")
    } catch (e: Exception) {
      Log.e(tag, "pauseRecorder exception: " + e.message)
      return promise.reject("pauseRecorder", e.message)
    }
  }

  @ReactMethod
  fun resumeRecorder(promise: Promise) {
    if (mediaRecorder == null) {
      return promise.reject("resumeRecorder", "Recorder is null.")
    }

    try {
      totalPausedRecordTime += SystemClock.elapsedRealtime() - pausedRecordTime
      pausedRecordTime = 0L
      mediaRecorder!!.resume()
      recorderRunnable?.let { recordHandler!!.postDelayed(it, subsDurationMillis.toLong()) }
      return promise.resolve("Recorder resumed.")
    } catch (e: Exception) {
      Log.e(tag, "Recorder resume: " + e.message)
      return promise.reject("resumeRecorder", e.message)
    }
  }

  @ReactMethod
  fun stopRecorder(promise: Promise) {
    if (recordHandler != null) {
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
    }

    if (mediaRecorder == null) {
      promise.reject("stopRecord", "recorder is null.")
      return
    }

    try {
      mediaRecorder!!.stop()
      mediaRecorder!!.reset()
      mediaRecorder!!.release()
      mediaRecorder = null
    } catch (exception: Exception) {
      exception.message?.let { Log.d(tag,"" + it) }
      return promise.reject("stopRecorder", exception.message)
    }

    return promise.resolve("file:///$audioFileURL")
  }

  //setVolume()
  //  * MediaPlayer must exist before calling this! Consider using startPlayer's playbackVolume 
  //    parameter instead of calling this.
  //  * relative to 100% of Media Volume
  @ReactMethod
  fun setVolume(volume: Double, promise: Promise) {
    if (mediaPlayer == null) {
      return promise.reject("setVolume", "mediaPlayer is null.")
    }

    val mVolume = volume.toFloat()
    mediaPlayer!!.setVolume(mVolume, mVolume)
    return promise.resolve("set volume")
  }

  @ReactMethod
  fun startPlayer(path: String, httpHeaders: ReadableMap?, playbackVolume:Double, promise: Promise) {
    Log.i(tag, "rn.startPlayer()")

    if (mediaPlayer != null) {
      val isPaused = !mediaPlayer!!.isPlaying && mediaPlayer!!.currentPosition > 1
      if (isPaused) {
        mediaPlayer!!.start()
        return promise.resolve("player resumed.")
      }

      Log.e(tag, "Player is already running. Stop it first.")
      return promise.reject("startPlay", "Player is already running. Stop it first.")
    } 
    else {
      mediaPlayer = MediaPlayer()
    }

    setVolume(playbackVolume, promise)

    try {
      if ((path == "DEFAULT")) {
        mediaPlayer!!.setDataSource("${reactContext.cacheDir}/$DEFAULT_FILE_NAME")
      } 
      else {
        if (httpHeaders != null) {
          val headers: MutableMap<String, String?> = HashMap<String, String?>()
          val iterator = httpHeaders.keySetIterator()
          while (iterator.hasNextKey()) {
              val key = iterator.nextKey()
              headers.put(key, httpHeaders.getString(key))
          }
          mediaPlayer!!.setDataSource(currentActivity!!.applicationContext, Uri.parse(path), headers)
        } 
        else {
          mediaPlayer!!.setDataSource(path)
        }
      }
    
      mediaPlayer!!.setOnPreparedListener { mp ->
        Log.d(tag, "mediaplayer prepared and start")
        mp.start()
        /**
          * Set timer task to send event to RN.
          */
        mTask = object : TimerTask() {
          override fun run() {
            val obj = Arguments.createMap()
            obj.putInt(EventDetailKey.PlayElapsedMs.str, mp.currentPosition)
            obj.putInt(EventDetailKey.PlayDurationMs.str, mp.duration)
            sendEvent(reactContext, Event.PlayUpdate.str, obj)
          }
        }

        mTimer = Timer()
        mTimer!!.schedule(mTask, 0, subsDurationMillis.toLong())
        val resolvedPath = if (((path == "DEFAULT"))) "${reactContext.cacheDir}/$DEFAULT_FILE_NAME" else path
        promise.resolve(resolvedPath)
      }

      /**
        * Detect when finish playing.
        */
      mediaPlayer!!.setOnCompletionListener { mp ->
        /**
          * Send last event
          */
        val obj = Arguments.createMap()
        obj.putInt(EventDetailKey.PlayElapsedMs.str, mp.duration)
        obj.putInt(EventDetailKey.PlayDurationMs.str, mp.duration)
        sendEvent(reactContext, Event.PlayUpdate.str, obj)
        /**
          * Reset player.
          */
        Log.d(tag, "Plays completed.")
        mTimer!!.cancel()
        mp.stop()
        mp.release()
        mediaPlayer = null
      }

      mediaPlayer!!.prepare()
    } 
    catch (e: Exception) {
      var errMsg = "startPlay() error: " + e 
      Log.e(tag, errMsg)
      return promise.reject("startPlay", e.message)
    }
  }

  @ReactMethod
  fun pausePlayer(promise: Promise) {
    if (mediaPlayer == null) {
      return promise.reject("pausePlay", "mediaPlayer is null on pause.")
    }

    try {
      mediaPlayer!!.pause()
      return promise.resolve("pause player")
    } catch (e: Exception) {
      Log.e(tag, "pausePlay exception: " + e.message)
      return promise.reject("pausePlay", e.message)
    }
  }

  @ReactMethod
  fun resumePlayer(promise: Promise) {
    Log.i(tag, "rn.resumePlayer()")

    if (mediaPlayer == null) {
      return promise.reject("resume", "mediaPlayer is null on resume.")
    }

    if (mediaPlayer!!.isPlaying) {
      return promise.reject("resume", "mediaPlayer is already running.")
    }

    try {
      mediaPlayer!!.seekTo(mediaPlayer!!.currentPosition)
      mediaPlayer!!.start()
      return promise.resolve("resume player")
    } 
    catch (e: Exception) {
      Log.e(tag, "mediaPlayer resume: " + e.message)
      return promise.reject("resume", e.message)
    }
  }

  @ReactMethod
  fun stopPlayer(promise: Promise) {
    if (mTimer != null) {
      mTimer!!.cancel()
    }

    if (mediaPlayer == null) {
      return promise.resolve("Already stopped player")
    }

    try {
      mediaPlayer!!.release()
      mediaPlayer = null
      return promise.resolve("stopped player")
    } catch (e: Exception) {
      Log.e(tag, "stopPlay exception: " + e.message)
      return promise.reject("stopPlay", e.message)
    }
  }

  @ReactMethod
  fun seekToPlayer(time: Double, promise: Promise) {
    if (mediaPlayer == null) {
      return promise.reject("seekTo", "mediaPlayer is null on seek.")
    }
    mediaPlayer!!.seekTo(time.toInt())
    return promise.resolve("pause player")
  }

  @ReactMethod
  private fun sendEvent(reactContext: ReactContext,
                        eventName: String,
                        params: WritableMap?) {
    reactContext
      .getJSModule<RCTDeviceEventEmitter>(RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  @ReactMethod
  fun setSubscriptionDuration(sec: Double, promise: Promise) {
    subsDurationMillis = (sec * 1000).toInt()
    return promise.resolve("setSubscriptionDuration: $subsDurationMillis")
  }


  fun initAndroidWavRecorderOptions(requestedOptions: ReadableMap, 
                                    grantedOptions: WritableMap):Boolean {
      
    Log.d(tag, "rn.initWavRecorder()")

    Log.i(tag, "Requested recording options:")
    Log.i(tag, " " + requestedOptions)
    Log.i(tag, " ")

    //Set/coerce recording options
    val ro = requestedOptions
    setAudioFileURL(if (ro.hasKey(audioFilePathKey)) ro.getString(audioFilePathKey) else DEFAULT_WAV_FILE_NAME)
    val recMeteringEnabled = if (ro.hasKey(recMeteringEnabledKey)) ro.getBoolean(recMeteringEnabledKey) else true
    val maxRecDurationSec = if (ro.hasKey(maxRecDurationSecKey)) ro.getDouble(maxRecDurationSecKey) else DEFAULT_MAX_RECORDING_DURATION_SEC
    //Android specific
    val audioSourceId = if (ro.hasKey(androidAudioSourceIdKey)) ro.getInt(androidAudioSourceIdKey) else MediaRecorder.AudioSource.MIC
    val outputFormatId = if (ro.hasKey(androidOutputFormatIdKey)) ro.getInt(androidOutputFormatIdKey) else 999 //Co-opting 999 for WAV
    val audioEncoderId = if (ro.hasKey(androidAudioEncoderIdKey)) ro.getInt(androidAudioEncoderIdKey) else 999 //Co-opting 999 for LPCM
    this.sampleRate = if (ro.hasKey(androidAudioSamplingRateKey)) ro.getInt(androidAudioSamplingRateKey) else 44100
    //Android WAV/LPCM-specific
    this.byteDepth = if (ro.hasKey(androidWavByteDepthKey)) ro.getInt(androidWavByteDepthKey) else 2
    this.numChannels = if (ro.hasKey(androidWavNumberOfChannelsKey)) ro.getInt(androidWavNumberOfChannelsKey) else 1

    Log.i(tag, " ")
    Log.i(tag, "Coerced:")
    Log.i(tag, "  audioFilePath: " + audioFileURL)
    Log.i(tag, "  recMeteringEnabled: " + recMeteringEnabled)
    Log.i(tag, "  maxRecDurationSec: " + maxRecDurationSec)
    Log.i(tag, "  audioSourceId: " + audioSourceId)
    Log.i(tag, "  outputFormatId: " + outputFormatId)
    Log.i(tag, "  audioEncoderId: " + audioEncoderId)
    Log.i(tag, "  sampleRate:" + this.sampleRate)
    Log.i(tag, "  byteDepth:" + this.byteDepth)
    Log.i(tag, "  numChannels:" + this.numChannels)

    this.maxNumSamples = this.sampleRate * maxRecDurationSec.toInt()
    if (this.maxNumSamples > (sampleRate * ABSOLUTE_MAX_DURATION_SEC)) { //Coerce if necessary
      this.maxNumSamples = (sampleRate * ABSOLUTE_MAX_DURATION_SEC).toInt() // *** INT BIG ENOUGH??? ***
    }
 
    this.tempRawPCMDataFilePath = "${reactContext.cacheDir}" + "/" + "temp.pcm"
    
    val minFrameBufferSize = AudioRecord.getMinBufferSize(sampleRate, getChannelConfig(), getPCMEncoding())
    if (minFrameBufferSize < 0) {
      if (minFrameBufferSize == AudioRecord.ERROR_BAD_VALUE) {
        Log.e(tag, "Error: minFrameBufferSize == " + AudioRecord.ERROR_BAD_VALUE + ". Recording parameters not supported by hardware, or invalid parameter passed.")
      }
      if (minFrameBufferSize == AudioRecord.ERROR) {
        Log.e(tag, "Error: minFrameBufferSize == " +  AudioRecord.ERROR + ". Implementation unable to query hardware for input properties.")
      }
      return false
    }
    frameBufferSize = minFrameBufferSize * 2

    try {
      audioRecord = AudioRecord(audioSourceId, this.sampleRate, getChannelConfig(), getPCMEncoding(), frameBufferSize!!)
    }
    catch (e: Exception) {
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
    this.sampleRate = audioRecord!!.getSampleRate()
    this.numChannels = audioRecord!!.getChannelCount()
    this.byteDepth = if (audioRecord!!.getAudioFormat() == android.media.AudioFormat.ENCODING_PCM_8BIT) 1 else 2

    //Granted params   
    grantedOptions.putString(androidAudioSourceIdKey, this.audioFileURL)
    grantedOptions.putBoolean(recMeteringEnabledKey, this.recMeteringEnabled)
    grantedOptions.putDouble(maxRecDurationSecKey, maxRecDurationSec)
    grantedOptions.putDouble(androidAudioSourceIdKey, audioSourceId.toDouble())
    grantedOptions.putDouble(androidOutputFormatIdKey, outputFormatId.toDouble())
    grantedOptions.putDouble(androidAudioEncoderIdKey, audioEncoderId.toDouble())
    grantedOptions.putDouble(androidAudioSamplingRateKey, this.sampleRate.toDouble())
    grantedOptions.putDouble(androidWavNumberOfChannelsKey, this.numChannels.toDouble())
    grantedOptions.putDouble(androidWavByteDepthKey, this.byteDepth.toDouble())

    return true
  }

  @ReactMethod
  public fun startAndroidWavRecorder(recordingOptions: ReadableMap, promise:Promise) {

    Log.d(tag, "rn.startWavRecorder()")

    isRecordingWav = true
    recStopCode = RecStopCode.UserRequest //Start by assuming a no-error result

    if (ensurePermissionsSecured() == false) {
      Log.d(tag, "   ensurePermissionsSecured() == false")
      return promise.reject(PERMISSION_NOT_GRANTED_STR, TRY_AGAIN_AFTER_ADDING_PERMISSIONS_STR)
    }

    val requestedOptions = recordingOptions
    val grantedOptions = Arguments.createMap()
    if (initAndroidWavRecorderOptions(requestedOptions, grantedOptions) == false) {
      Log.d(tag, "   initWavRecorder() == false")
      return promise.reject("Unable to initialize the recorder.", "Check parameters, and try again.")
    }
    Log.i(tag, "granted options: " + grantedOptions)
    
    val systemTime = SystemClock.elapsedRealtime()

    recorderRunnable = object : Runnable {
      override fun run() {
        val time = SystemClock.elapsedRealtime() - systemTime - totalPausedRecordTime
        val obj = Arguments.createMap()
        obj.putDouble(EventDetailKey.RecElapsedMs.str, time.toDouble())
        obj.putBoolean(EventDetailKey.IsRecording.str, true)
        if (recMeteringEnabled) {
          obj.putDouble(EventDetailKey.RecMeterLevel.str, calcWavMeteringVolume())
        }
        sendEvent(reactContext, Event.RecUpdate.str, obj)
        recordHandler!!.postDelayed(this, subsDurationMillis.toLong())
      }
    }
    
    pausedRecordTime = 0L
    totalPausedRecordTime = 0L
    audioRecord!!.startRecording()

    Thread {
      var fos:FileOutputStream? = null
      try {
        var frameCount = 0
        var numSamplesProcessed = 0
        wavFrameData = ByteArray(frameBufferSize!!){0}
        wavFrameDataContentSize = frameBufferSize //Starting value
        
        (recorderRunnable as Runnable).run()
        fos = FileOutputStream(File(this.tempRawPCMDataFilePath!!), false)
        while (isRecordingWav && numSamplesProcessed <= maxNumSamples) {

          //Pause loop
          while (audioRecorderIsPaused() && isRecordingWav) {
            Thread.sleep(30)
          }
          //If we've broken out of the pause loop because we're
          //no longer recording, i.e: stopping, not resuming...
          if (isRecordingWav == false) {
              break //OUTER while loop
          }

          val bytesRead = audioRecord!!.read(wavFrameData!!, 0, wavFrameData!!.size)
          if (bytesRead > 0 && ++frameCount > 2) { // skip first 2, to eliminate "click sound"

            val bytesPerPacket:Int = byteDepth * numChannels
            var numSamplesToProcess:Int = bytesRead / bytesPerPacket
            if (numSamplesProcessed + numSamplesToProcess >= maxNumSamples) {
              numSamplesToProcess = maxNumSamples - numSamplesProcessed
              isRecordingWav = false
              recStopCode = RecStopCode.MaxDurationReached
            }

            wavFrameDataContentSize = numSamplesToProcess * bytesPerPacket
            fos.write(wavFrameData!!, 0, wavFrameDataContentSize!!)

            numSamplesProcessed += numSamplesToProcess
          }
        }

        fos.close()
        saveAsWav()
      }
      catch (e:Exception) {
        e.printStackTrace()
        recStopCode = RecStopCode.Error
      }
      finally {
        if (fos != null) {
          try {
            fos.close()
          } catch (e:Exception) {
            e.printStackTrace()
            recStopCode = RecStopCode.Error
          }
        }
        
        deleteTempFile()

        if (recordHandler != null) {
          recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
        }

        if (audioRecord != null) {
          audioRecord!!.stop()
          audioRecord!!.release()
          audioRecord = null
        }

        //Send stop event to js
        Log.i(tag, "A")
        val obj = Arguments.createMap()
        obj.putString(EventDetailKey.RecStopCode.str, recStopCode.str)        
        sendEvent(reactContext, Event.RecStop.str, obj)
      }
    }.start()
  
    val result = Arguments.createMap()
    result.putMap("grantedOptions:", grantedOptions)
    result.putString("file", "file:///$audioFileURL")
    return promise.resolve(result)
  }

  @ReactMethod
  fun pauseAndroidWavRecorder(promise: Promise) {
    Log.d(tag, "rn.pauseWavRecorder()")

    if (audioRecord == null) {
      Log.d(tag, "   audioRecord == null")
      return promise.reject("pauseWavRecorder: ", "audioRecord was null on pause.")
    }

    if (audioRecoderIsRecording() == false) {
      Log.d(tag, "   audioRecoderIsRecording() == false")
      return promise.resolve("pauseWavRecorder: audioRecord was not recording.")
    }

    if (pausedRecordTime != 0L) {
      Log.d(tag, "   pausedRecordTime != 0L")
      return promise.resolve("pauseWavRecorder: audioRecord was already paused")
    }

    try {
      Log.d(tag, "   removing record callbacks")
      pausedRecordTime = SystemClock.elapsedRealtime()
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
      return promise.resolve("pauseWavRecorder: Paused wav recording")
    } 
    catch (e: Exception) {
      Log.e(tag, "pauseWavRecorder exception: " + e.message)
      return promise.reject("pauseWavRecorder", e.message)
    }      
  }

  @ReactMethod
  fun resumeAndroidWavRecorder(promise: Promise) {
    Log.d(tag, "rn.resumeWavRecorder()")

    if (audioRecord == null) {
        Log.d(tag, "   audioRecord == null")
        return promise.resolve("resumeWavRecorder: audioRecord was null on resume.")
    }

    if (audioRecoderIsRecording() == false) {
        Log.d(tag, "   audioRecoderIsRecording() == false")
        return promise.resolve("resumeWavRecorder: audioRecord is not recording.")
    }

    if (audioRecorderIsPaused() == false) {
        Log.d(tag, "   audioRecorderIsPaused() == false")
        return promise.resolve("resumeWavRecorder: audioRecord was not paused")
    }

    try {
      totalPausedRecordTime += SystemClock.elapsedRealtime() - pausedRecordTime
      pausedRecordTime = 0L
      Log.d(tag, "   re-posting recordHandler")
      recorderRunnable?.let { recordHandler!!.postDelayed(it, subsDurationMillis.toLong()) }
      return promise.resolve("resumeWavRecorder: Wav recording resumed.")
    } 
    catch (e: Exception) {
      Log.e(tag, "resumeWavRecorder Error: " + e.message)
      return promise.reject("resumeWavRecorder Error: ", e.message)
    } 
  }

  @ReactMethod
  public fun stopAndroidWavRecorder(promise:Promise) {

    Log.d(tag, "rn.stopWavRecorder()")

    if (recordHandler != null) {
        Log.d(tag, "   removing record callbacks")
        recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
    }

    if (audioRecord == null) {
        return promise.resolve("wavRecorder already stopped (audioRecord is null).")
    }

    Log.d(tag, "   setting recStopCode=RecStopCode.UserRequest and isRecordingWav=false")
    //Actually stopping the recorder, and informing the UI, 
    //happens in thread launched from startWavRecorder()
    recStopCode = RecStopCode.UserRequest
    isRecordingWav = false

    //Wait for the recorder to be stopped
    Log.d(tag, "   waiting for audioRecord to be destroyed")
    while (audioRecord != null) {
      Log.i(tag, "Sleeping...")
      Thread.sleep(10)
    }

    return promise.resolve("file:///$audioFileURL")
  }



  private fun saveAsWav() {
    Log.i(tag, "saveAsWav()")
    if (this.tempRawPCMDataFilePath == null || this.audioFileURL == "") {
      throw Exception("saveAsWav() - Null or empty file path.")
    }

    Log.d(tag, "Saving " + audioFileURL + "...")

    //Write wav file
    //Approach: https://medium.com/@sujitpanda/file-read-write-with-kotlin-io-31eff564dfe3
    var fileInputStream = FileInputStream(this.tempRawPCMDataFilePath!!)
    var fileOutputStream = FileOutputStream(File(audioFileURL), false)
    fileInputStream.use { fis:FileInputStream ->
      fileOutputStream.use { fos:FileOutputStream ->
        //Header
        val numSampleDataBytes:Long = fis.getChannel().size()
        addWavHeader(fileOutputStream, numSampleDataBytes)
        //Data
        fileInputStream.copyTo(fileOutputStream)
        Log.d(tag, "wav file path:" + audioFileURL)
        Log.d(tag, "wav file size:" + fos.getChannel().size())
        fos.flush()
        fos.close()
      }
      Log.d(tag, "Closing input file.")
      fileInputStream.close()
    }
    Log.d(tag, "Done save.")
  }

  private fun toByte(c:Char):Byte {
    return c.code.toByte() 
  }

  private fun addWavHeader(fileOutputStream:FileOutputStream, numSampleDataBytes:Long) {

      Log.d(tag, "addWavHeader()")

      val byteRate:Int = sampleRate * numChannels * byteDepth
      val blockAlign:Int = numChannels * byteDepth

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
      header[34] = (byteDepth * 8).toByte()                  // bits in (one channel of a) sample
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
    Log.d(tag, "deleteTempFile()")
    if (this.tempRawPCMDataFilePath != null) {
      val f:File = File(this.tempRawPCMDataFilePath!!)
      f.delete()
    }
  }

  private fun audioRecoderIsRecording():Boolean { //But may be paused
    Log.i(tag, "rn.audioRecoderIsRecording()")
    if (audioRecord == null) {
      Log.i(tag, "   audioRecord == null returning false")
      return false
    }
    val audioRecordState = audioRecord!!.getState()
    Log.i(tag, "   audioRecordState:" + audioRecordState)
    Log.i(tag, "   returning " + (audioRecordState == AudioRecord.RECORDSTATE_RECORDING || audioRecordState == AudioRecord.READ_NON_BLOCKING || audioRecordState == AudioRecord.READ_BLOCKING))
    return (
      audioRecordState == AudioRecord.RECORDSTATE_RECORDING ||
      audioRecordState == AudioRecord.READ_NON_BLOCKING ||
      audioRecordState == AudioRecord.READ_BLOCKING
    )
  }

  private fun audioRecorderIsPaused():Boolean { //While recording
    Log.i(tag, "rn.audioRecorderIsPaused()")
    Log.i(tag, "   will return: " + (pausedRecordTime != 0L))
    return (pausedRecordTime != 0L)
  }

  private fun getChannelConfig():Int {
    if (this.numChannels == 2) {
      return AudioFormat.CHANNEL_IN_STEREO
    }
    else {
      return AudioFormat.CHANNEL_IN_MONO
    }
  }

  private fun getPCMEncoding():Int {
    if (this.byteDepth == 2) {
      return AudioFormat.ENCODING_PCM_16BIT
    }
    else {
      return AudioFormat.ENCODING_PCM_8BIT
    }
  }


  private fun calcWavMeteringVolume():Double { //channels interleaved

    val MAX_METER_LEVEL:Double = 0.0
    val MIN_METER_LEVEL:Double = -100.0

    // * Output in dBFS: dB relative to full scale
    // * Only includes contributions of channel-1 samples

    var sumVolume:Double = 0.0
    val numBytes:Int = wavFrameDataContentSize!!
    var numSamples:Int = numBytes / (byteDepth * numChannels)
    if (byteDepth == 2) {
      val bufferInt16:ShortArray = ShortArray(numSamples * numChannels)
      val byteBuffer:ByteBuffer = ByteBuffer.wrap(wavFrameData!!, 0, numBytes)
      byteBuffer.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(bufferInt16)
      for (i in 0..(numSamples-1)) {
        sumVolume += Math.abs((bufferInt16[i * numChannels]).toDouble())
      }
    }
    else { //byteDepth of 1
      for (i in 0..(numSamples-1)) {
        var s = (wavFrameData!![i * numChannels].toInt() and 0xFF) - 127        
        sumVolume +=  Math.abs(s.toDouble())
      }
    }

    var avgVolume:Double = sumVolume / numSamples
    if (byteDepth == 1) {
      avgVolume /= Byte.MAX_VALUE.toDouble()
    } 
    else { //byteDepth == 2
      avgVolume /= Short.MAX_VALUE.toDouble()
    }

    var dbFS:Double = 0.0 //Discontinuity at 0
    if (avgVolume > 0.0) {
      dbFS = 20 * Math.log10(avgVolume)
    }

    if (dbFS < MIN_METER_LEVEL) {
      dbFS = MIN_METER_LEVEL
    }
    if (dbFS > MAX_METER_LEVEL) {
      dbFS = MAX_METER_LEVEL
    }

    return dbFS
  }

}
