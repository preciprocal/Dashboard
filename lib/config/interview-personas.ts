// lib/config/interview-personas.ts
// Who the candidate sees and hears on the interview panel.
//
// ─── Why this is one file rather than a list in each component ──────────────
//
// There were three copies of this data and two independent bugs fell out of
// having them, both visible to the candidate in a real session.
//
// 1. The panel and the voice disagreed. The on-screen tiles were named from a
//    hashed list of American names, while the interviewer said its name aloud
//    from a separate hardcoded string in FullScreenInterviewPanel. So the
//    screen said "Savannah Mitchell" while the voice introduced itself as
//    "Rohan Sharma". Two sources, no reason for them to ever agree.
//
// 2. Two panelists could share a first name. The HR and Lead names were drawn
//    from separate arrays by `hash % 4` and `(hash + 1) % 4`, and both arrays
//    contained a Jennifer at the colliding offsets - so one interview in four
//    was staffed by Jennifer Davis and Jennifer Anderson. Independent lists
//    cannot express "these people are in a room together".
//
// Both are fixed structurally rather than by patching the lists. A panel is
// now picked as a COMPLETE SET, written as a unit, so the members are chosen
// against each other. assertPanelsAreDistinct() turns a future collision into
// a startup failure instead of a strange call.
//
// ─── Names track the voices ─────────────────────────────────────────────────
//
// The interviewers speak with Azure en-IN voices (constants/index.ts):
// Prabhat, male, for the technical lead and Neerja, female, for the HR
// interviewer. The prompts have each one say its name during the introduction,
// so a name that does not fit the accent or the gender is immediately audible.
// Every `hr` below is therefore a female Indian name and every `lead` a male
// one. Changing a voice means revisiting this list.
//
// `junior` never speaks. It is a silent third tile that makes the panel feel
// like a panel, so its gender is unconstrained.

export interface Persona {
  name: string;
  /** Shown on the avatar tile when the video is not playing. */
  initials: string;
}

export interface InterviewPanel {
  /** Behavioural interviewer. Speaks with the female voice. */
  hr: Persona;
  /** Technical interviewer. Speaks with the male voice. */
  lead: Persona;
  /** Silent observer. */
  junior: Persona;
}

/**
 * Written as whole panels, not as three independent lists.
 *
 * Within a panel every first name AND every set of initials is distinct, which
 * is the property the old shape could not guarantee. Keep it that way when
 * adding one; assertPanelsAreDistinct() checks it.
 */
const PANELS: readonly InterviewPanel[] = [
  {
    hr:     { name: "Priya Menon",      initials: "PM" },
    lead:   { name: "Rohan Sharma",     initials: "RS" },
    junior: { name: "Aditya Nair",      initials: "AN" },
  },
  {
    hr:     { name: "Ananya Iyer",      initials: "AI" },
    lead:   { name: "Vikram Desai",     initials: "VD" },
    junior: { name: "Meera Joshi",      initials: "MJ" },
  },
  {
    hr:     { name: "Kavya Reddy",      initials: "KR" },
    lead:   { name: "Arjun Malhotra",   initials: "AM" },
    junior: { name: "Rahul Bose",       initials: "RB" },
  },
  {
    hr:     { name: "Neha Kulkarni",    initials: "NK" },
    lead:   { name: "Sanjay Pillai",    initials: "SP" },
    junior: { name: "Divya Krishnan",   initials: "DK" },
  },
] as const;

/**
 * Same string hash the previous implementation used.
 *
 * Kept identical so an interview in progress keeps the panel it started with
 * rather than swapping names mid-session. Only the table it indexes changed.
 */
function hashOf(id: string): number {
  const h = (id || "default").split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  return Math.abs(h);
}

/**
 * The panel for an interview. Stable for a given id.
 *
 * Every caller must use this rather than picking names itself: the whole point
 * is that the tile on screen and the name the voice says are the same string.
 */
export function panelFor(interviewId: string): InterviewPanel {
  return PANELS[hashOf(interviewId) % PANELS.length];
}

/**
 * Throws if any panel has two members sharing a first name or initials.
 *
 * This is the "two Jennifers" regression, expressed as a check. It is cheap and
 * runs from panelFor's module load path in development via the call below.
 */
export function assertPanelsAreDistinct(): void {
  PANELS.forEach((panel, i) => {
    const members = [panel.hr, panel.lead, panel.junior];

    const firstNames = members.map((m) => m.name.split(" ")[0].toLowerCase());
    if (new Set(firstNames).size !== firstNames.length) {
      throw new Error(
        `Interview panel ${i} has two people with the same first name (${firstNames.join(", ")}). ` +
          `A candidate would see them side by side.`,
      );
    }

    const initials = members.map((m) => m.initials.toUpperCase());
    if (new Set(initials).size !== initials.length) {
      throw new Error(
        `Interview panel ${i} has duplicate initials (${initials.join(", ")}), ` +
          `so two avatar tiles would be indistinguishable.`,
      );
    }
  });
}

assertPanelsAreDistinct();
