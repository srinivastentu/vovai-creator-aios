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
          'All major named elements from the prompt are present and identifiable. At most one secondary attribute (color, pose, relative position) is off. Arrangement matches the prompt\'s spatial description.',
        '9-10':
          'Every single element named in the prompt is present AND depicted with the exact specified attributes (color, pose, expression, position, count). No additions, no omissions, no substitutions. Reserved for zero-flaw matches.',
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
          'Single clear focal point sharp and unambiguous within 1 second of viewing. Background elements recede and do not compete. No distracting clutter or awkward crops. Eye travels naturally through the image.',
        '9-10':
          'Intentional composition using leading lines, rule of thirds, or deliberate negative space. Focal point, mid-ground, and background form a clear visual hierarchy. Could appear in a professional portfolio without edits. Reserved for images with zero compositional weaknesses.',
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
          'All elements share the same rendering treatment (same lighting logic, same level of detail, same color treatment). Foreground and background feel like one scene. No element looks pasted in.',
        '9-10':
          'Style is not just consistent but distinctive and purposeful — the aesthetic choice (film stock, illustration technique, lighting mood) is readable and every element reinforces it. Could be attributed to a specific artist or medium. Reserved for images with a clear signature look.',
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
          'Hands have correct finger counts. Faces are symmetric with matching eyes. Any text is legible and spelled correctly. Edges and geometry (architecture, horizons, reflections) are clean. Lighting direction is consistent across the scene.',
        '9-10':
          'Survives close inspection at every region — hands, faces, text, hair strands, fabric folds, reflections, shadows. No seams, no warps, no color fringing. Lighting is physically plausible. Reserved for images where you cannot find a single technical flaw after deliberate searching.',
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
          'Every noun named in the prompt is visible and fully inside the frame. No subject is cut off at head, hands, or feet. No requested element had to be omitted.',
        '9-10':
          'Every element named in the prompt is present, whole, and given room within the frame — no awkward crops, no element crammed against an edge. Frame usage is deliberate. Reserved for images where the composition could not fit another required element without rework.',
      },
    },
  ],
}
