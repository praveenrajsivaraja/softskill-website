export const nextUnansweredQuestionIndex = (
  answers: Record<string, string>,
  questionIds: string[],
  fromIndex: number,
): number => {
  for (let offset = 1; offset < questionIds.length; offset += 1) {
    const candidate = (fromIndex + offset) % questionIds.length;
    if (!(answers[questionIds[candidate]] ?? '').trim()) {
      return candidate;
    }
  }
  return -1;
};

export const unansweredQuestionCount = (
  answers: Record<string, string>,
  questionIds: string[],
): number => {
  return questionIds.filter((questionId) => !(answers[questionId] ?? '').trim()).length;
};
