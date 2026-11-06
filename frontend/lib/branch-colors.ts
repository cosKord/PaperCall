const palette = ["#4285ff", "#16b989", "#f05a50", "#9254df", "#3977a8", "#f2a323"] as const;

const branchPalette: Record<string, number> = {
  IT: 0,
  CSE: 1,
  AIDS: 2,
  CSBS: 3,
  MECH: 4,
  CCE: 5,
};

export function branchHighlight(branch: string, index = 0) {
  return palette[branchPalette[branch] ?? index % palette.length];
}

export function branchBorderClass(branch: string, index = 0) {
  return {
    "#4285ff": "border-t-[#4285ff]",
    "#16b989": "border-t-[#16b989]",
    "#f05a50": "border-t-[#f05a50]",
    "#9254df": "border-t-[#9254df]",
    "#3977a8": "border-t-[#3977a8]",
    "#f2a323": "border-t-[#f2a323]",
  }[branchHighlight(branch, index)];
}
