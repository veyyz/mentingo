import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";

import { CourseStudentsQuizResultsTable } from "./CourseStudentsQuizResultsTable";

import type { GetAverageQuizScoresResponse, GetCourseResponse } from "~/api/generated-api";
import type { CourseStudentsQuizResultsQueryParams } from "~/api/queries/admin/useCourseStudentsQuizResults";
import type { FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

interface CourseQuizzesAccordionProps {
  course?: GetCourseResponse["data"];
  averageQuizScores?: GetAverageQuizScoresResponse["data"];
}

type QuizSearchParamsMap = Record<string, CourseStudentsQuizResultsQueryParams>;

export function CourseQuizzesAccordion({ course, averageQuizScores }: CourseQuizzesAccordionProps) {
  const { t } = useTranslation();

  const [quizSearchParamsById, setQuizSearchParamsById] = useState<QuizSearchParamsMap>({});

  const quizzes = useMemo(() => {
    return (
      course?.chapters.flatMap((chapter) =>
        chapter.lessons
          .filter((lesson) => lesson.type === LessonType.QUIZ)
          .map((lesson) => ({ id: lesson.id, title: lesson.title })),
      ) || []
    );
  }, [course?.chapters]);

  const attemptsByQuizId = useMemo(() => {
    const attemptsMap = new Map<string, number>();

    averageQuizScores?.averageScoresPerQuiz.forEach((quiz) => {
      attemptsMap.set(quiz.quizId, quiz.finishedCount);
    });

    return attemptsMap;
  }, [averageQuizScores?.averageScoresPerQuiz]);

  const handleFilterChange = (quizId: string, name: string, value: FilterValue) => {
    setQuizSearchParamsById((prev) => {
      const previousParams = prev[quizId] ?? { quizId, sort: "-quizScore" };

      return {
        ...prev,
        [quizId]: {
          ...previousParams,
          [name]: value,
          quizId,
        },
      };
    });
  };

  if (!quizzes.length) {
    return (
      <div className="rounded-lg border border-neutral-200 p-6 text-center text-neutral-700">
        {t("adminCourseView.statistics.empty.noQuizzes")}
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="flex flex-col gap-3">
      {quizzes.map((quiz) => {
        const attempts = attemptsByQuizId.get(quiz.id) ?? 0;
        const searchParams = quizSearchParamsById[quiz.id] ?? {
          quizId: quiz.id,
          sort: "-quizScore",
        };

        return (
          <AccordionItem
            key={quiz.id}
            value={quiz.id}
            className="border border-neutral-200 rounded-lg px-3"
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex w-full items-center justify-between gap-4 text-left">
                <div className="body-base-md font-semibold text-neutral-900">{quiz.title}</div>
                <div className="body-sm text-neutral-700">
                  {t("adminCourseView.statistics.field.attempts")}: {attempts}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <CourseStudentsQuizResultsTable
                course={course}
                searchParams={searchParams}
                onFilterChange={(name, value) => handleFilterChange(quiz.id, name, value)}
              />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
