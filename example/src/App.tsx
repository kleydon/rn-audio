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
  Component
} from 'react'
import Button from './components/Button'
import RNFetchBlob from 'rn-fetch-blob'
import to from 'await-to-js'

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
    marginTop: 28,
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

interface State {
  isLoggingIn: boolean,
  recordingElapsedMs: number,
  recordingElapsedStr: string,
  playbackElapsedMs: number,
  playbackElapsedStr: string,
  playbackDurationMs: number,
  playbackDurationStr: string,
}

const screenWidth = Dimensions.get('screen').width

const dirs = RNFetchBlob.fs.dirs

const audio = new Audio();
audio.setSubscriptionDuration(0.15) // optional; default is (0.5)

const recordingOptions:RecordingOptions = {
  //audioFilePath: 'https://download.samplelib.com/wav/sample-3s.wav'

  //Shared
  audioFilePath: Platform.select({
  ios: 'recording.m4a',
  //ios: 'recording.wav',
  android: `${dirs.CacheDir}/recording.mp4`,
  //android: `${dirs.CacheDir}/recording.wav`,
  }),
  recMeteringEnabled: true,
  maxRecDurationSec: 10.0,
  sampleRate: 44100,
  numChannels: NumberOfChannelsId.ONE,
  lpcmByteDepth: ByteDepthId.TWO,

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
  //Android encoded/compressed-specific
  androidAudioEncodingBitRate: 128000,
}


export default class App extends Component<any, State> {

  constructor(props: any) {
    super(props)
    this.state = {
      isLoggingIn: false,
      recordingElapsedMs: 0,
      recordingElapsedStr: '00:00:00',
      playbackElapsedMs: 0,
      playbackElapsedStr: '00:00:00',
      playbackDurationMs: 0,
      playbackDurationStr: '00:00:00',
    }
  }

  public render() {

    let playWidth =
      (this.state.playbackElapsedMs / this.state.playbackDurationMs) *
      (screenWidth - 56)
    if (!playWidth) {
      playWidth = 0
    }

    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.titleTxt}>RnAudio Example</Text>
        <Text style={styles.txtRecordCounter}>{this.state.recordingElapsedStr}</Text>
        <View style={styles.viewButtonRow}>
          <View style={styles.viewButtonSet}>
            <Button
              style={styles.btn}
              onPress={this.onStartRecord}
              txtStyle={styles.txt}
            >
              Record
            </Button>
            <Button
              style={styles.btn}
              onPress={this.onPauseRecord}
              txtStyle={styles.txt}
            >
              Pause
            </Button>
            <Button
              style={styles.btn}
              onPress={this.onResumeRecord}
              txtStyle={styles.txt}
            >
              Resume
            </Button>
            <Button
              style={styles.btn}
              onPress={this.onStopRecord}
              txtStyle={styles.txt}
            >
              Stop
            </Button>
          </View>
        </View>
        <View style={styles.viewPlayer}>
          <TouchableOpacity
            style={styles.viewBarWrapper}
            onPress={this.onStatusPress}
          >
            <View style={styles.viewBar}>
              <View style={[styles.viewBarPlay, {width: playWidth}]} />
            </View>
          </TouchableOpacity>
          <Text style={styles.txtCounter}>
            {this.state.playbackElapsedStr} / {this.state.playbackDurationStr}
          </Text>
          <View style={styles.playBtnWrapper}>
            <Button
              style={styles.btn}
              onPress={this.onStartPlay}
              txtStyle={styles.txt}
            >
              Play
            </Button>
            <Button style={styles.btn}
              onPress={this.onPausePlay}
              txtStyle={styles.txt}
            >
              Pause
            </Button>
            <Button
              style={styles.btn}
              onPress={this.onResumePlay}
              txtStyle={styles.txt}
            >
              Resume
            </Button>
            <Button
              style={styles.btn}
              onPress={this.onStopPlay}
              txtStyle={styles.txt}
            >
              Stop
            </Button> 
          </View>
        </View>
      </SafeAreaView>
    )
  }

  private async ifAndroidEnsurePermissionsSecured():Promise<boolean> {
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
  }

  private onStatusPress = (e: any):void => {
    const funcName = 'app.onStatusPress()'
    ilog(funcName)
    const touchX = e.nativeEvent.locationX
    const playWidth =
      (this.state.playbackElapsedMs / this.state.playbackDurationMs) *
      (screenWidth - 56)
    const playbackElapsedMs = Math.round(this.state.playbackElapsedMs)
    if (playWidth && playWidth < touchX) {
      const addSecs = Math.round(playbackElapsedMs + 1000)
      audio.seekToPlayer(addSecs)
      ilog(funcName + ` - addSecs: ${addSecs}`)
    } 
    else {
      const subSecs = Math.round(playbackElapsedMs - 1000)
      audio.seekToPlayer(subSecs)
      ilog(funcName + `- subSecs: ${subSecs}`)
    }
  }

  private onStartRecord = async ():Promise<undefined> => {
    const funcName = 'app.onStartRecord()'
    ilog(funcName)
    if (await this.ifAndroidEnsurePermissionsSecured() !== true) {
      const errStr = funcName + ' - Android permissions not secured'
      elog(errStr)
      return Promise.reject(errStr)
    }
    ilog(funcName + ' - recordingOptions: ', recordingOptions)
    const recUpdateCallback = (e: RecUpdateMetadata) => {
      ilog('app.recUpdateCallback() - metadata: ', e)
      this.setState({
        recordingElapsedMs: e.recElapsedMs,
        recordingElapsedStr: audio.mmssss(
          Math.floor(e.recElapsedMs),
        ),
      })
    }
    const recStopCallback = async (e: RecStopMetadata):Promise<undefined> => {
      ilog('app.recStopCallback() - metadata:', e)
      const [err,] = await to<undefined>(this.onStopRecord())
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
  }

  private onPauseRecord = async ():Promise<undefined> => {
    ilog('app.onPauseRecord()')
    const [err, res] = await to<string>(audio.pauseRecorder())
    if (err) {
      const errMsg = 'onPauseRecord() - Error: ' + err
      elog(errMsg)
      return
    }
    ilog('app.onPauseRecord() - Result:',  res)
    return
  }

  private onResumeRecord = async ():Promise<undefined> => {
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
  }

  private onStopRecord = async ():Promise<undefined> => {
    const funcName = 'app.onStopRecord()'
    ilog(funcName)
    const [err, res] = await to<object|string>(audio.stopRecorder())
    if (err) {
      const errMsg = funcName + ' - Error: ' + err
      elog(errMsg)
      return
    }
    this.setState({ recordingElapsedMs: 0 })
    ilog(funcName + ' - Result: ', res)
    return
  }

  private onStartPlay = async ():Promise<undefined> => {
    const funcName = 'app.onStartPlay()'
    ilog(funcName)
    const playUpdateCallback = (e: PlayUpdateMetadata) => {
      ilog('app.playUpdateEventCallback() - metadata: ', e)
      this.setState({
        playbackElapsedMs: e.playElapsedMs,
        playbackElapsedStr: audio.mmssss(Math.floor(e.playElapsedMs)),
        playbackDurationMs: e.playDurationMs,
        playbackDurationStr: audio.mmssss(Math.floor(e.playDurationMs)),
      })
    }
    const playStopCallback = async (e: PlayStopMetadata):Promise<undefined> => {
      ilog('app.playStopCallback() - metadata:', e)
      const [err,] = await to<string|undefined>(this.onStopPlay())
      if (err) {
        const errStr = 'In playStopCallback - error calling app.onStopPlay(): ' + e
        elog(errStr)
        return
      }
      return
    }
    const [err, res] = await to<object|string>(audio.startPlayer({
      uri: recordingOptions.audioFilePath,
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
  }

  private onPausePlay = async () => {
    const funcName = 'app.onPausePlay()'
    ilog(funcName)
    const [err, res] = await to<string>(audio.pausePlayer())
    if (err) {
      const errStr = funcName + ': ' + err
      elog(errStr)
      return
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

  private onResumePlay = async () => {
    const funcName = 'app.onResumePlay()'
    ilog(funcName)
    const [err, res] = await to<string>(audio.resumePlayer())
    if (err) {
      const errStr = funcName + ': ' + err
      elog(errStr)
      return
    }
    ilog(funcName + ' - Result: ', res)
    return res
  }

  private onStopPlay = async () => {
    const funcName = 'app.onStopPlay()'
    ilog(funcName)
    this.setState({
      playbackElapsedMs: 0,
      playbackElapsedStr: audio.mmssss(0)
    })
    const [err, res] = await to<string>(audio.stopPlayer())
    if (err) {
      const errStr = funcName + ': ' + err
      elog(errStr)
      return
    }
    ilog('app.onStopPlay() - Result: ', res)
    return res  
  }

}
