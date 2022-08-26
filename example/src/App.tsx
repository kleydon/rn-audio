import {
  Audio,
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
} from 'rn-audio'
import {
  Dimensions,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, {
  ReactElement,
  useCallback,
  useState,
} from 'react'
import to from 'await-to-js'
//import ReactNativeBlobUtil from 'react-native-blob-util'  // For directory structure, file transfer, etc.
import Button from './components/Button'

const ilog = console.log
const wlog = console.warn
const elog = console.error

const styles: any = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#455A64',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  titleTxt: {
    marginTop: 100,
    color: 'white',
    fontSize: 28,
  },
  viewButtonRow: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  viewButtonSet: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  viewPlayer: {
    marginTop: 40,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  viewBarWrapper: {
    paddingTop: 28,
    paddingBottom: 10,
    marginHorizontal: 28,
    alignSelf: 'stretch',
  },
  viewBar: {
    backgroundColor: '#ccc',
    height: 4,
    alignSelf: 'stretch',
  },
  viewBarPlay: {
    backgroundColor: 'white',
    height: 4,
    width: 0,
  },
  playStatusTxt: {
    marginTop: 8,
    color: '#ccc',
  },
  playBtnWrapper: {
    flexDirection: 'row',
    marginTop: 40,
  },
  btn: {
    margin: 5,
  },
  txt: {
    color: 'white',
    fontSize: 14,
    marginHorizontal: 8,
    marginVertical: 4,
  },
  txtRecordCounter: {
    marginTop: 32,
    color: 'white',
    fontSize: 20,
    textAlignVertical: 'center',
    fontWeight: '200',
    fontFamily: 'Helvetica Neue',
    letterSpacing: 3,
  },
  txtCounter: {
    marginTop: 12,
    color: 'white',
    fontSize: 20,
    textAlignVertical: 'center',
    fontWeight: '200',
    fontFamily: 'Helvetica Neue',
    letterSpacing: 3,
  },
})

const screenWidth = Dimensions.get('screen').width

//const dirs = ReactNativeBlobUtil.fs.dirs

const audio = new Audio();
audio.setSubscriptionDuration(0.15) // optional; default is (0.5)

const recordingOptions:RecordingOptions = {
  
  //audioFileNameOrPath: 'https://download.samplelib.com/wav/sample-3s.wav'

  //Shared
  audioFileNameOrPath: Platform.select({
    ios: 'recording.m4a',
    //ios: 'recording.wav',
    android: 'recording.mp4',
    //android: 'recording.wav',
  }),
  recMeteringEnabled: true,
  maxRecDurationSec: 10.0,
  sampleRate: 44100,
  numChannels: NumberOfChannelsId.ONE,
  lpcmByteDepth: ByteDepthId.TWO,
  encoderBitRate: 128000,

  //Apple-specific
  appleAudioFormatId: AppleAudioFormatId.aac,
  //appleAudioFormatId: AppleAudioFormatId.lpcm,
  appleAVAudioSessionModeId: AppleAVAudioSessionModeId.measurement,
  //Apple encoded/compressed-specific
  appleAVEncoderAudioQualityId: AppleAVEncoderAudioQualityId.high,
  //Apple WAV/LPCM specific
  appleAVLinearPCMIsBigEndian: false,
  appleAVLinearPCMIsFloatKeyIOS: false,
  appleAVLinearPCMIsNonInterleaved: false,

  //Android-specific
  androidOutputFormatId: AndroidOutputFormatId.MPEG_4,
  //androidOutputFormatId: AndroidOutputFormatId.WAV,
  androidAudioEncoderId: AndroidAudioEncoderId.AAC,
  //androidAudioEncoderId: AndroidAudioEncoderId.LPCM,
  androidAudioSourceId: AndroidAudioSourceId.MIC,
  //Android WAV/LPCM specific
  //(None)
}


const DEFAULT_TIME_STR = '00:00:00'


export default function App(): ReactElement {

  const [playbackElapsedMs, setPlaybackElapsedMs] = useState<number>(0)
  const [playbackDurationMs, setPlaybackDurationMs] = useState<number>(0)

  const [recordingElapsedStr, setRecordingElapsedStr] = useState<string>(DEFAULT_TIME_STR)
  const [playbackElapsedStr, setPlaybackElapsedStr] = useState<string>(DEFAULT_TIME_STR)
  const [playbackDurationStr, setPlaybackDurationStr] = useState<string>(DEFAULT_TIME_STR)

  let playWidth = (playbackElapsedMs / playbackDurationMs) * (screenWidth - 56)
  if (!playWidth) {
    playWidth = 0
  }

  const ifAndroidEnsurePermissionsSecured = useCallback(async ():Promise<boolean> => {
    const funcName = 'app.ifAndroidEnsurePermissionsSecured()'
    ilog(funcName)
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE!,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE!,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!,
        ])
        if (
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.READ_EXTERNAL_STORAGE'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.RECORD_AUDIO'] ===
            PermissionsAndroid.RESULTS.GRANTED
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
  }, [])


  
  const onStartRecord = useCallback(async ():Promise<undefined> => {
    const funcName = 'app.onStartRecord()'
    ilog(funcName)
    if (await ifAndroidEnsurePermissionsSecured() !== true) {
      const errStr = funcName + ' - Android permissions not secured'
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - recordingOptions: ', recordingOptions)
    const recUpdateCallback = (e: RecUpdateMetadata) => {
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
    const [err, res] = await to<object|string>(audio.startRecorder({
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
    const [err, res] = await to<object|string>(audio.stopRecorder())
    if (err) {
      const errMsg = funcName + ' - Error: ' + err
      elog(errMsg)
      return
    }
    ilog(funcName + ' - Result: ', res)
    return
  }, [])


  const onStartPlay = useCallback(async ():Promise<void> => {
    const funcName = 'app.onStartPlay()'
    ilog(funcName)
    const playUpdateCallback = (e: PlayUpdateMetadata) => {
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
    const [err, res] = await to<string>(audio.startPlayer({
      fileNameOrPathOrURL: recordingOptions.audioFileNameOrPath,
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
    const [err, res] = await to<string>(audio.stopPlayer())
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
    const playWidth =
      (playbackElapsedMs / playbackDurationMs) *
      (screenWidth - 56)
    const pbElapsedMs = Math.round(playbackElapsedMs)
    if (playWidth && playWidth < touchX) {
      const addSecs = Math.round(pbElapsedMs + 1000)
      audio.seekToPlayer(addSecs)
      ilog(funcName + ` - addSecs: ${addSecs}`)
    } 
    else {
      const subSecs = Math.round(pbElapsedMs - 1000)
      audio.seekToPlayer(subSecs)
      ilog(funcName + `- subSecs: ${subSecs}`)
    }
  }, [playbackElapsedMs, playbackDurationMs])


  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titleTxt}>RnAudio Example</Text>
      <Text style={styles.txtRecordCounter}>{recordingElapsedStr}</Text>
      <View style={styles.viewButtonRow}>
        <View style={styles.viewButtonSet}>
          <Button
            style={styles.btn}
            onPress={onStartRecord}
            txtStyle={styles.txt}
          >
            Record
          </Button>
          <Button
            style={styles.btn}
            onPress={onPauseRecord}
            txtStyle={styles.txt}
          >
            Pause
          </Button>
          <Button
            style={styles.btn}
            onPress={onResumeRecord}
            txtStyle={styles.txt}
          >
            Resume
          </Button>
          <Button
            style={styles.btn}
            onPress={onStopRecord}
            txtStyle={styles.txt}
          >
            Stop
          </Button>
        </View>
      </View>
      <View style={styles.viewPlayer}>
        <TouchableOpacity
          style={styles.viewBarWrapper}
          onPress={onStatusPress}
        >
          <View style={styles.viewBar}>
            <View style={[styles.viewBarPlay, {width: playWidth}]} />
          </View>
        </TouchableOpacity>
        <Text style={styles.txtCounter}>
          {playbackElapsedStr} / {playbackDurationStr}
        </Text>
        <View style={styles.playBtnWrapper}>
          <Button
            style={styles.btn}
            onPress={onStartPlay}
            txtStyle={styles.txt}
          >
            Play
          </Button>
          <Button style={styles.btn}
            onPress={onPausePlay}
            txtStyle={styles.txt}
          >
            Pause
          </Button>
          <Button
            style={styles.btn}
            onPress={onResumePlay}
            txtStyle={styles.txt}
          >
            Resume
          </Button>
          <Button
            style={styles.btn}
            onPress={onStopPlay}
            txtStyle={styles.txt}
          >
            Stop
          </Button> 
        </View>
      </View>
    </SafeAreaView>
  )
}
