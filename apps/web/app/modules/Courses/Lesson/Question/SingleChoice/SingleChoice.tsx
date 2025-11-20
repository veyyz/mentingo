import { useUserRole } from "~/hooks/useUserRole";
import { ManualGradingActions } from "~/modules/Courses/Lesson/Question/ManualGradingActions";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import { SingleChoiceOptionList } from "./SingleChoiceOptionList";

import type { ManualGradingControls, QuizQuestion } from "../types";

type SingleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
  manualGrading?: ManualGradingControls;
};

export const SingleChoice = ({ question, isCompleted = false, manualGrading }: SingleChoiceProps) => {
  const { isAdmin } = useUserRole();

  return (
    <QuestionCard
      title={question.title}
      questionType="singleChoice"
      questionNumber={question.displayOrder}
      data-testid="single-choice"
    >
      <SingleChoiceOptionList
        options={question.options || []}
        questionId={question.id}
        isAdmin={isAdmin}
        isCompleted={isCompleted}
      />
      <ManualGradingActions questionId={question.id} manualGrading={manualGrading} />
    </QuestionCard>
  );
};
