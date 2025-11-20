import type { GetLessonByIdResponse } from "~/api/generated-api";

export type QuizQuestion = NonNullable<
  GetLessonByIdResponse["data"]["quizDetails"]
>["questions"][number];

export type QuizQuestionOption = NonNullable<QuizQuestion["options"]>[number];

export type ManualGradingControls = {
  evaluations: Record<string, boolean>;
  onChange: (questionId: string, isCorrect: boolean) => void;
  isPending?: boolean;
};
