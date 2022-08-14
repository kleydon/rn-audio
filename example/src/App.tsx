import {
  Audio,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSet,
  AudioSourceAndroidType,
  PlayBackType,
  RecordBackType,
  StoppageType,
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
  recordSecs: number,
  recordTime: string,
  currentPositionSec: number,
  currentDurationSec: number,
  playTime: string,
  duration: string,
  result: number
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
      recordSecs: 0,
      recordTime: '00:00:00',
      currentPositionSec: 0,
      currentDurationSec: 0,
      playTime: '00:00:00',
      duration: '00:00:00',
      result: 0
    }

    this.audio = new Audio()
    this.audio.setSubscriptionDuration(0.1) // optional. Default is 0.5
  }

  public render() {

    let playWidth =
      (this.state.currentPositionSec / this.state.currentDurationSec) *
      (screenWidth - 56)
    if (!playWidth) {
      playWidth = 0
    }

    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.titleTxt}>RnAudio Example</Text>
        <Text style={styles.txtRecordCounter}>{this.state.recordTime}</Text>
        <Text style={styles.txtRecordCounter}>{this.state.result}</Text>
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
            {this.state.playTime} / {this.state.duration}
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
      (this.state.currentPositionSec / this.state.currentDurationSec) *
      (screenWidth - 56)
    ilog(`currentPlayWidth: ${playWidth}`)

    const currentPosition = Math.round(this.state.currentPositionSec)

    if (playWidth && playWidth < touchX) {
      const addSecs = Math.round(currentPosition + 1000)
      this.audio.seekToPlayer(addSecs)
      ilog(`addSecs: ${addSecs}`)
    } else {
      const subSecs = Math.round(currentPosition - 1000)
      this.audio.seekToPlayer(subSecs)
      ilog(`subSecs: ${subSecs}`)
    }
  }

  private onStartRecord = async () => {
    
    ilog('onStartRecord()')

    if (await this.ifAndroidEnsurePermissionsSecured() === false) {
      return
    }

    const audioSet: AudioSet = {
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AudioSourceAndroid: AudioSourceAndroidType.MIC,
      AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
      AVNumberOfChannelsKeyIOS: 2,
//      AVFormatIDKeyIOS: AVEncodingOption.aac,
      AVFormatIDKeyIOS: AVEncodingOption.lpcm,
    }

    ilog('audioSet:', audioSet)

    const recordingCallback = (e: RecordBackType) => {
      ilog('record-back', e)
      this.setState({
        recordSecs: e.currentPosition,
        recordTime: this.audio.mmssss(
          Math.floor(e.currentPosition),
        ),
      })
    }

    const stoppageCallback = (e: StoppageType) => {
      ilog('stoppage', e)
      this.onStopRecord()
    }

    ilog(   'calling arp.startRecorder()')
    const uri = await this.audio.startRecorder({
      audioSet,
      uri: this.path,
      meteringEnabled: true, //metering enabled
      maxRecordingDurationSec: 5.0,
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
      recordSecs: 0,
    })
    ilog(result)
  }

  private onStartPlay = async () => {
    ilog('app.onPausePlay()')

    const playbackCallback = (e: PlayBackType) => {
      ilog('app.playBackListener()')
      this.setState({
        currentPositionSec: e.currentPosition,
        currentDurationSec: e.duration,
        playTime: this.audio.mmssss(
          Math.floor(e.currentPosition),
        ),
        duration: this.audio.mmssss(Math.floor(e.duration)),
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
      currentPositionSec: 0,
      playTime: this.audio.mmssss(
        Math.floor(0),
      ),
      result: await this.audio.multiply(42, 1)
    })
    ilog('   arp.stopPlayer()')
    this.audio.stopPlayer()    
  }

  // ** NEW FUNCTIONS ***

  private onStartWavRecord = async () => {
    ilog('app.onStartWavRecord()')
    ilog('   calling arp.ifAndroidEnsurePermissionsSecured()')
    if (await this.ifAndroidEnsurePermissionsSecured() === false) {
      return
    }
    const recordingCallback = (e: RecordBackType) => {
      ilog('app.recordBackListener()')
      this.setState({
        recordSecs: e.currentPosition,
        recordTime: this.audio.mmssss(
          Math.floor(e.currentPosition),
        ),
      })
      ilog('record-back', e)
    }
    const stoppageCallback = (e: StoppageType) => {
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
    //  maxRecordingDurationSec: 5.0,
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
      recordSecs: 0,
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
