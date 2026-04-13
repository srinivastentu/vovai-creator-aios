// Image quality rubric — 5 dimensions, weights sum to 1.0.
// Domain-agnostic: no eLearning-specific concepts.

import type { RubricDefinition } from '../../engine/types'

export const imageRubric: RubricDefinition = {
  id: 'image-quality-v1',
  name: 'Image Quality',
  passThreshold: 7,
  dimensions: [
    {
      id: 'prompt-alignment',
      name: 'Prompt Alignment',
      weight: 0.3,
      passThreshold: 6,
      description:
        'Does the image accurately depict what was requested? Are all described elements present? Is the scene/composition correct?',
      criteria: {
        '1-3':
          'Image bears little resemblance to the prompt. Major elements missing or wrong. Subject, setting, or composition contradicts the request.',
        '4-6':
          'Image loosely matches the prompt. Some elements present but composition or details diverge significantly. Viewer could identify the topic but key specifics are off.',
        '7-8':
          'Image clearly matches the prompt. All major elements present in the right arrangement; minor details may differ but nothing important is wrong.',
        '9-10':
          'Image is a precise visual translation of the prompt. Every described element rendered exactly as specified, with no additions or omissions.',
      },
    },
    {
      id: 'visual-clarity',
      name: 'Visual Clarity',
      weight: 0.25,
      passThreshold: 6,
      description:
        'Is the image clear and well-composed? Is the focal point obvious? Is it easy to understand at a glance?',
      criteria: {
        '1-3':
          'Image is confusing, cluttered, or blurry in important areas. No clear focal point. Viewer cannot tell what the image is about.',
        '4-6':
          'Focal point exists but composition is weak. Some visual noise or awkward framing distracts from the subject. Legible but not strong.',
        '7-8':
          'Clear focal point, good composition, clean framing. Important areas are sharp. Easy to read at a glance.',
        '9-10':
          'Exceptional composition — deliberate, balanced, immediately legible. Focal point, supporting elements, and negative space work together.',
      },
    },
    {
      id: 'style-quality',
      name: 'Style Quality',
      weight: 0.2,
      passThreshold: 6,
      description:
        'Is the artistic style appropriate and consistent throughout the image? No style breaks between elements?',
      criteria: {
        '1-3':
          'Style is inappropriate for the subject or wildly inconsistent — different elements look like they came from different images.',
        '4-6':
          'Style is mostly consistent but has visible breaks or mismatches between elements. Tone and treatment are uneven.',
        '7-8':
          'Style is appropriate and consistent throughout. All elements render in the same visual language with matching treatment.',
        '9-10':
          'Distinctive, cohesive artistic style executed with precision. Every element reinforces the intended aesthetic.',
      },
    },
    {
      id: 'technical-quality',
      name: 'Technical Quality',
      weight: 0.15,
      passThreshold: 6,
      description:
        'No AI artifacts (mangled hands, extra fingers, distorted text, seam lines)? Good resolution, lighting, and color balance?',
      criteria: {
        '1-3':
          'Serious AI artifacts present — mangled anatomy, garbled text, obvious seams, broken geometry. Poor resolution, muddy color, or broken lighting.',
        '4-6':
          'Minor artifacts visible on close inspection (small anatomy issues, slight text distortion). Resolution and lighting are adequate but not clean.',
        '7-8':
          'No obvious AI artifacts. Anatomy, text, and geometry look right. Resolution, color, and lighting are production quality.',
        '9-10':
          'Technically flawless. No artifacts at any inspection level. Resolution, color, and lighting are professional-grade.',
      },
    },
    {
      id: 'completeness',
      name: 'Completeness',
      weight: 0.1,
      passThreshold: 6,
      description:
        'Are ALL requested elements present? Nothing cut off at edges? No missing components from the prompt?',
      criteria: {
        '1-3':
          'Major requested elements missing or cut off at image edges. Large portions of the brief are not represented.',
        '4-6':
          'Most elements present but at least one requested component is missing, cropped, or only partially rendered.',
        '7-8':
          'All requested elements are present and fully contained within the frame. Nothing important is cropped.',
        '9-10':
          'Every element from the prompt is present, complete, and well-placed. Composition uses the frame fully without cropping anything important.',
      },
    },
  ],
}
