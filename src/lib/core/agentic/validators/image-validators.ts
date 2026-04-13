// Image validators — deterministic, zero-cost gates that run BEFORE the AI
// vision judge. Sync functions; no network, no domain imports.

import { statSync } from 'node:fs'
import { imageSize } from 'image-size'
import { readFileSync } from 'node:fs'
import type { Validator, ValidatorResult } from './text-validators'

export const IMAGE_VALIDATOR_DEFAULTS = {
  minFileSizeBytes: 10_240,
  maxFileSizeBytes: 20 * 1024 * 1024,
  minWidth: 1024,
  minHeight: 1024,
  minWidescreenWidth: 1280,
  minWidescreenHeight: 720,
} as const

export interface ImageValidatorOptions {
  minFileSizeBytes?: number
  maxFileSizeBytes?: number
  minWidth?: number
  minHeight?: number
  minWidescreenWidth?: number
  minWidescreenHeight?: number
}

function hasImagePath(artifact: unknown): artifact is { imagePath: string } {
  return (
    artifact != null &&
    typeof artifact === 'object' &&
    typeof (artifact as { imagePath?: unknown }).imagePath === 'string' &&
    (artifact as { imagePath: string }).imagePath.length > 0
  )
}

function fail(name: string, message: string): ValidatorResult {
  return { pass: false, name, message }
}

function pass(name: string, message: string): ValidatorResult {
  return { pass: true, name, message }
}

export function fileExists(): Validator {
  return (artifact) => {
    if (!hasImagePath(artifact)) {
      return fail('fileExists', 'Invalid artifact: missing imagePath')
    }
    const path = artifact.imagePath
    try {
      const stat = statSync(path)
      if (!stat.isFile()) {
        return fail('fileExists', `Image path is not a file: ${path}`)
      }
      return pass('fileExists', `File exists: ${path}`)
    } catch {
      return fail('fileExists', `Image file does not exist: ${path}`)
    }
  }
}

export function fileSize(options: ImageValidatorOptions = {}): Validator {
  const min = options.minFileSizeBytes ?? IMAGE_VALIDATOR_DEFAULTS.minFileSizeBytes
  const max = options.maxFileSizeBytes ?? IMAGE_VALIDATOR_DEFAULTS.maxFileSizeBytes
  return (artifact) => {
    if (!hasImagePath(artifact)) {
      return fail('fileSize', 'Invalid artifact: missing imagePath')
    }
    const path = artifact.imagePath
    let size: number
    try {
      size = statSync(path).size
    } catch {
      return fail('fileSize', `Image file does not exist: ${path}`)
    }
    if (size === 0) {
      return fail('fileSize', `Image file is empty (0 bytes): ${path}`)
    }
    if (size < min) {
      return fail(
        'fileSize',
        `Image file is suspiciously small (${size} bytes, minimum ${min}): ${path}`
      )
    }
    if (size > max) {
      const sizeMB = (size / (1024 * 1024)).toFixed(1)
      const maxMB = (max / (1024 * 1024)).toFixed(0)
      return fail(
        'fileSize',
        `Image file exceeds maximum size (${sizeMB}MB, maximum ${maxMB}MB): ${path}`
      )
    }
    return pass('fileSize', `File size ${size} bytes within [${min}, ${max}]`)
  }
}

export function imageDimensions(options: ImageValidatorOptions = {}): Validator {
  const minW = options.minWidth ?? IMAGE_VALIDATOR_DEFAULTS.minWidth
  const minH = options.minHeight ?? IMAGE_VALIDATOR_DEFAULTS.minHeight
  const minWsW = options.minWidescreenWidth ?? IMAGE_VALIDATOR_DEFAULTS.minWidescreenWidth
  const minWsH = options.minWidescreenHeight ?? IMAGE_VALIDATOR_DEFAULTS.minWidescreenHeight
  return (artifact) => {
    if (!hasImagePath(artifact)) {
      return fail('imageDimensions', 'Invalid artifact: missing imagePath')
    }
    const path = artifact.imagePath
    let width: number | undefined
    let height: number | undefined
    try {
      const buf = readFileSync(path)
      const dims = imageSize(buf)
      width = dims.width
      height = dims.height
    } catch {
      return fail('imageDimensions', `Unable to read image dimensions: ${path}`)
    }
    if (width == null || height == null) {
      return fail('imageDimensions', `Unable to determine dimensions: ${path}`)
    }
    const squareOk = width >= minW && height >= minH
    const widescreenOk = width >= minWsW && height >= minWsH
    if (!squareOk && !widescreenOk) {
      return fail(
        'imageDimensions',
        `Image dimensions too small (${width}×${height}). Minimum: ${minW}×${minH} or ${minWsW}×${minWsH}`
      )
    }
    return pass('imageDimensions', `Dimensions ${width}×${height} meet minimum`)
  }
}

export function createImageValidators(options: ImageValidatorOptions = {}): Validator[] {
  return [fileExists(), fileSize(options), imageDimensions(options)]
}
