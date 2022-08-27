# rn-audio

React-native module for recording and playing audio files on `iOS` and `android`, with platform-supported formats and options (as well as .wav support). This module can additionally play audio files from a URL.



## Installation:

In your project directory, type:
```
yarn add 'rn-audio@https://github.com/kleydon/rn-audio'
````

[iOS only]:
```
npx pod-install
```


## Post-installation:

#### iOS
You need to add a usage description to Info.plist:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>$(PRODUCT_NAME) requires your permission to use the microphone.</string>
```
Also, [add a swift bridging header](https://javedmultani16.medium.com/adding-a-swift-bridging-header-b6b0a7ab895f) (if you don't have one already), for swift compatibility.

#### Android

Add the following permissions to your application's `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

## Usage:

```typescript
import {
  Audio,
  RecUpdateMetadata,
  RecStopMetadata,
  PlayUpdateMetadata,
  PlayStopMetadata
} from 'rn-audio'
import { Platform } from 'react-native'

// Recording

const recordingOptions:RecordingOptions = {
  audioFileNameOrPath: 'recording.wav',
  }),
  recMeteringEnabled: true,
  maxRecDurationSec: 10.0,
  ...
}

const recUpdateCallback = async (e: RecUpdateMetadata) => {
  console.log('recUpdate: ', e)
}
const recStopCallback = async (e: RecStopMetadata):Promise<undefined> => {
  console.log('recStop:', e)   
}

audio.startRecorder({ recUpdateCallback, recStopCallback, recordingOptions })
...
audio.pauseRecorder()
...
audio.resumeRecorder()
...
audio.stopRecorder()

const recUpdateCallback = async (e: RecUpdateMetadata) => {
  ilog('app.recUpdateCallback() - metadata: ', e)
  //db-level, progress, etc.
}
const recStopCallback = async (e: RecStopMetadata) => {
  ilog('app.recStopCallback() - metadata:', e)   
  //Did recording stop due to user request? An error? Max duration exceeded?
}

// Playback

const playUpdateCallback = async (e: PlayUpdateMetadata) => {
  console.log('playUpdate: ', e)
  //progress, muted, etc.   
}
const playStopCallback = async (e: PlayStopMetadata):Promise<void> => {
  console.log('playStop:', e)      
  //Did playback stop due to user request? An error? Max duration exceeded?
}
...
...
audio.startPlayer({ fileNameOrPathOrURL, playUpdateCallback, playStopCallback, playVolume: 1.0 })
...
audio.pausePlayer()
...
audio.resumePlayer()
...
audio.stopPlayer()

audio.seekToPlayer(time)
...
```

For specifying directories, transferring recorded files, dealing with file data, etc, consider using:

* (react-native-blob-util)[https://www.npmjs.com/package/react-native-blob-util]
* (react-native-fs)[https://www.npmjs.com/package/react-native-fs]



### Options:

Recording options are below; for a full list of types and options, see (here)[https://github.com/kleydon/rn-audio/blob/main/src/index.tsx]:

```typescript
audioFileNameOrPath?: string,
recMeteringEnabled?: boolean,
maxRecDurationSec?: number,
sampleRate?: number,
numChannels?: NumberOfChannelsId,
encoderBitRate?: number,
lpcmByteDepth?: ByteDepthId,

//Apple-specific
appleAudioFormatId?: AppleAudioFormatId,
appleAVAudioSessionModeId?: AppleAVAudioSessionModeId,
//Apple encoded/compressed-specific
appleAVEncoderAudioQualityId?: AppleAVEncoderAudioQualityId,
//Apple LPCM/WAV-specific
appleAVLinearPCMIsBigEndian?: boolean,
appleAVLinearPCMIsFloatKeyIOS?: boolean,
appleAVLinearPCMIsNonInterleaved?: boolean,

//Android-specific
androidAudioSourceId?: AndroidAudioSourceId,
androidOutputFormatId?: AndroidOutputFormatId,
androidAudioEncoderId?: AndroidAudioEncoderId,
//Android encoded/compressed-specific
//(None)
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT


## Set up (for development)

Run `yarn` from `rn-audio` project directory. (If re-installing, may need to delete node_modules and yarn.lock files in project and example directories...)

## Running the example (for development)

Run `yarn example ios` and `yarn example android` from rn-audio project directory





## Dev Notes

Based on 
  react-native-audio-recorder-player
  Based on [react-native-audio-record](https://github.com/goodatlas/react-native-audio-record), by [Atlas Labs](https://github.com/goodatlas)

Skeleton set-up:

  npx create-react-native-library
    ✔ What is the email address for the package author? … rnaudio@krispinleydon.net
    ✔ What is the URL for the package author? … https://github.com/kleydon/rn-audio
    ✔ What is the URL for the repository? … https://github.com/kleydon/rn-audio
    ✔ What type of library do you want to develop? › Native module
    ✔ Which languages do you want to use? › Kotlin & Swift
  cd into main project folder
  Get started with the project:
    $ yarn
  Run example app on iOS:
    $ yarn example ios
  Run the example app on Android:
    $ yarn example android

Gotchas:
  * In the *Module.kt file: 
    * Be sure to update the value of the tag string.
    * In the class declaration, be sure to use **private val** reactContext, so it reactContext is available to class member functions
  * In the XCode MODULE project - use the bridging header file. 


Upgrading react-native:
  Could use https://react-native-community.github.io/upgrade-helper/
  In reality, probably easier to start with a fresh react native project, using create-react-native-library



Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
