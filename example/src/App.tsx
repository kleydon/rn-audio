import {
  audio,
  RecordingOptions,
  AppleAVEncoderAudioQualityId,
  AppleAudioFormatId,
  AppleAVAudioSessionModeId,
  AndroidAudioSourceId,
  AndroidAudioEncoderId,
  RecUpdateMetadata,
  RecStopMetadata,
  PlayUpdateMetadata,
  PlayStopMetadata,
  AndroidOutputFormatId,
  NumberOfChannelsId,
  ByteDepthId,
  StopPlayerResult,
  StopRecorderResult,
  StartPlayerResult,
  StartRecorderResult,
} from 'rn-audio'
import {
  AppState,
  Dimensions,
  Platform,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, {
  ReactElement,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react'
import to from 'await-to-js'
//import ReactNativeBlobUtil from 'react-native-blob-util'  // For directory structure, file transfer, etc.
import { Button } from './components/Button'
import { ss } from './styles/styleSheet'

const ilog = console.log
const wlog = console.warn
const elog = console.error


const recordingOptions:RecordingOptions = {
  
  //audioFileNameOrPath: 'https://download.samplelib.com/wav/sample-3s.wav'

  //Shared
  fileNameOrPath: Platform.select({
    //ios: 'recording.m4a',
    ios: 'recording.wav',
    //android: 'recording.mp4',
    android: 'recording.wav',
  }),
  recMeteringEnabled: true,
  maxRecDurationSec: 10.0,
  sampleRate: 44100,
  numChannels: NumberOfChannelsId.ONE,
  lpcmByteDepth: ByteDepthId.TWO,
  encoderBitRate: 128000,

  //Apple-specific
  //appleAudioFormatId: AppleAudioFormatId.aac,
  appleAudioFormatId: AppleAudioFormatId.lpcm,
  appleAVAudioSessionModeId: AppleAVAudioSessionModeId.measurement,
  //Apple encoded/compressed-specific
  appleAVEncoderAudioQualityId: AppleAVEncoderAudioQualityId.high,
  //Apple WAV/LPCM specific
  appleAVLinearPCMIsBigEndian: false,
  appleAVLinearPCMIsFloatKeyIOS: false,
  appleAVLinearPCMIsNonInterleaved: false,

  //Android-specific
  //androidOutputFormatId: AndroidOutputFormatId.MPEG_4,
  androidOutputFormatId: AndroidOutputFormatId.WAV,
  //androidAudioEncoderId: AndroidAudioEncoderId.AAC,
  androidAudioEncoderId: AndroidAudioEncoderId.LPCM,
  androidAudioSourceId: AndroidAudioSourceId.MIC,
  //Android WAV/LPCM specific
  //(None)
}


const DEFAULT_TIME_STR = '00:00:00'

const screenWidth = Dimensions.get('screen').width
ilog('screenWidth: ', screenWidth)

//const dirs = ReactNativeBlobUtil.fs.dirs

audio.setSubscriptionDuration(0.25) // optional; default is (0.5)


export default function App(): ReactElement {

  // Without appState listening (below):
  // * android continues playing in the bg
  // * iOS pauses recording/playback audio for backgrounded app, 
  //   then brings it back when app is foregrounded again
  const appState = useRef(AppState.currentState)
  useEffect(() => {
    const appStateEventSubscription = 
      AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) &&
          nextAppState.match(/inactive|background/)) {
        console.log('app.appStateEventListener() - App left foreground; stopping any playing/recording')
        onStopRecord()
        onStopPlay()
      }
      appState.current = nextAppState
    })
    return () => {
      appStateEventSubscription.remove()
    }
  }, [])


  const [playbackElapsedMs, setPlaybackElapsedMs] = useState<number>(0)
  const [playbackDurationMs, setPlaybackDurationMs] = useState<number>(0)

  const [recordingElapsedStr, setRecordingElapsedStr] = useState<string>(DEFAULT_TIME_STR)
  const [playbackElapsedStr, setPlaybackElapsedStr] = useState<string>(DEFAULT_TIME_STR)
  const [playbackDurationStr, setPlaybackDurationStr] = useState<string>(DEFAULT_TIME_STR)

  let playWidth = (playbackElapsedMs / playbackDurationMs) * (screenWidth - 56)
  if (Number.isFinite(playWidth)==false || Number.isNaN(playWidth) ) {
    playWidth = 0
  }

  // RECORDING
  
  const onStartRecord = useCallback(async ():Promise<undefined> => {
    const funcName = 'app.onStartRecord()'
    ilog(funcName)

    if (await audio.verifyAndroidPermissionsEnabled() !== true) {
      const errStr = funcName + ' - Android permissions not secured'
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - recordingOptions: ', recordingOptions)
    const recUpdateCallback = async (e: RecUpdateMetadata) => {
      ilog('app.recUpdateCallback() - metadata: ', e)
      setRecordingElapsedStr(audio.mmssss(
        Math.floor(e.recElapsedMs),
      ))
    }
    const recStopCallback = async (e: RecStopMetadata):Promise<undefined> => {
      ilog('app.recStopCallback() - metadata:', e)
      const [err,] = await to<void>(onStopRecord())
      if (err) {
        const errStr = 'In recStopCallback - error calling onStopRecord(): ' + e
        elog(errStr)
        return
      }
      return
    }
    const [err, res] = await to<StartRecorderResult>(audio.startRecorder({
      recordingOptions,
      recUpdateCallback,
      recStopCallback
    }))
    if (err) {
      const errMsg = funcName + ' - Error:' + err
      elog(errMsg)
      return
    }
    ilog(funcName + ' - Result:', res)
    return
  }, [])


  const onPauseRecord = useCallback(async ():Promise<void> => {
    ilog('app.onPauseRecord()')
    const [err, res] = await to<string>(audio.pauseRecorder())
    if (err) {
      const errMsg = 'onPauseRecord() - Error: ' + err
      elog(errMsg)
      return
    }
    ilog('app.onPauseRecord() - Result:',  res)
    return
  }, [])


  const onResumeRecord = useCallback(async ():Promise<void> => {
    const funcName = 'app.onResumeRecord()'
    ilog(funcName)
    const [err, res] = await to<string>(audio.resumeRecorder())
    if (err) {
      const errMsg = funcName + ' - Error: ' + err
      elog(errMsg)
      return
    }
    ilog(funcName + ' - Result: ',  res)
    return
  }, [])


  const onStopRecord = useCallback(async ():Promise<void> => {
    const funcName = 'app.onStopRecord()'
    ilog(funcName)
    const [err, res] = await to<StopRecorderResult>(audio.stopRecorder())
    if (err) {
      const errMsg = funcName + ' - Error: ' + err
      elog(errMsg)
      return
    }
    ilog(funcName + ' - Result: ', res)
    return
  }, [])


  // PLAYBACK


  const onStartPlay = useCallback(async ():Promise<void> => {
    const funcName = 'app.onStartPlay()'
    ilog(funcName)
    const playUpdateCallback = async (e: PlayUpdateMetadata) => {
      ilog('app.playUpdateEventCallback() - metadata: ', e)
      setPlaybackElapsedMs(e.playElapsedMs)
      setPlaybackElapsedStr(audio.mmssss(Math.floor(e.playElapsedMs)))
      setPlaybackDurationMs(e.playDurationMs)
      setPlaybackDurationStr(audio.mmssss(Math.floor(e.playDurationMs)))
    }
    const playStopCallback = async (e: PlayStopMetadata):Promise<void> => {
      ilog('app.playStopCallback() - metadata:', e)
      const [err,] = await to<void>(onStopPlay())
      if (err) {
        const errStr = 'In playStopCallback - error calling app.onStopPlay(): ' + e
        elog(errStr)
        return
      }
      return
    }
    const [err, res] = await to<StartPlayerResult>(audio.startPlayer({
      fileNameOrPathOrURL: recordingOptions.fileNameOrPath,
      playUpdateCallback,
      playStopCallback,
      playVolume: 1.0,
    }))
    if (err) {
      const errStr = funcName + ': ' + err
      elog(errStr)
      return
    }
    ilog(funcName + ' - Result: ',  res)
    return
  }, [playbackElapsedMs, playbackDurationMs])


  const onPausePlay = useCallback(async ():Promise<void> => {
    const funcName = 'app.onPausePlay()'
    ilog(funcName)
    const [err, res] = await to<string>(audio.pausePlayer())
    if (err) {
      const errStr = funcName + ': ' + err
      elog(errStr)
      return
    }
    ilog(funcName + ' - Result: ', res)
    return
  }, [])


  const onResumePlay = useCallback(async ():Promise<void> => {
    const funcName = 'app.onResumePlay()'
    ilog(funcName)
    const [err, res] = await to<string>(audio.resumePlayer())
    if (err) {
      const errStr = funcName + ': ' + err
      elog(errStr)
      return
    }
    ilog(funcName + ' - Result: ', res)
    return
  }, [])


  const onStopPlay = useCallback(async ():Promise<void> => {
    const funcName = 'app.onStopPlay()'
    ilog(funcName)
    setPlaybackElapsedMs(0)
    setPlaybackElapsedStr(audio.mmssss(0))
    const [err, res] = await to<StopPlayerResult>(audio.stopPlayer())
    if (err) {
      const errStr = funcName + ': ' + err
      elog(errStr)
      return
    }
    ilog('app.onStopPlay() - Result: ', res)
    return
  }, [])


  const onStatusPress = useCallback(async (e: any):Promise<void> => {
    const funcName = 'app.onStatusPress()'
    ilog(funcName)
    const touchX = e.nativeEvent.locationX
    const newFractionPlayed = touchX / (screenWidth - 2*ss.viewBarWrapper.marginHorizontal)
    ilog(funcName + ` - touchX: ${touchX}`)
    ilog(funcName + ` - newFractionPlayed: ${newFractionPlayed}`)
    audio.seekToPlayer(Math.round(newFractionPlayed*playbackDurationMs))
  }, [playbackElapsedMs, playbackDurationMs])


  //RENDERING

  return (
    <SafeAreaView style={ss.container}>
      <Text style={ss.titleTxt}>RnAudio Example</Text>
      <Text style={ss.txtRecordCounter}>{recordingElapsedStr}</Text>
      <View style={ss.viewButtonRow}>
        <View style={ss.viewButtonSet}>
          <Button
            style={ss.btn}
            onPress={onStartRecord}
            txtStyle={ss.txt}
          >
            Record
          </Button>
          <Button
            style={ss.btn}
            onPress={onPauseRecord}
            txtStyle={ss.txt}
          >
            Pause
          </Button>
          <Button
            style={ss.btn}
            onPress={onResumeRecord}
            txtStyle={ss.txt}
          >
            Resume
          </Button>
          <Button
            style={ss.btn}
            onPress={onStopRecord}
            txtStyle={ss.txt}
          >
            Stop
          </Button>
        </View>
      </View>
      <View style={ss.viewPlayer}>
        <TouchableOpacity
          style={ss.viewBarWrapper}
          onPress={onStatusPress}
        >
          <View style={ss.viewBar}>
            <View style={[ss.viewBarPlay, {width: playWidth}]} />
          </View>
        </TouchableOpacity>
        <Text style={ss.txtCounter}>
          {playbackElapsedStr} / {playbackDurationStr}
        </Text>
        <View style={ss.playBtnWrapper}>
          <Button
            style={ss.btn}
            onPress={onStartPlay}
            txtStyle={ss.txt}
          >
            Play
          </Button>
          <Button style={ss.btn}
            onPress={onPausePlay}
            txtStyle={ss.txt}
          >
            Pause
          </Button>
          <Button
            style={ss.btn}
            onPress={onResumePlay}
            txtStyle={ss.txt}
          >
            Resume
          </Button>
          <Button
            style={ss.btn}
            onPress={onStopPlay}
            txtStyle={ss.txt}
          >
            Stop
          </Button> 
        </View>
      </View>
    </SafeAreaView>
  )
}
