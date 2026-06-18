export function deathRoundsEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  return a.every((round, index) => {
    const other = b[index];
    return other !== undefined &&
      round.length === other.length &&
      round.every((player, playerIndex) => player === other[playerIndex]);
  });
}

export function hasNightDeathStepTransientState(args: {
  nightDeathRounds: number[][];
  initialNightDeathRounds: number[][];
  handledNightDeathSkills: number[];
  nightDeathSkillTarget: number | null;
  nightDeathSkillBlocked: number | null;
  nightDeathBadgeAction: unknown | null;
  nightDeathBadgeRecipient: number | null;
  nightDeathBadgeResolved: boolean;
  bishopTriggerStep: 1 | 4 | null;
  bishopRevealTarget: number | null;
  bishopResolved: boolean;
}): boolean {
  return !deathRoundsEqual(args.nightDeathRounds, args.initialNightDeathRounds) ||
    args.handledNightDeathSkills.length > 0 ||
    args.nightDeathSkillTarget !== null ||
    args.nightDeathSkillBlocked !== null ||
    args.nightDeathBadgeAction !== null ||
    args.nightDeathBadgeRecipient !== null ||
    args.nightDeathBadgeResolved ||
    args.bishopTriggerStep === 1 ||
    args.bishopRevealTarget !== null ||
    args.bishopResolved;
}
