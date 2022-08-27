# rn-audio

React-native module for recording and playing audio files on `iOS` and `android`, using platform-supported formats and options (as well as .wav support). This module can additionally play audio files from a URL.

## Compatibility:

* React Native >= 0.61
* iOS: >= 11.0
* Android SDK: >= 21

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
Also, add a swift bridging header (if you don't have one already), for swift compatibility; see [here](https://javedmultani16.medium.com/adding-a-swift-bridging-header-b6b0a7ab895f) and [here](https://stackoverflow.com/questions/31716413/xcode-not-automatically-creating-bridging-header).

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

setSubscriptionDuration(0.25)  // Rate of callbacks that fire during recording and playback.
                               // Defaults to 0.5

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
  //Did playback stop due to completion? An error? User request?
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
...
audio.seekToPlayer(time)
...


// Time formatting

audio.mmss(secs)  // Returns MM:SS formatted time string

audio.mmssss(ms)  // Returns a MM:SS:mm formatted time string
```

For specifying directory paths, file system navigation, transferring recordings, dealing with file data, etc, consider using:

* [react-native-blob-util](https://www.npmjs.com/package/react-native-blob-util)
* [react-native-fs](https://www.npmjs.com/package/react-native-fs)
* [buffer](https://www.npmjs.com/package/buffer)



### Options:

Recording options are below; for a full list of options/types, see (here)[https://github.com/kleydon/rn-audio/blob/main/src/index.tsx]:

```typescript
export interface RecordingOptions {
  audioFileNameOrPath?: string,  // If wav encoding/format/LPCM params specified, defaults to 'recording.wav';
                                 // otherwise, 'recording.m4a' for ios, and 'recording.mp4' for android.
  maxRecDurationSec?: number,
  recMeteringEnabled?: boolean,  // db sound level
  sampleRate?: number,  // defaults to 44100
  numChannels?: NumberOfChannelsId,  // 1 or 2, defaults to 1
  encoderBitRate?: number,  // Defaults to 128000 
  lpcmByteDepth?: ByteDepthId,  // 1 or 2, defaults to 2 = 16 bits

  //Apple-specific
  appleAudioFormatId?: AppleAudioFormatId,  // Defaults to aac
  appleAVAudioSessionModeId?: AppleAVAudioSessionModeId,  // Defaults to measurement
  //Apple encoded/compressed-specific
  appleAVEncoderAudioQualityId?: AppleAVEncoderAudioQualityId,  // Defaults to high
  //Apple LPCM/WAV-specific
  appleAVLinearPCMIsBigEndian?: boolean,  // Defaults to false
  appleAVLinearPCMIsFloatKeyIOS?: boolean,  // Defaults to false
  appleAVLinearPCMIsNonInterleaved?: boolean,  // Defaults to false

  //Android-specific
  androidAudioSourceId?: AndroidAudioSourceId,  // Defaults to MIC
  androidOutputFormatId?: AndroidOutputFormatId,  // Defaults to MPEG_4
  androidAudioEncoderId?: AndroidAudioEncoderId,  // Defaults to AAC
  //Android encoded/compressed-specific
  //(None)
}
```

## Contributing

See the [guide to contributing](CONTRIBUTING.md), to learn how to contribute to this repository and our development workflow.

## License & Attributions

MIT

## Attributions

This project is inspired by, and to some extent based upon, the following projects:
* [react-native-audio-recorder-player](https://www.npmjs.com/package/react-native-audio-recorder-player) by [Dooboolab] (https://github.com/hyochan/react-native-audio-recorder-player)
* [react-native-audio-record](https://github.com/goodatlas/react-native-audio-record), by [Atlas Labs](https://github.com/goodatlas)


## Development

Developing react-native modules is slow going; it is typically necessary to work in (at least) 3 languages simultaneously, and easy to make mistakes. Take your time, be deliberate, save your work through frequent small commits. 

**When project settings get messed up, it is often easier to build a new project from scratch using [create-react-native-library](https://github.com/callstack/react-native-builder-bob) - see below - then re-import your functional code into this new, up-to-date project skeleton.**

**Don't mindlessly update project settings, when XCode and Android Studio suggest to do this! Where possible, stick with the defaults provided by [create-react-native-library](https://github.com/callstack/react-native-builder-bob).**

**Don't cavalierly upgrade react-native; preview with (react-native upgrade helper)[https://react-native-community.github.io/upgrade-helper/]. Probably easier to rebuild the project with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)!**

### Set up

Download the project repo, and run `yarn` from `rn-audio` project directory. (If re-installing, may need to delete `node_modules` and `yarn.lock` files in the `project` and `example` directories.)

## Running the example (for development)

From the `rn-audio` project directory, run `yarn example ios` and `yarn example android` to run on iOS and android emulators, respectively. You may need to run `npx pod-install` as well, to ensure the iOS project has its dependencies met.


## Re-Creating the Library's Project Skeleton

### Library skeleton set-up:

  1. Run `npx create-react-native-library`
    ✔ What is the email address for the package author? … rn-audio@krispinleydon.net
    ✔ What is the URL for the package author? … https://github.com/kleydon/rn-audio
    ✔ What is the URL for the repository? … https://github.com/kleydon/rn-audio
    ✔ What type of library do you want to develop? › Native module
    ✔ Which languages do you want to use? › Kotlin & Swift
  2. `cd` into the library's main project folder
  3. Get started with the project:
    `yarn`
  4. Run example app on iOS:
    `yarn example ios`
  5. Run the example app on Android:
    `yarn example android`
  6. Create / update .gitignore, to ignore `node_modules`, etc.
  7. Add functional swift/kotlin/typescript code to the library

### Gotchas:

  * In the *Module.kt file: 
    * Be sure the value of the `TAG` string matches the (PascalCase) name of the module
    * In the module class declaration, be sure to use **private val** reactContext, so 
      reactContext is available to class member functions
  * In the XCode MODULE project - use the bridging header file.
  * Ensure that a .gitignore file is preventing unnecessary repo bloat


Upgrading react-native:
  Could use https://react-native-community.github.io/upgrade-helper/
  In reality, probably easier to start with a fresh react native project, using create-react-native-library



Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
