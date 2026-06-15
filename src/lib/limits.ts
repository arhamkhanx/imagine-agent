// Max images stored per face/product. The generation agent picks the best
// references from these, so we keep the set small and curated.
export const MAX_SUBJECT_IMAGES = 5;

// Angle presets for generating additional views from a primary image.
export const FACE_ANGLES: { id: string; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "three_quarter_left", label: "¾ Left" },
  { id: "three_quarter_right", label: "¾ Right" },
  { id: "left_profile", label: "Left profile" },
  { id: "right_profile", label: "Right profile" },
  { id: "looking_up", label: "Looking up" },
  { id: "looking_down", label: "Looking down" },
];

export const PRODUCT_ANGLES: { id: string; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "side", label: "Side" },
  { id: "three_quarter", label: "¾ View" },
  { id: "detail_closeup", label: "Detail close-up" },
  { id: "flat_lay", label: "Flat lay" },
];
