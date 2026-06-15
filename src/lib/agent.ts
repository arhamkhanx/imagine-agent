import { chatText, chatJson, imageBlock, textBlock, type Block } from "./xai";

/**
 * Non-negotiable realism mandate appended to every image instruction so outputs
 * read as authentic photographs captured on a real camera — never artificial,
 * never "AI-looking", never over-rendered or plasticky.
 */
export const PHOTOREALISM = [
  "ABSOLUTE REQUIREMENT: the result must look like a genuine photograph captured on a real physical camera by a professional photographer — indistinguishable from a real editorial/campaign shoot.",
  "Specify a real camera body and lens with an exact aperture (e.g. 'shot on a Sony A7 IV with an 85mm f/1.4 lens', 'Hasselblad medium-format', 'Fujifilm color science', '35mm f/2'), a precise camera angle, and depth of field.",
  "Design the lighting explicitly (e.g. soft three-point softbox, large octabox key with subtle fill, golden-hour backlight, overcast natural window light) with realistic direction, falloff and soft shadows.",
  "Define a film stock / color grade (e.g. Kodak Portra 400 grain, muted teal cinematic grade, true-to-life neutral white balance) so tones feel photographic.",
  "Demand real-skin authenticity: visible pores, natural skin texture, fine flyaway hairs, subtle asymmetry, realistic fabric weave, wrinkles and material behaviour. Explicitly avoid airbrushed, waxy, plastic, over-smoothed, over-saturated, CGI or render-like results.",
  "Use POSITIVE framing only — describe what IS in the frame, never what is absent.",
].join(" ");

/**
 * Convert a set of moodboard images into one extremely detailed text description
 * of the visual aesthetic. Stored on save so we never resend moodboard images.
 */
export async function describeMoodboard(imageDataUris: string[]): Promise<string> {
  const blocks = [
    textBlock(
      "These images form a fashion brand moodboard. Write an EXTREMELY detailed description of the shared visual aesthetic so another AI can recreate this look without seeing the images. Cover: overall mood & vibe, color palette (specific tones), lighting (direction, quality, temperature), photographic style (lens, depth of field, grain/film vs digital), composition & framing, set/location & backdrops, styling & wardrobe cues, textures & materials, post-processing/color grading, and any recurring motifs. Be concrete and specific. Output prose only, no preamble."
    ),
    ...imageDataUris.map((u) => imageBlock(u)),
  ];
  return chatText(
    [
      {
        role: "system",
        content:
          "You are a world-class fashion creative director and photographer who writes precise, reusable aesthetic briefs.",
      },
      { role: "user", content: blocks },
    ],
    "medium"
  );
}

/** Describe an uploaded face or product image into a concise identity description. */
export async function describeSubject(
  kind: "face" | "product",
  imageDataUris: string[]
): Promise<string> {
  const what =
    kind === "face"
      ? "Describe this person's appearance for consistent re-generation: face shape, skin tone, eye color, hair (color/length/style), distinguishing features, apparent age range, and build. Do not invent a name."
      : "Describe this fashion product in precise detail: type of garment/accessory, color(s), material, cut/silhouette, patterns, hardware, and notable design details.";
  const blocks = [textBlock(`${what} Output 2-4 sentences, prose only.`), ...imageDataUris.map((u) => imageBlock(u))];
  return chatText(
    [
      { role: "system", content: "You are a meticulous fashion catalog describer." },
      { role: "user", content: blocks },
    ],
    "low"
  );
}

export type FaceRef = { handle: string; description: string; imageDataUris: string[] };
export type ProductRef = { handle: string; description: string; imageDataUris: string[] };
export type MoodboardRef = { handle: string; description: string };

export type AgentPlan = {
  prompt: string;
  rationale: string;
};

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: {
      type: "string",
      description:
        "The final, production-ready image prompt — long, dense and extremely detailed (aim for 120-220 words). It MUST begin with a strong directing verb (e.g. 'Photograph', 'Capture', 'Shoot') and follow the structure [Subject] + [Action/pose] + [Location/context] + [Composition/framing] + [Style]. Within Style, explicitly cover: camera body + lens + exact aperture, camera angle, depth of field, lighting design, film stock / color grade, and material & texture detail (specific fabrics, skin texture). Be concrete and narrative, not a keyword list. Use positive framing only. Do NOT reference @handles, the words 'reference image', 'moodboard', or 'AI'.",
    },
    rationale: {
      type: "string",
      description: "1-3 sentences explaining the key creative choices (camera, lighting, grade, styling).",
    },
  },
  required: ["prompt", "rationale"],
};

/**
 * The core agent: given resolved references and a user instruction, analyze the
 * reference images + descriptions + moodboard brief and write the perfect prompt.
 */
export async function planGeneration(opts: {
  instruction: string;
  faces: FaceRef[];
  products: ProductRef[];
  moodboards: MoodboardRef[];
  aspectRatio: string;
  hasSourceImages: boolean;
}): Promise<AgentPlan> {
  const { instruction, faces, products, moodboards, aspectRatio, hasSourceImages } = opts;

  const contextLines: string[] = [];
  contextLines.push(`USER INSTRUCTION: ${instruction}`);
  contextLines.push(`TARGET ASPECT RATIO: ${aspectRatio}`);
  if (faces.length)
    contextLines.push(
      "FACES / MODELS:\n" +
        faces.map((f) => `- @${f.handle}: ${f.description || "(no description)"}`).join("\n")
    );
  if (products.length)
    contextLines.push(
      "PRODUCTS:\n" +
        products.map((p) => `- @${p.handle}: ${p.description || "(no description)"}`).join("\n")
    );
  if (moodboards.length)
    contextLines.push(
      "MOODBOARD AESTHETIC BRIEFS:\n" +
        moodboards.map((m) => `- @${m.handle}:\n${m.description || "(no description)"}`).join("\n\n")
    );

  const guidance = hasSourceImages
    ? "Reference images for the face(s) and product(s) are attached and WILL be passed to the image model as visual references, so the model will preserve the person's identity and the product's exact design. Write the prompt assuming the model can see them — focus on pose, styling, scene, composition, lighting, lens and grading, and instruct it to faithfully keep the referenced person's exact likeness and the product's exact design, fabric and details."
    : "No reference images are available; the prompt must fully describe the subject and product from the text descriptions.";

  const blocks: Block[] = [
    textBlock(contextLines.join("\n\n")),
    textBlock(
      `\nGUIDANCE: ${guidance}\n\nApply the moodboard aesthetic brief(s) thoroughly — translate its lighting, palette, grade and mood into concrete photographic direction.\n\n${PHOTOREALISM}\n\nProduce a single cohesive, high-end fashion image prompt that obeys every requirement above.`
    ),
  ];

  // Attach the actual reference images so the agent can visually analyze them.
  for (const f of faces) for (const u of f.imageDataUris) blocks.push(imageBlock(u));
  for (const p of products) for (const u of p.imageDataUris) blocks.push(imageBlock(u));

  return chatJson<AgentPlan>(
    [
      {
        role: "system",
        content:
          "You are an elite fashion-photography creative director and prompt engineer. You translate a brand's references (model, product, moodboard aesthetic) and a casual instruction into a single flawless, extremely detailed image-generation prompt that yields a premium, on-brand fashion image that looks like a REAL photograph shot on a REAL camera — never artificial or AI-looking. You direct the scene like a creative director: subject, wardrobe, pose, location, composition/framing, exact camera body + lens + aperture, camera angle, depth of field, lighting design, film stock / color grade, and material & texture (fabric weave, authentic skin texture). You always use positive framing (describe what is present) and write dense narrative prompts, never keyword lists.",
      },
      { role: "user", content: blocks },
    ],
    PLAN_SCHEMA,
    "PromptPlan",
    "medium"
  );
}

const EDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: {
      type: "string",
      description:
        "A single precise image-EDIT instruction for the model. Explicitly state what to CHANGE (the user's request) and what to KEEP EXACTLY THE SAME (identity, pose, framing, product design, background — whatever the user did not ask to change). If reference samples were attached, describe the specific qualities to borrow from them (e.g. a colour, texture, lighting or styling cue). Keep the camera, lens and grade consistent so it still reads as the same real photograph. Use positive framing. Do NOT mention 'AI', '@handles', or 'reference image #'.",
    },
    rationale: {
      type: "string",
      description: "1-2 short sentences: what you changed and what you preserved.",
    },
  },
  required: ["prompt", "rationale"],
};

/**
 * The refinement agent: looks at the CURRENT image, the user's comment, and any
 * attached reference samples, then writes one surgical edit instruction. The
 * user's raw message is never sent to the image model — only this prompt is.
 */
export async function planRefinement(opts: {
  instruction: string;
  contextLabel: string;
  sourceDataUri: string;
  attachmentDataUris: string[];
}): Promise<AgentPlan> {
  const blocks: Block[] = [
    textBlock(`WHAT THIS IMAGE IS: ${opts.contextLabel}`),
    textBlock(`USER'S CHANGE REQUEST: ${opts.instruction}`),
    textBlock("Below is the CURRENT image to edit:"),
    imageBlock(opts.sourceDataUri),
  ];
  if (opts.attachmentDataUris.length) {
    blocks.push(
      textBlock(
        "The following are reference SAMPLES the user attached to guide the edit (borrow only the relevant qualities they intend, not the whole image):"
      )
    );
    for (const u of opts.attachmentDataUris) blocks.push(imageBlock(u));
  }
  blocks.push(
    textBlock(
      `\nInterpret the user's intent precisely. Change only what they asked; preserve everything else. ${PHOTOREALISM}`
    )
  );

  return chatJson<AgentPlan>(
    [
      {
        role: "system",
        content:
          "You are an elite photo retoucher and fashion art director. You take a base image plus a casual change request (and optional reference samples) and write ONE surgical, production-ready image-edit instruction that applies exactly the requested change while preserving the subject's identity, the product's design, and the overall composition — and keeps the authentic real-camera photographic look. You never over-edit and never make it look artificial.",
      },
      { role: "user", content: blocks },
    ],
    EDIT_SCHEMA,
    "EditPlan",
    "medium"
  );
}
