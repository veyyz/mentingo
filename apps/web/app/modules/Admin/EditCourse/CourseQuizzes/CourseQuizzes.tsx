import { useTranslation } from "react-i18next";

import { useCourseQuizResults } from "~/api/queries/admin/useCourseQuizResults";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type CourseQuizzesProps = {
  courseId?: string;
};

export const CourseQuizzes = ({ courseId }: CourseQuizzesProps) => {
  const { t } = useTranslation();
  const { data: quizzes = [], isLoading } = useCourseQuizResults(courseId);

  if (!courseId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-32 animate-spin rounded-full border-b-2 border-t-2 border-gray-900" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-32 animate-spin rounded-full border-b-2 border-t-2 border-gray-900" />
      </div>
    );
  }

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
          const quizTitle =
            quiz.quizTitle || t("adminCourseView.settings.sideSection.other.untitled");
          const responsesLabel = t("adminCourseView.quizzes.details.responsesCount", {
            count: quiz.responsesCount,
          });

          return (
            <AccordionItem
              key={quiz.quizId}
              value={quiz.quizId}
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
                      {responsesLabel}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 border-t border-neutral-200 pt-4">
                <div className="space-y-3">
                  <p className="body-sm-md text-neutral-950">
                    {t("adminCourseView.quizzes.details.responsesHeader")}
                  </p>
                  {quiz.scores.length ? (
                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              {t("adminCourseView.quizzes.details.table.student")}
                            </TableHead>
                            <TableHead className="text-right">
                              {t("adminCourseView.quizzes.details.table.score")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quiz.scores.map((score) => (
                            <TableRow key={`${quiz.quizId}-${score.studentId}`}>
                              <TableCell className="text-neutral-950">
                                {score.studentName}
                              </TableCell>
                              <TableCell className="text-right text-neutral-900">
                                {t("adminCourseView.quizzes.details.scoreValue", {
                                  score: score.score,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-700">
                      {t("adminCourseView.quizzes.details.noResponses")}
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
