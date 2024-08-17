export declare enum AndroidAudioSourceId {
    DEFAULT = 0,
    MIC = 1,
    VOICE_UPLINK = 2,
    VOICE_DOWNLINK = 3,
    VOICE_CALL = 4,
    CAMCORDER = 5,
    VOICE_RECOGNITION = 6,
    VOICE_COMMUNICATION = 7,
    REMOTE_SUBMIX = 8,
    UNPROCESSED = 9,
    VOICE_PERFORMANCE = 10,//Added in API 29
    RADIO_TUNER = 1998,
    HOTWORD = 1999
}
export declare enum AndroidOutputFormatId {
    DEFAULT = 0,
    THREE_GPP = 1,
    MPEG_4 = 2,
    AMR_NB = 3,
    AMR_WB = 4,
    AAC_ADIF = 5,
    AAC_ADTS = 6,
    OUTPUT_FORMAT_RTP_AVP = 7,
    MPEG_2_TS = 8,
    WEBM = 9,
    WAV = 999
}
export declare enum AndroidAudioEncoderId {
    DEFAULT = 0,
    AMR_NB = 1,
    AMR_WB = 2,
    AAC = 3,
    HE_AAC = 4,
    AAC_ELD = 5,
    VORBIS = 6,
    LPCM = 999
}
export declare enum ByteDepthId {
    ONE = 1,
    TWO = 2
}
export declare enum NumberOfChannelsId {
    ONE = 1,
    TWO = 2
}
export declare enum AppleAudioFormatId {
    lpcm = "lpcm",// kAudioFormatLinearPCM
    aac = "aac",// kAudioFormatMPEG4AAC
    mp4 = "mp4",// kAudioFormatMPEG4AAC
    alac = "alac",// kAudioFormatAppleLossless
    ilbc = "ilbc",// kAudioFormatiLBC
    ulaw = "ulaw",// kAudioFormatULaw
    ima4 = "ima4",// kAudioFormatAppleIMA4
    MAC3 = "MAC3",// kAudioFormatMACE3
    MAC6 = "MAC6",// kAudioFormatMACE6
    alaw = "alaw",// kAudioFormatALaw
    mp1 = "mp1",// kAudioFormatMPEGLayer1
    mp2 = "mp2",// kAudioFormatMPEGLayer2
    amr = "amr",// kAudioFormatAMR
    flac = "flac",// kAudioFormatFLAC
    opus = "opus"
}
export declare enum AppleAVAudioSessionModeId {
    gamechat = "gamechat",
    measurement = "measurement",
    movieplayback = "movieplayback",
    spokenaudio = "spokenaudio",
    videochat = "videochat",
    videorecording = "videorecording",
    voicechat = "voicechat",
    voiceprompt = "voiceprompt"
}
export declare enum AppleAVEncoderAudioQualityId {
    min = 0,
    low = 32,
    medium = 64,
    high = 96,
    max = 127
}
export declare enum AppleAVLinearPCMBitDepthId {
    bit8 = 8,
    bit16 = 16,
    bit24 = 24,
    bit32 = 32
}
export declare enum PlayerState {
    Playing = "Playing",
    Paused = "Paused",
    Stopped = "Stopped"
}
export declare enum RecorderState {
    Recording = "Recording",
    Paused = "Paused",
    Stopped = "Stopped"
}
export interface RecordingOptions {
    fileNameOrPath?: string;
    recMeteringEnabled?: boolean;
    maxRecDurationSec?: number;
    sampleRate?: number;
    numChannels?: NumberOfChannelsId;
    encoderBitRate?: number;
    lpcmByteDepth?: ByteDepthId;
    appleAudioFormatId?: AppleAudioFormatId;
    appleAVAudioSessionModeId?: AppleAVAudioSessionModeId;
    appleAVEncoderAudioQualityId?: AppleAVEncoderAudioQualityId;
    appleAVLinearPCMIsBigEndian?: boolean;
    appleAVLinearPCMIsFloatKeyIOS?: boolean;
    appleAVLinearPCMIsNonInterleaved?: boolean;
    androidAudioSourceId?: AndroidAudioSourceId;
    androidOutputFormatId?: AndroidOutputFormatId;
    androidAudioEncoderId?: AndroidAudioEncoderId;
}
export declare enum EventId {
    RecStop = "RecStop",
    PlayStop = "PlayStop",
    RecUpdate = "RecUpdate",
    PlayUpdate = "PlayUpdate"
}
export declare enum RecStopCode {
    Requested = "Requested",// By user or app; not due to error or timeout
    MaxDurationReached = "MaxDurationReached",
    WasNotRecording = "WasNotRecording",// Response to request to stopRecording, when not recording
    Error = "Error"
}
export declare enum PlayStopCode {
    Requested = "Requested",// By user or app; not due to error or timeout
    MaxDurationReached = "MaxDurationReached",
    WasNotPlaying = "WasNotPlaying",
    Error = "Error"
}
export type RecStopMetadata = {
    filePath?: string;
    recStopCode: RecStopCode;
};
export type PlayStopMetadata = {
    filePathOrUrl?: string;
    playStopCode: PlayStopCode;
};
export type RecUpdateMetadata = {
    isRecording: boolean;
    recElapsedMs: number;
    recMeterLevelDb?: number;
};
export type PlayUpdateMetadata = {
    isMuted: boolean;
    playElapsedMs: number;
    playDurationMs: number;
};
interface StartPlayerArgs {
    fileNameOrPathOrURL?: string;
    httpHeaders?: Record<string, string>;
    playUpdateCallback?: ((playUpdateMetadata: PlayUpdateMetadata) => void) | null;
    playStopCallback?: ((playStopMetadata: PlayStopMetadata) => void) | null;
    playVolume?: number;
}
export type StartPlayerResult = {
    filePathOrURL: string;
};
export type StopPlayerResult = PlayStopMetadata;
interface StartRecorderArgs {
    recordingOptions: RecordingOptions;
    recUpdateCallback?: ((recUpdateMetadata: RecUpdateMetadata) => void) | null;
    recStopCallback?: ((recStopMetadata: RecStopMetadata) => void) | null;
}
export interface StartRecorderResult extends Omit<RecordingOptions, 'fileNameOrPath'> {
    filePath: string;
}
export type StopRecorderResult = RecStopMetadata;
/**
 * Audio class.
 * Consider using this module's provided `audio` instance (at the bottom of this file) as a singleton,
 * rather than creating new/multiple instances of this class.
 */
export declare class Audio {
    private _playUpdateCallback;
    private _recUpdateSubscription;
    private _recStopSubscription;
    private _playUpdateScription;
    private _playStopSubscription;
    constructor();
    /**
     * Verify required Android permissions are enabled; requesting that
     * they be enabled, if necessary. Returns true if all required
     * permissions are enabled, false otherwise.
     * @returns Promise<boolean>
     */
    verifyAndroidPermissionsEnabled(): Promise<boolean>;
    /**
     * Verify that Android's RECORD_AUDIO permission is enabled;
     * requesting that it be enabled, if necessary.
     * Returns true if enabled, false otherwise.
     * @returns Promise<boolean>
     */
    verifyAndroidRecordAudioEnabled(): Promise<boolean>;
    /**
     * Verify that Android's WRITE_EXTERNAL_STORAGE permission is enabled;
     * requesting that it be enabled, if necessary.
     * Returns true if enabled, false otherwise.
     * @returns Promise<boolean>
     */
    verifyAndroidWriteExternalStorageEnabled(): Promise<boolean>;
    /**
     * Verify that Android's READ_EXTERNAL_STORAGE permission is enabled;
     * requesting that it be enabled, if necessary.
     * Returns true if enabled, false otherwise.
     * @returns Promise<boolean>
     */
    verifyAndroidReadExternalStorageEnabled(): Promise<boolean>;
    resolveAndValidateRecordingOptions(recordingOptions: RecordingOptions): Promise<boolean>;
    mmss(secs: number): string;
    mmssss(ms: number): string;
    private addRecUpdateCallback;
    private removeRecUpdateCallback;
    private addRecStopCallback;
    private removeRecStopCallback;
    private addPlayUpdateCallback;
    private removePlayUpdateCallback;
    private addPlayStopCallback;
    private removePlayStopCallback;
    /**
     * Resolves to the current player state.
     * @returns {Promise<PlayerState>}
     */
    getPlayerState(): Promise<PlayerState>;
    /**
     * Resolves to the current recorder state.
     * @returns {Promise<RecorderState>}
     */
    getRecorderState(): Promise<RecorderState>;
    private resetRecorder;
    /**
     * Start recording
     * @param {StartRecorderArgs} startRecorderArgs param.
     * @returns {Promise<StartRecorderResult>}
     */
    startRecorder({ recordingOptions, recUpdateCallback, recStopCallback }: StartRecorderArgs): Promise<StartRecorderResult>;
    /**
     * Pause recording.
     * @returns {Promise<string>}
     */
    pauseRecorder(): Promise<string>;
    /**
     * Resume recording.
     * @returns {Promise<string>}
     */
    resumeRecorder(): Promise<string>;
    /**
     * stop recording.
     * @returns {Promise<StopRecorderResult>}
     */
    stopRecorder(silent?: boolean): Promise<StopRecorderResult>;
    private resetPlayer;
    /**
     * Start playing with param.
     * @param {StartPlayerArgs} startPlayerArgs params.
     * @returns {Promise<StartPlayerResult>}
     */
    startPlayer({ fileNameOrPathOrURL, httpHeaders, playUpdateCallback, playStopCallback, playVolume: playbackVolume }: StartPlayerArgs): Promise<StartPlayerResult>;
    /**
     * Pause playing.
     * @returns {Promise<string>}
     */
    pausePlayer(): Promise<string>;
    /**
     * Resume playing.
     * @returns {Promise<string>}
     */
    resumePlayer(): Promise<string>;
    /**
     * Stops player
     * @returns {Promise<StopPlayerResult>}
     */
    stopPlayer(): Promise<StopPlayerResult>;
    /**
     * Seek to a particular time in a recording. Doesn't currently
     * work when playback is stopped; only when playing or paused.
     * @param {number} timeMs position seek to in millisecond.
     * @returns {Promise<string>}
     */
    seekToPlayer(timeMs: number): Promise<string>;
    /**
     * Sets player volume; in the case of Android its a % relative to the current MediaVolume.
     *
     * NOTE! For Android, MediaPlayer must exist before calling this.
     * Consider using startPlayer's playbackVolume parameter instead
     *  * relative to 100% of Media Volume
     * @param {number} volume New volume (% of Media Volume) for pre-existing media player
     * @returns {Promise<string>}
     */
    setPlayerVolume(volume: number): Promise<string>;
    /**
     * Set subscription duration.
     * @param {number} sec subscription callback duration in seconds.
     * @returns {Promise<string>}
     */
    setSubscriptionDuration(sec: number): Promise<string>;
}
export declare const audio: Audio;
export {};
//# sourceMappingURL=index.d.ts.map