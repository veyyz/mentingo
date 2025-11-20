import { Question } from "app/modules/Courses/Lesson/Question";

import type { GetLessonByIdResponse } from "~/api/generated-api";
import type { ManualGradingControls } from "~/modules/Courses/Lesson/Question/types";

type Questions = NonNullable<GetLessonByIdResponse["data"]["quizDetails"]>["questions"];

type QuestionsProps = {
  questions: Questions;
  isQuizCompleted?: boolean;
  lessonId: string;
  manualGrading?: ManualGradingControls;
};

export const Questions = ({
  questions,
  isQuizCompleted = false,
  lessonId,
  manualGrading,
}: QuestionsProps) => {
  return questions.map((question: Questions[number]) => {
    if (!question) return null;

    return (
      <Question
        key={question.id}
        question={question}
        isCompleted={isQuizCompleted}
        lessonId={lessonId}
        manualGrading={manualGrading}
      />
    );
  });
};
