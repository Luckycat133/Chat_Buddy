export { fetchWeather } from './weather.js';
export { fetchLightSearch } from './search.js';
export { requestCalendarAction, readTodayCalendar } from './calendar.js';
export {
  generateImage,
  synthesizeSpeech,
  MediaError,
  MediaErrorCode,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
  MAX_IMAGE_PROMPT_LENGTH,
  MAX_TTS_TEXT_LENGTH,
  IMAGE_ASPECT_RATIOS,
} from './media.js';
export type {
  WeatherResult,
} from './weather.js';
export type {
  SearchResult,
} from './search.js';
export type {
  CalendarAction,
  CalendarReadResult,
  TodayCalendarResult,
} from './calendar.js';
export type {
  ImageAspectRatio,
  ImageGenerationRequest,
  ImageGenerationResult,
  GeneratedImage,
  TtsRequest,
  TtsResult,
} from './media.js';
