import {
  Audio,
  RecordingOptions,
  AppleAVEncoderAudioQualityId,
  AppleAudioFormatId,
  AppleAVAudioSessionModeId,
  AndroidAudioSourceId,
  AndroidAudioEncoderId,
  AndroidWavByteDepthId,
  PlaybackCallbackMetadata,
  RecordingCallbackMetadata,
  StoppageCallbackMetadata,
  AppleAVLinearPCMBitDepthId,
  AndroidOutputFormatId,
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


export default class App extends Component<any, State> {

  private dirs = RNFetchBlob.fs.dirs
  private path = Platform.select({
//    ios: 'hello.m4a',
    //   ios: 'hello.wav',
//    ios: `${this.dirs.CacheDir}/recording.wav`,
    ios: `recording.wav`,
//    android: `${this.dirs.CacheDir}/hello.mp4`,
    android: `${this.dirs.CacheDir}/recording.wav`,
  })

  private audio: Audio

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

    this.audio = new Audio()
    this.audio.setSubscriptionDuration(0.1) // optional. Default is 0.5
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
                onPress={this.onStartWavRecord}
                txtStyle={styles.txt}
              >
                wavRec
              </Button>

              <Button
                style={styles.btn}
                onPress={this.onPauseWavRecord}
                txtStyle={styles.txt}
              >
                wavPause
              </Button>

              <Button
                style={styles.btn}
                onPress={this.onResumeWavRecord}
                txtStyle={styles.txt}
              >
                wavResume
              </Button>

              <Button
                style={styles.btn}
                onPress={this.onStopWavRecord}
                txtStyle={styles.txt}
              >
                wavStop
              </Button>
          </View>
        </View>
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

  private async ifAndroidEnsurePermissionsSecured() {
    if (Platform.OS === 'android') {
      ilog([
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE!,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE!,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO!,
      ])
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
          wlog('Required android permissions NOT granted')
          return false
        }
      } catch (err) {
        wlog(err)
        return false
      }
    }
    return true
  }

  private onStatusPress = (e: any) => {
    const touchX = e.nativeEvent.locationX
    ilog(`touchX: ${touchX}`)
    const playWidth =
      (this.state.playbackElapsedMs / this.state.playbackDurationMs) *
      (screenWidth - 56)
    ilog(`currentPlayWidth: ${playWidth}`)

    const playbackElapsedMs = Math.round(this.state.playbackElapsedMs)

    if (playWidth && playWidth < touchX) {
      const addSecs = Math.round(playbackElapsedMs + 1000)
      this.audio.seekToPlayer(addSecs)
      ilog(`addSecs: ${addSecs}`)
    } else {
      const subSecs = Math.round(playbackElapsedMs - 1000)
      this.audio.seekToPlayer(subSecs)
      ilog(`subSecs: ${subSecs}`)
    }
  }

  private onStartRecord = async () => {
    
    ilog('onStartRecord()')

    if (await this.ifAndroidEnsurePermissionsSecured() === false) {
      return
    }

    const recordingOptions: RecordingOptions = {

      //Shared
      audioFilePath: this.path,
      meteringEnabled: true,
      maxRecordingDurationSec: 4.0,
      
      //Android-specific
      androidOutputFormatId: AndroidOutputFormatId.MPEG_4, // Default?
      androidAudioEncoderId: AndroidAudioEncoderId.AAC,
      androidAudioSourceId: AndroidAudioSourceId.MIC,
      androidAudioSamplingRate: 44100,
      androidAudioEncodingBitRate: 192000,
      //Android LPCM/WAV-specific
      androidWavByteDepth: AndroidWavByteDepthId.ONE,

      //Apple-specific
      //appleAudioFormatId: AppleAudioFormatId.aac,
      appleAudioFormatId: AppleAudioFormatId.lpcm,
      appleAVNumberOfChannels: 1,
      appleAVSampleRate: 44100,
      appleAVAudioSessionModeId: AppleAVAudioSessionModeId.measurement,
      appleAVEncoderAudioQualityId: AppleAVEncoderAudioQualityId.high,
      //Apple WAV/LPCM specific
      appleAVLinearPCMBitDepth: AppleAVLinearPCMBitDepthId.bit16,
      appleAVLinearPCMIsBigEndian: false,
      appleAVLinearPCMIsFloatKeyIOS: false,
      appleAVLinearPCMIsNonInterleaved: false, // Default?
    }

    ilog('recordingOptions:', recordingOptions)

    const recordingCallback = (e: RecordingCallbackMetadata) => {
      ilog('record-back', e)
      this.setState({
        recordingElapsedMs: e.recordingElapsedMs,
        recordingElapsedStr: this.audio.mmssss(
          Math.floor(e.recordingElapsedMs),
        ),
      })
    }

    const stoppageCallback = (e: StoppageCallbackMetadata) => {
      ilog('stoppage', e)
      this.onStopRecord()
    }

    ilog(   'calling arp.startRecorder()')
    const uri = await this.audio.startRecorder({
      recordingOptions,
      recordingCallback,
      stoppageCallback
    })

    ilog(`uri: ${uri}`)
  }

  private onPauseRecord = async () => {
    try {
      const r = await this.audio.pauseRecorder()
      ilog(r)
    } catch (err) {
      elog('pauseRecord', err)
    }
  }

  private onResumeRecord = async () => {
    await this.audio.resumeRecorder()
  }

  private onStopRecord = async () => {
    const result = await this.audio.stopRecorder()
    this.setState({
      recordingElapsedMs: 0,
    })
    ilog(result)
  }

  private onStartPlay = async () => {
    ilog('app.onPausePlay()')

    const playbackCallback = (e: PlaybackCallbackMetadata) => {
      ilog('app.playBackListener()')
      this.setState({
        playbackElapsedMs: e.playbackElapsedMs,
        playbackElapsedStr: this.audio.mmssss(Math.floor(e.playbackElapsedMs)),
        playbackDurationMs: e.playbackDurationMs,
        playbackDurationStr: this.audio.mmssss(Math.floor(e.playbackDurationMs)),
      })
    }

    const playbackVolume = 1.0

    ilog('   arp.startPlayer()')
    const startPlayerResult = await this.audio.startPlayer({
      uri: this.path,
      playbackCallback,
      playbackVolume,
    })
    
    ilog(`      startPlayerResult: ${startPlayerResult}`)
  }

  private onPausePlay = async () => {
    ilog('app.onPausePlay()')
    ilog('   arp.pausePlayer()')
    await this.audio.pausePlayer()
  }

  private onResumePlay = async () => {
    ilog('app.onResumePlay()')
    ilog('   arp.resumePlayer()')
    await this.audio.resumePlayer()
  }

  private onStopPlay = async () => {
    ilog('app.onStopPlay()')
    this.setState({
      playbackElapsedMs: 0,
      playbackElapsedStr: this.audio.mmssss(0)
    })
    ilog('   arp.stopPlayer()')

    const [err, res] = await to(this.audio.stopPlayer())
    if (err) {
      const errStr = 'onStopPlay - Error stopping: ' + err
      elog(errStr)
      Promise.reject(errStr)
      return
    }
    return Promise.resolve(res)    
  }

  // ** NEW FUNCTIONS ***

  private onStartWavRecord = async () => {
    ilog('app.onStartWavRecord()')
    ilog('   calling arp.ifAndroidEnsurePermissionsSecured()')
    if (await this.ifAndroidEnsurePermissionsSecured() === false) {
      return
    }
    const recordingCallback = (e: RecordingCallbackMetadata) => {
      ilog('app.recordBackListener()')
      this.setState({
        recordingElapsedMs: e.recordingElapsedMs,
        recordingElapsedStr: this.audio.mmssss(
          Math.floor(e.recordingElapsedMs),
        ),
      })
      ilog('record-back', e)
    }
    const stoppageCallback = (e: StoppageCallbackMetadata) => {
      ilog('stoppage', e)
      this.onStopWavRecord()
    }
    ilog('   calling arp.startWavRecorder()')
    const result = await this.audio.startWavRecorder({
      requestedWavParams: {
        sampleRate: 44100,
        numChannels: 1,
        byteDepth: 1, //2
      },
      path: undefined,
      meteringEnabled: true,
    //  maxRecordingdurationMs: 5.0,
      recordingCallback,
      stoppageCallback
    })
    ilog(result)
  }

  private onPauseWavRecord = async () => {
    ilog('app.onPauseWavRecord()')
    try {
      ilog('   calling arp.pauseWavRecorder()')
      const r = await this.audio.pauseWavRecorder()
      ilog(r)
    } catch (err) {
      ilog('pauseWavRecord Error: ', err)
    }
  }

  private onResumeWavRecord = async () => {
    ilog('app.onResumeWavRecord()')
    ilog('   calling arp.resumeWavRecorder()')
    const r = await this.audio.resumeWavRecorder()
    ilog(r)
  }

  private onStopWavRecord = async () => {
    ilog('app.onStopWavRecord()')
    this.setState({
      recordingElapsedMs: 0,
    })
    if (await this.audio.isRecording()) {
      ilog('   calling arp.stopWavRecorder()')
      const res = await this.audio.stopWavRecorder()
      ilog(res)
      return res
    }
    return 'onStopWavRecord: Wasn\'t recording'
  }
}
