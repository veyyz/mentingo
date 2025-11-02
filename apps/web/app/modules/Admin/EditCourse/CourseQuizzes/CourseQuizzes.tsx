import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";

import { mapQuestionTypeToLabel } from "~/modules/Admin/EditCourse/CourseLessons/CourseLessons.helpers";

import type { Question } from "../CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";
import type { Chapter, Lesson } from "../EditCourse.types";
import { LessonType } from "../EditCourse.types";

type CourseQuizzesProps = {
  chapters?: Chapter[];
};

type QuizLesson = {
  id: string;
  title: Lesson["title"];
  description?: Lesson["description"];
  chapterTitle: Chapter["title"];
  attemptsLimit?: Lesson["attemptsLimit"];
  thresholdScore?: Lesson["thresholdScore"];
  quizCooldownInHours?: Lesson["quizCooldownInHours"];
  questions: Question[];
};

export const CourseQuizzes = ({ chapters }: CourseQuizzesProps) => {
  const { t } = useTranslation();

  const quizzes = useMemo<QuizLesson[]>(() => {
    if (!chapters) return [];

    return chapters.flatMap((chapter) =>
      (chapter.lessons ?? [])
        .filter((lesson) => lesson.type === LessonType.QUIZ)
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description,
          chapterTitle: chapter.title,
          attemptsLimit: lesson.attemptsLimit,
          thresholdScore: lesson.thresholdScore,
          quizCooldownInHours: lesson.quizCooldownInHours,
          questions: lesson.questions ?? [],
        })),
    );
  }, [chapters]);

  if (!quizzes.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-neutral-200 bg-white p-12 text-center shadow-md">
        <p className="body-base-md text-neutral-500">{t("adminCourseView.quizzes.empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-md">
      <Accordion type="multiple" className="w-full">
        {quizzes.map((quiz) => {
          const quizTitle = quiz.title || t("adminCourseView.settings.sideSection.other.untitled");
          const questionCountLabel = t("adminCourseView.quizzes.details.questionCount", {
            count: quiz.questions.length,
          });

          return (
            <AccordionItem
              key={quiz.id}
              value={quiz.id}
              className="border-b border-neutral-200 last:border-b-0"
            >
              <AccordionTrigger className="py-4">
                <div className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="body-base-md text-neutral-950">{quizTitle}</p>
                    <p className="body-sm text-neutral-600">
                      {t("adminCourseView.quizzes.chapterLabel", { chapter: quiz.chapterTitle })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge outline className="text-xs text-neutral-700">
                      {questionCountLabel}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-6 border-t border-neutral-200 pt-4">
                <div className="space-y-3">
                  <p className="body-sm-md text-neutral-950">
                    {t("adminCourseView.quizzes.details.overview")}
                  </p>
                  <dl className="grid gap-2 text-sm text-neutral-700">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="font-medium text-neutral-900">
                        {t("adminCourseView.quizzes.details.passingScoreLabel")}
                      </dt>
                      <dd>
                        {typeof quiz.thresholdScore === "number"
                          ? t("adminCourseView.quizzes.details.passingScore", {
                              score: quiz.thresholdScore,
                            })
                          : t("adminCourseView.quizzes.details.noPassingScore")}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="font-medium text-neutral-900">
                        {t("adminCourseView.quizzes.details.attemptsLimitLabel")}
                      </dt>
                      <dd>
                        {typeof quiz.attemptsLimit === "number"
                          ? t("adminCourseView.quizzes.details.attemptsLimit", {
                              count: quiz.attemptsLimit,
                            })
                          : t("adminCourseView.quizzes.details.noAttemptsLimit")}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="font-medium text-neutral-900">
                        {t("adminCourseView.quizzes.details.cooldownLabel")}
                      </dt>
                      <dd>
                        {typeof quiz.quizCooldownInHours === "number" &&
                        quiz.quizCooldownInHours > 0
                          ? t("adminCourseView.quizzes.details.cooldown", {
                              hours: quiz.quizCooldownInHours,
                            })
                          : t("adminCourseView.quizzes.details.noCooldown")}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-2">
                  <p className="body-sm-md text-neutral-950">
                    {t("adminCourseView.quizzes.details.descriptionHeader")}
                  </p>
                  <p className="text-sm text-neutral-700">
                    {quiz.description?.trim()
                      ? quiz.description
                      : t("adminCourseView.quizzes.details.noDescription")}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="body-sm-md text-neutral-950">
                    {t("adminCourseView.quizzes.details.questionsHeader")}
                  </p>
                  {quiz.questions.length ? (
                    <ul className="space-y-2">
                      {quiz.questions.map((question) => (
                        <li
                          key={question.id ?? question.title}
                          className="text-sm text-neutral-700"
                        >
                          <span className="font-medium text-neutral-900">{question.title}</span>
                          {question.type ? (
                            <span className="text-neutral-500">
                              {" · "}
                              {t(mapQuestionTypeToLabel(question.type))}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-700">
                      {t("adminCourseView.quizzes.details.noQuestions")}
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default CourseQuizzes;
