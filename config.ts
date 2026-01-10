import * as z from "zod";

import { decodeB64, encodeB64 } from "./base64";
import { LocaleZod } from "./strings";

const CSS_COLOR_REGEX = /^#?[a-zA-Z0-9().,%\s]+$/;

const BASE64_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|svg\+xml);base64,/;

export const StepTypeZod = z.enum(['GO', 'NOGO', 'BLOCK']);
export type StepType = z.infer<typeof StepTypeZod>;

export const ResourceZod = z.object({
  type: z.literal('image'),
  src: z.string().superRefine((val, ctx) => {
    if (BASE64_IMAGE_REGEX.test(val)) return;

    try {
      const url = new URL(val);

      const ALLOWED_PROTOCOLS = ['http:', 'https:'];
      if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
        ctx.addIssue({
          code: 'custom',
          message: `URL protocol must be http or https. Found: ${url.protocol}`,
        });
      }
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: `Must be a valid HTTP/HTTPS URL or Base64 image data: ${e}`,
      });
    }
  }),
  element: z.custom<HTMLImageElement>((val) => {
    return typeof HTMLImageElement !== 'undefined' && val instanceof HTMLImageElement;
  }).optional(),
});
export type Resource = z.infer<typeof ResourceZod>;

export const ParsedStepZod = z.object({
  type: StepTypeZod,
  durationMs: z.number().int().positive(),
  originalString: z.string(),
});
export type ParsedStep = z.infer<typeof ParsedStepZod>;

export const StageConfigZod = z.object({
  name: z.string().min(1),
  welcomeText: z.string(),
  totalTimeMs: z.number().int().min(0).optional(),  // absent or 0 for run-once
  steps: z.array(z.string().regex(/^[GNB][1-9][0-9]*$/)),
  parsedSteps: z.array(ParsedStepZod).optional(),  // populated on init
});
export type StageConfig = z.infer<typeof StageConfigZod>;

export const GingerConfigZod = z.object({
  lang: LocaleZod,

  textColor: z.string().regex(CSS_COLOR_REGEX).optional(),
  backgroundColor: z.string().regex(CSS_COLOR_REGEX).optional(),
  textSize: z.number().positive().optional(),

  welcomeText: z.string(),
  go: ResourceZod,
  nogo: ResourceZod,
  stages: z.array(StageConfigZod).min(1),
});
export type GingerConfig = z.infer<typeof GingerConfigZod>;

export const STEP_OUTCOME_VALS = ['HIT', 'MISS', 'FALSE_ALARM', 'CORRECT_REJECTION'] as const;
export const StepOutcomeValuesZod = z.enum(STEP_OUTCOME_VALS);

export const StepOutcomeZod = z.object({
  stageIndex: z.number().int().min(0),
  stepIndex: z.number().int().min(0),
  type: StepTypeZod,
  outcome: StepOutcomeValuesZod,
  responseTimeMs: z.number().positive().nullable(),  // null means no response
  timestamp: z.number().int().positive(),
});
export type StepOutcome = z.infer<typeof StepOutcomeZod>;

export interface ParseResult {
  config?: GingerConfig;
  decodedHash?: string;
  error?: any;
}

export function loadConfigFromUrl(): ParseResult {
  let result: ParseResult = {};
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      return {};
    }

    const v1Prefix = 'v1/';
    if (!hash.startsWith(v1Prefix)) {
      throw new Error('invalid prefix');
    }

    result.decodedHash = decodeB64(hash.substring(v1Prefix.length));
    result.config = GingerConfigZod.parse(JSON.parse(result.decodedHash));
  } catch (error) {
    console.error(error);
    result.error = error;
  }
  return result;
}

export function encodeUrlWithConfig(configStr: string): string {
  const encodedConfig = encodeB64(configStr);
  const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
  const fullUrl = `${baseUrl}#v1/${encodedConfig}`;
  return fullUrl;
}
