# rn-audio

Simple react-native library for recording and playing audio files on `iOS` and `android`, with platform-supported formats + WAV. This module can additionally play (supported) audio files given a URL.



## Installation:

In your react-native project's directory, type:
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
```plist
<key>NSMicrophoneUsageDescription</key>
<string>Give $(PRODUCT_NAME) permission to use your microphone. Your record wont be shared without your permission.</string>
```
Also, add swift bridging header (if you haven't created one already) for swift compatibility.

#### Android

Add the following permissions to your application's `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```



## Set up (for development)

Run `yarn` from rn-audio project directory. (If re-installing, may need to delete node_modules and yarn.lock files in project and example directories...)

## Running the example (for development)

Run `yarn example ios/android` from rn-audio project directory


## Usage

```js
import { Audio } from "rn-audio";

// ...
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

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
