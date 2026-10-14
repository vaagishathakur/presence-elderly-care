import { SkillBuilders } from "ask-sdk-core";
import { CheckInIntentHandler } from "./handlers/checkInHandler.js";
import { DevotionalPlaybackIntentHandler } from "./handlers/devotionalPlaybackHandler.js";
import { DistressIntentHandler } from "./handlers/distressHandler.js";
import { FallbackIntentHandler } from "./handlers/fallbackHandler.js";
import { LaunchRequestHandler } from "./handlers/launchHandler.js";
import { MedicationConfirmationIntentHandler } from "./handlers/medicationConfirmationHandler.js";
import { SleepWakeCheckInIntentHandler } from "./handlers/sleepWakeCheckInHandler.js";
import {
  CancelAndStopIntentHandler,
  CustomErrorHandler,
  HelpIntentHandler,
  SessionEndedRequestHandler,
} from "./handlers/standardHandlers.js";
import { PassiveInteractionLoggingInterceptor } from "./interceptors/loggingInterceptor.js";

export const skill = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    CheckInIntentHandler,
    DevotionalPlaybackIntentHandler,
    SleepWakeCheckInIntentHandler,
    MedicationConfirmationIntentHandler,
    DistressIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(CustomErrorHandler)
  .addResponseInterceptors(PassiveInteractionLoggingInterceptor)
  .create();

export async function invokeSkill(requestEnvelope) {
  return skill.invoke(requestEnvelope);
}

export const lambdaHandler = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    CheckInIntentHandler,
    DevotionalPlaybackIntentHandler,
    SleepWakeCheckInIntentHandler,
    MedicationConfirmationIntentHandler,
    DistressIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(CustomErrorHandler)
  .addResponseInterceptors(PassiveInteractionLoggingInterceptor)
  .lambda();
