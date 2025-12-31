import { decodeB64, encodeB64 } from "./base64";
import { Locale } from "./strings";

export type StepType = 'GO' | 'NOGO' | 'BLOCK';

export interface Resource {
  type: 'image'; // could expand to 'audio' later
  src: string;
  element?: HTMLImageElement;
}

// Parsed step for internal use (much faster than string parsing every time)
export interface ParsedStep {
  type: StepType;
  durationMs: number;
  originalString: string;
}

export interface StageConfig {
  name: string; // "Trial" or "Real"
  welcomeText: string;
  totalTimeMs?: number; // absent or 0 for run-once
  steps: string[];     // Keep string format for easy config writing
  parsedSteps?: ParsedStep[]; // We populate this on init
}

export interface GingerConfig {
  lang: Locale;
  textColor?: string;  // if present, overrides the default
  backgroundColor?: string;  // if present, overrides the default
  textSize?: number;  // if present, overrides the default
  welcomeText: string;
  go: Resource;
  nogo: Resource;
  stages: StageConfig[];
}

export const STEP_OUTCOME_VALS = [ 'HIT', 'MISS', 'FALSE_ALARM', 'CORRECT_REJECTION' ] as const;

export interface StepOutcome {
  stageIndex: number;
  stepIndex: number;
  type: StepType;
  outcome: typeof STEP_OUTCOME_VALS[number];
  responseTimeMs: number | null; // null if no response (FIXME: is not null in the end)
  timestamp: number;
}

export function loadConfigFromUrl(): GingerConfig | undefined {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      return undefined;
    }

    const v1Prefix = 'v1/';
    if (!hash.startsWith(v1Prefix)) {
      throw new Error('invalid prefix');
    }

    const jsonString = decodeB64(hash.substring(v1Prefix.length));

    // TODO: zod and validate
    const config = JSON.parse(jsonString) as GingerConfig;

    return config;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

export function encodeUrlWithConfig(configStr: string): string {
  const encodedConfig = encodeB64(configStr);
  const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
  const fullUrl = `${baseUrl}#v1/${encodedConfig}`;
  return fullUrl;
}
