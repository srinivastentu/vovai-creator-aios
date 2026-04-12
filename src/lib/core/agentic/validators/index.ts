export {
  notEmpty,
  wordCount,
  completenessCheck,
  noPlaceholderContent,
  runValidators,
  toStageValidator,
} from './text-validators'

export type {
  Validator,
  ValidatorResult,
  WordCountOptions,
} from './text-validators'

import {
  notEmpty,
  wordCount,
  completenessCheck,
  noPlaceholderContent,
  type Validator,
  type WordCountOptions,
} from './text-validators'

export interface TextValidatorOptions {
  wordCount?: WordCountOptions
}

export function createTextValidators(
  options: TextValidatorOptions = {}
): Validator[] {
  return [
    notEmpty(),
    wordCount(options.wordCount),
    completenessCheck(),
    noPlaceholderContent(),
  ]
}
