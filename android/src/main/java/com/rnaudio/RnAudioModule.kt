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

  //Events passed from native -> js
  private val EVENT_ID_RECORDING_CALLBACK = "rn-recording-callback"
  private val EVENT_ID_PLAYING_CALLBACK = "rn-playing-callback"
  private val EVENT_ID_STOPPAGE_CALLBACK = "rn-stoppage-callback"  // When recording (and playback?) stops, provides reason

  //Event metadata keys
  private val STOP_CODE_KEY = "stopCode"
  private val IS_RECORDING_KEY = "isRecording"
  private val METER_LEVEL_KEY = "meterLevel"
  private val IS_MUTED_KEY = "isMuted"
  private val RECORDING_ELAPSED_MS_KEY = "recordingElapsedMs"
  private val PLAYBACK_ELAPSED_MS_KEY = "playbackElapsedMs"
  private val PLAYBACK_DURATION_MS_KEY = "playbackDurationMs"

  private val DEFAULT_MAX_RECORDING_DURATION_SEC = 10.0

  private val permissionsNotGranted = "One or more required permissions (RECORD_AUDIO, WRITE_EXTERNAL_STORAGE) not granted."
  private val tryAgainAfterAddingPermissions = "Try again after adding permission(s)."

  private var audioFileURL = ""
  private var subsDurationMillis = 500
  private var _meteringEnabled = false
  private var mediaRecorder: MediaRecorder? = null
  private var mediaPlayer: MediaPlayer? = null
  private var recorderRunnable: Runnable? = null
  private var mTask: TimerTask? = null
  private var mTimer: Timer? = null
  @Volatile
  private var pausedRecordTime = 0L  //Value of 0 used secondarily to signify "not paused"
  private var totalPausedRecordTime = 0L
  var recordHandler: Handler? = Handler(Looper.getMainLooper())

  companion object {
    private val tag = "RnAudio"
    private val DEFAULT_FILE_NAME = "recording.mp4"
  }

  override fun getName(): String {
    return tag
  }

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
    if (path == null || path == "DEFAULT") {
      this.audioFileURL = "${reactContext.cacheDir}/$DEFAULT_FILE_NAME"
    } 
    else {
      this.audioFileURL = path
    }
  }


  @ReactMethod
  fun startRecorder(recordingOptions: ReadableMap, promise: Promise) {
      
    if (ensurePermissionsSecured() == false) {
      promise.reject(permissionsNotGranted, tryAgainAfterAddingPermissions)
      return
    }

    if (mediaRecorder == null) {
      if (Build.VERSION.SDK_INT < 31) {
        mediaRecorder = MediaRecorder() //Old constructor
      }
      else {
        mediaRecorder = MediaRecorder(reactContext) //New constructor
      }
    }

    val ro = recordingOptions

    //Shared
    setAudioFileURL(ro.getString("audioFilePath"))
    this.meteringEnabled = ro.getBool("meteringEnabled") ?: true
    this.maxRecordingDurationSec = ro.getDouble("maxRecordingDurationSec") ?: DEFAULT_MAX_RECORDING_DURATION_SEC
    //Android specific
    mediaRecorder!!.setAudioSource(ro.getInt("androidAudioSourceId") ?: MediaRecorder.AudioSource.MIC)
    mediaRecorder!!.setOutputFormat(ro.getInt("androidOutputFormatId") ?: MediaRecorder.OutputFormat.MPEG_4)
    mediaRecorder!!.setAudioEncoder(audioSet.getInt("androidAudioEncoderId") ?: MediaRecorder.AudioEncoder.AAC)
    mediaRecorder!!.setAudioEncodingBitRate(audioSet.getInt("androidAudioEncodingBitRate") else 128000)
    mediaRecorder!!.setAudioSamplingRate(ro.getInt("androidAudioSamplingRate") ?: 48000)
    //Android WAV/LPCM-specific
    this.byteDepth = ro.getInt("androidAudioSamplingRate") ?: 2


    /*
    if (audioSet != null) {
      mediaRecorder!!.setOutputFormat(if (audioSet.hasKey("OutputFormatAndroid")) audioSet.getInt("OutputFormatAndroid") else MediaRecorder.OutputFormat.MPEG_4)
      mediaRecorder!!.setAudioEncoder(if (audioSet.hasKey("AudioEncoderAndroid")) audioSet.getInt("AudioEncoderAndroid") else MediaRecorder.AudioEncoder.AAC)
      mediaRecorder!!.setAudioSamplingRate(if (audioSet.hasKey("AudioSamplingRateAndroid")) audioSet.getInt("AudioSamplingRateAndroid") else 48000)
      mediaRecorder!!.setAudioEncodingBitRate(if (audioSet.hasKey("AudioEncodingBitRateAndroid")) audioSet.getInt("AudioEncodingBitRateAndroid") else 128000)
    } else {
      mediaRecorder!!.setAudioSource(MediaRecorder.AudioSource.MIC)
      mediaRecorder!!.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      mediaRecorder!!.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      mediaRecorder!!.setAudioEncodingBitRate(128000)
      mediaRecorder!!.setAudioSamplingRate(48000)
    }
    */
    
    mediaRecorder!!.setOutputFile(audioFileURL)

    try {
      mediaRecorder!!.prepare()
      pausedRecordTime = 0L
      totalPausedRecordTime = 0L
      mediaRecorder!!.start()
      val systemTime = SystemClock.elapsedRealtime()
      recorderRunnable = object : Runnable {
        override fun run() {
          val time = SystemClock.elapsedRealtime() - systemTime - totalPausedRecordTime
          if (time.toDouble() > maxRecordingDurationSec * 1000) {
            if (mediaRecorder != null) {
              Log.i(tag, "Max recording duration reached")
              Log.i(tag, "Sending stoppage event")
              val obj = Arguments.createMap()
              stopCode = STOP_CODE_MAX_RECORDING_DURATION_REACHED
              obj.putString(STOP_CODE_KEY, stopCode)
              sendEvent(reactContext, EVENT_ID_STOPPAGE_CALLBACK, obj)
              Log.i(tag, "Stopping recorder")
              stopRecorder(promise)
            }
            return
          }
          val obj = Arguments.createMap()
          obj.putDouble(RECORDING_ELAPSED_MS_KEY, time.toDouble())
          obj.putBoolean(IS_RECORDING_KEY, true)
          if (_meteringEnabled) {
              var maxAmplitude = 0
              if (mediaRecorder != null) {
                  maxAmplitude = mediaRecorder!!.maxAmplitude
              }
              var dB = -160.0
              val maxAudioSize = 32767.0
              if (maxAmplitude > 0) {
                  dB = 20 * log10(maxAmplitude / maxAudioSize)
              }
              obj.putDouble(METER_LEVEL_KEY, dB)
          }
          sendEvent(reactContext, EVENT_ID_RECORDING_CALLBACK, obj)
          recordHandler!!.postDelayed(this, subsDurationMillis.toLong())
        }
      }
      (recorderRunnable as Runnable).run()
      promise.resolve("file:///$audioFileURL")
    } catch (e: Exception) {
      Log.e(tag, "Exception: ", e)
      promise.reject("startRecord", e.message)
    }
  }

  @ReactMethod
  fun pauseRecorder(promise: Promise) {
    if (mediaRecorder == null) {
      promise.reject("pauseRecorder", "Recorder is null.")
      return
    }

    try {
      mediaRecorder!!.pause()
      pausedRecordTime = SystemClock.elapsedRealtime()
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
      promise.resolve("Recorder paused.")
    } catch (e: Exception) {
      Log.e(tag, "pauseRecorder exception: " + e.message)
      promise.reject("pauseRecorder", e.message)
    }
  }

  @ReactMethod
  fun resumeRecorder(promise: Promise) {
    if (mediaRecorder == null) {
      promise.reject("resumeRecorder", "Recorder is null.")
      return
    }

    try {
      mediaRecorder!!.resume()
      totalPausedRecordTime += SystemClock.elapsedRealtime() - pausedRecordTime
      pausedRecordTime = 0L //-KL
      recorderRunnable?.let { recordHandler!!.postDelayed(it, subsDurationMillis.toLong()) }
      promise.resolve("Recorder resumed.")
    } catch (e: Exception) {
      Log.e(tag, "Recorder resume: " + e.message)
      promise.reject("resumeRecorder", e.message)
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
    } catch (stopException: RuntimeException) {
      stopException.message?.let { Log.d(tag,"" + it) }
      promise.reject("stopRecord", stopException.message)
    }

    mediaRecorder!!.release()
    mediaRecorder = null

    promise.resolve("file:///$audioFileURL")
  }

  //setVolume()
  //  * MediaPlayer must exist before calling this! Consider using startPlayer's playbackVolume 
  //    parameter instead of calling this.
  //  * relative to 100% of Media Volume
  @ReactMethod
  fun setVolume(volume: Double, promise: Promise) {
    if (mediaPlayer == null) {
      promise.reject("setVolume", "mediaPlayer is null.")
      return
    }

    val mVolume = volume.toFloat()
    mediaPlayer!!.setVolume(mVolume, mVolume)
    promise.resolve("set volume")
  }

  @ReactMethod
  fun startPlayer(path: String, httpHeaders: ReadableMap?, playbackVolume:Double, promise: Promise) {
    Log.i(tag, "rn.startPlayer()")

    if (mediaPlayer != null) {
      val isPaused = !mediaPlayer!!.isPlaying && mediaPlayer!!.currentPosition > 1
      if (isPaused) {
        mediaPlayer!!.start()
        promise.resolve("player resumed.")
        return
      }

      Log.e(tag, "Player is already running. Stop it first.")
      promise.reject("startPlay", "Player is already running. Stop it first.")
      return
    } 
    else {
      mediaPlayer = MediaPlayer()
    }

    setVolume(playbackVolume, promise)

    try {
      if ((path == "DEFAULT")) {
        mediaPlayer!!.setDataSource("${reactContext.cacheDir}/$defaultFileName")
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
            obj.putInt(PLAYBACK_ELAPSED_MS_KEY, mp.currentPosition)
            obj.putInt(PLAYBACK_DURATION_MS_KEY, mp.duration)
            sendEvent(reactContext, EVENT_ID_PLAYING_CALLBACK, obj)
          }
        }

        mTimer = Timer()
        mTimer!!.schedule(mTask, 0, subsDurationMillis.toLong())
        val resolvedPath = if (((path == "DEFAULT"))) "${reactContext.cacheDir}/$defaultFileName" else path
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
        obj.putInt(PLAYBACK_ELAPSED_MS_KEY, mp.duration)
        obj.putInt(PLAYBACK_DURATION_MS_KEY, mp.duration)
        sendEvent(reactContext, EVENT_ID_PLAYING_CALLBACK, obj)
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
    } catch (e: IOException) {
      Log.e(tag, "startPlay() io exception")
      promise.reject("startPlay", e.message)
    } catch (e: NullPointerException) {
      Log.e(tag, "startPlay() null exception")
    }
  }

  @ReactMethod
  fun pausePlayer(promise: Promise) {
    if (mediaPlayer == null) {
      promise.reject("pausePlay", "mediaPlayer is null on pause.")
      return
    }

    try {
      mediaPlayer!!.pause()
      promise.resolve("pause player")
    } catch (e: Exception) {
      Log.e(tag, "pausePlay exception: " + e.message)
      promise.reject("pausePlay", e.message)
    }
  }

  @ReactMethod
  fun resumePlayer(promise: Promise) {
    Log.i(tag, "rn.resumePlayer()")

    if (mediaPlayer == null) {
      promise.reject("resume", "mediaPlayer is null on resume.")
      return
    }

    if (mediaPlayer!!.isPlaying) {
      promise.reject("resume", "mediaPlayer is already running.")
      return
    }

    try {
      mediaPlayer!!.seekTo(mediaPlayer!!.currentPosition)
      mediaPlayer!!.start()
      promise.resolve("resume player")
    } catch (e: Exception) {
      Log.e(tag, "mediaPlayer resume: " + e.message)
      promise.reject("resume", e.message)
    }
  }

  @ReactMethod
  fun stopPlayer(promise: Promise) {
    if (mTimer != null) {
      mTimer!!.cancel()
    }

    if (mediaPlayer == null) {
      promise.resolve("Already stopped player")
      return
    }

    try {
      mediaPlayer!!.release()
      mediaPlayer = null
      promise.resolve("stopped player")
    } catch (e: Exception) {
      Log.e(tag, "stopPlay exception: " + e.message)
      promise.reject("stopPlay", e.message)
    }
  }

  @ReactMethod
  fun seekToPlayer(time: Double, promise: Promise) {
    if (mediaPlayer == null) {
      promise.reject("seekTo", "mediaPlayer is null on seek.")
      return
    }

    mediaPlayer!!.seekTo(time.toInt())
    promise.resolve("pause player")
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
    promise.resolve("setSubscriptionDuration: $subsDurationMillis")
  }



  // **** New vals, var &  methods, for recording WAV files ****

  private val ABSOLUTE_MAX_DURATION:Int = 60 * 60 * 8 //Seconds

  private val STOP_CODE_USER_REQUEST = "user-request"
  private val STOP_CODE_MAX_RECORDING_DURATION_REACHED = "max-recording-duration-reached"
  private val STOP_CODE_ERROR = "error"
  private var stopCode:String? = null

  private val MAX_VOLUME:Double = 0.0
  private val MIN_VOLUME:Double = -100.0

  //Member vars, with defaults where possible

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


  fun initWavRecorderParams(requestedWavParams: ReadableMap, grantedParams: WritableMap):Boolean {
      
    Log.d(tag, "rn.initWavRecorder()")

    val sampleRateKey = "sampleRate"
    val numChannelsKey = "numChannels"
    val byteDepthKey = "byteDepth"
    val audioSourceKey = "audioSource"

    if (requestedWavParams.hasKey(sampleRateKey)) {
      sampleRate = requestedWavParams.getInt(sampleRateKey)
    }

    if (requestedWavParams.hasKey(numChannelsKey)) {
      numChannels = requestedWavParams.getInt(numChannelsKey)
      if (numChannels <= 0) { //Coerce, if necessary
        numChannels = 1
      }
      else if (numChannels > 2) {
        numChannels = 2
      }
    }

    if (requestedWavParams.hasKey(byteDepthKey)) {
      byteDepth = requestedWavParams.getInt(byteDepthKey)
      if (byteDepth <= 0) { //Coerce if necessary
        byteDepth = 1
      }
      else if (byteDepth > 2) {
        byteDepth = 2
      }
    }

    var audioSource = AudioSource.VOICE_RECOGNITION
    if (requestedWavParams.hasKey(audioSourceKey)) {
      audioSource = requestedWavParams.getInt(audioSourceKey)
    }

    val minFrameBufferSize = AudioRecord.getMinBufferSize(sampleRate, getChannelConfig(), getAudioFormat())
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
      audioRecord = AudioRecord(audioSource, sampleRate, getChannelConfig(), getAudioFormat(), frameBufferSize!!)
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
    sampleRate = audioRecord!!.getSampleRate()
    numChannels = audioRecord!!.getChannelCount()
    byteDepth = if (audioRecord!!.getAudioFormat() == android.media.AudioFormat.ENCODING_PCM_8BIT) 1 else 2

    //Granted params    
    grantedParams.putDouble(sampleRateKey, sampleRate.toDouble())
    grantedParams.putDouble(numChannelsKey, numChannels.toDouble())
    grantedParams.putDouble(byteDepthKey, byteDepth.toDouble())
    grantedParams.putDouble(audioSourceKey, audioSource.toDouble())

    return true
  }

  @ReactMethod
  public fun startWavRecorder(recordingOptions: ReadableMap, promise:Promise) {

    val ro = recordingOptions

    Log.d(tag, "rn.startWavRecorder()")

    Log.d(tag, "   setting isRecordingWav to true")
    Log.d(tag, "   setting stopCode to USER_REQUEST")
    isRecordingWav = true
    stopCode = STOP_CODE_USER_REQUEST //Start by assuming a no-error result

    if (ensurePermissionsSecured() == false) {
      Log.d(tag, "   ensurePermissionsSecured() == false")
      promise.reject(permissionsNotGranted, tryAgainAfterAddingPermissions)
      return
    }

    val grantedParams = Arguments.createMap()
    if (initWavRecorderParams(requestedWavParams, grantedParams) == false) {
      Log.d(tag, "   initWavRecorder() == false")
      promise.reject("Unable to initialize the recorder.", "Check parameters, and try again.")
      return
    }
    Log.i(tag, "granted params: " + grantedParams)

    val dirPath = "${reactContext.cacheDir}"
    tempRawPCMDataFilePath = dirPath + "/" + "temp.pcm"
    val defaultAudioFileURL = dirPath + "/" + "recording.wav"
    audioFileURL = if (((path == "DEFAULT"))) defaultAudioFileURL else path
    
    _meteringEnabled = meteringEnabled
    
    maxNumSamples = sampleRate * maxRecordingDurationSec.toInt()
    if (maxNumSamples > (sampleRate * ABSOLUTE_MAX_DURATION)) { //Coerce if necessary
      maxNumSamples = (sampleRate * ABSOLUTE_MAX_DURATION)
    }
    
    val systemTime = SystemClock.elapsedRealtime()

    recorderRunnable = object : Runnable {
      override fun run() {
        val time = SystemClock.elapsedRealtime() - systemTime - totalPausedRecordTime
        val obj = Arguments.createMap()
        obj.putDouble(RECORDING_ELAPSED_KEY, time.toDouble())
        obj.putBoolean(IS_RECORDING_KEY, true)
        if (_meteringEnabled) {
          obj.putDouble(METER_LEVEL_KEY, calcWavMeteringVolume())
        }
        sendEvent(reactContext, EVENT_ID_RECORDING_CALLBACK, obj)
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
        fos = FileOutputStream(File(tempRawPCMDataFilePath!!), false)
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
              stopCode = STOP_CODE_MAX_RECORDING_DURATION_REACHED
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
        stopCode = STOP_CODE_ERROR
      }
      finally {
        if (fos != null) {
          try {
            fos.close()
          } catch (e:Exception) {
            e.printStackTrace()
            stopCode = STOP_CODE_ERROR
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
        obj.putString(STOP_CODE_KEY, stopCode)        
        sendEvent(reactContext, EVENT_ID_STOPPAGE_CALLBACK, obj)
      }
    }.start()
  
    val result = Arguments.createMap()
    result.putMap("grantedWavParams:", grantedParams)
    result.putString("file", "file:///$audioFileURL")
    promise.resolve(result)
  }

  @ReactMethod
  fun pauseWavRecorder(promise: Promise) {
    Log.d(tag, "rn.pauseWavRecorder()")

    if (audioRecord == null) {
      Log.d(tag, "   audioRecord == null")
      promise.reject("pauseWavRecorder: ", "audioRecord was null on pause.")
      return
    }

    if (audioRecoderIsRecording() == false) {
      Log.d(tag, "   audioRecoderIsRecording() == false")
      promise.resolve("pauseWavRecorder: audioRecord was not recording.")
      return
    }

    if (pausedRecordTime != 0L) {
      Log.d(tag, "   pausedRecordTime != 0L")
      promise.resolve("pauseWavRecorder: audioRecord was already paused")
      return
    }

    try {
      Log.d(tag, "   removing record callbacks")
      pausedRecordTime = SystemClock.elapsedRealtime()
      recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
      promise.resolve("pauseWavRecorder: Paused wav recording")
    } 
    catch (e: Exception) {
      Log.e(tag, "pauseWavRecorder exception: " + e.message)
      promise.reject("pauseWavRecorder", e.message)
    }      
  }

  @ReactMethod
  fun resumeWavRecorder(promise: Promise) {
    Log.d(tag, "rn.resumeWavRecorder()")

    if (audioRecord == null) {
        Log.d(tag, "   audioRecord == null")
        promise.resolve("resumeWavRecorder: audioRecord was null on resume.")
        return
    }

    if (audioRecoderIsRecording() == false) {
        Log.d(tag, "   audioRecoderIsRecording() == false")
        promise.resolve("resumeWavRecorder: audioRecord is not recording.")
        return
    }

    if (audioRecorderIsPaused() == false) {
        Log.d(tag, "   audioRecorderIsPaused() == false")
        promise.resolve("resumeWavRecorder: audioRecord was not paused")
        return
    }

    try {
      totalPausedRecordTime += SystemClock.elapsedRealtime() - pausedRecordTime
      pausedRecordTime = 0L
      Log.d(tag, "   re-posting recordHandler")
      recorderRunnable?.let { recordHandler!!.postDelayed(it, subsDurationMillis.toLong()) }
      promise.resolve("resumeWavRecorder: Wav recording resumed.")
    } 
    catch (e: Exception) {
      Log.e(tag, "resumeWavRecorder Error: " + e.message)
      promise.reject("resumeWavRecorder Error: ", e.message)
    } 
  }

  @ReactMethod
  public fun stopWavRecorder(promise:Promise) {

    Log.d(tag, "rn.stopWavRecorder()")

    if (recordHandler != null) {
        Log.d(tag, "   removing record callbacks")
        recorderRunnable?.let { recordHandler!!.removeCallbacks(it) }
    }

    if (audioRecord == null) {
        promise.resolve("wavRecorder already stopped (audioRecord is null).")
        return
    }

    Log.d(tag, "   setting stopCode=USER_REQUEST and isRecordingWav=false")
    //Actually stopping the recorder, and informing the UI, 
    //happens in thread launched from startWavRecorder()
    stopCode = STOP_CODE_USER_REQUEST
    isRecordingWav = false

    //Wait for the recorder to be stopped
    Log.d(tag, "   waiting for audioRecord to be destroyed")
    while (audioRecord != null) {
      Log.i(tag, "Sleeping...")
      Thread.sleep(10)
    }

    promise.resolve("file:///$audioFileURL")
  }



  private fun saveAsWav() {
    Log.i(tag, "saveAsWav()")
    if (tempRawPCMDataFilePath == null || audioFileURL == "") {
      throw Exception("saveAsWav() - Null or empty file path.")
    }

    Log.d(tag, "Saving " + audioFileURL + "...")

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
    if (tempRawPCMDataFilePath != null) {
      val f:File = File(tempRawPCMDataFilePath!!)
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
    if (numChannels == 2) {
      return AudioFormat.CHANNEL_IN_STEREO
    }
    else {
      return AudioFormat.CHANNEL_IN_MONO
    }
  }

  private fun getAudioFormat():Int {
    if (byteDepth == 2) {
      return AudioFormat.ENCODING_PCM_16BIT
    }
    else {
      return AudioFormat.ENCODING_PCM_8BIT
    }
  }

  private fun calcWavMeteringVolume():Double { //channels interleaved

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
    else {
      avgVolume /= Short.MAX_VALUE.toDouble()
    }

    var dbFS:Double = 0.0 //Discontinuity at 0
    if (avgVolume > 0.0) {
      dbFS = 20 * Math.log10(avgVolume)
    }

    if (dbFS < MIN_VOLUME) {
      dbFS = MIN_VOLUME
    }
    if (dbFS > MAX_VOLUME) {
      dbFS = MAX_VOLUME
    }

    return dbFS
  }

}
