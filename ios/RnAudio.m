#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RnAudio, RCTEventEmitter)

RCT_EXTERN_METHOD(setSubscriptionDuration:(double)durationSec);

RCT_EXTERN_METHOD(startRecorder:(NSDictionary *)recordingOptions
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(stopRecorder:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(pauseRecorder:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(resumeRecorder:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(setVolume:(float)volume
                  resolver:(RCTPromiseResolveBlock) resolve
                  rejecter:(RCTPromiseRejectBlock) reject);

RCT_EXTERN_METHOD(startPlayer:(NSString*)path
                  httpHeaders:(NSDictionary*)httpHeaders
                  playbackVolume:(double)playbackVolume
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(resumePlayer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(seekToPlayer:(nonnull double*) time
                  resolve:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(pausePlayer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

RCT_EXTERN_METHOD(stopPlayer:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject);

@end
