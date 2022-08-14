# rn-audio
React native library for recording and playing audio

## Installation:

In package.json's dependencies section:
  "rn-audio": "kleydon/rn-audio<#tag/commit/master>"

## Post-installation
  Android:
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />

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
