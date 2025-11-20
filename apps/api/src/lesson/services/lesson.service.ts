import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { and, desc, eq, sql } from "drizzle-orm";
import { isNumber } from "lodash";

import { AiService } from "src/ai/services/ai.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { DatabasePg } from "src/common";
import { QuizCompletedEvent } from "src/events";
import { FileService } from "src/file/file.service";
import { QuestionRepository } from "src/questions/question.repository";
import { QuestionService } from "src/questions/question.service";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";
import { isQuizAccessAllowed } from "src/utils/isQuizAccessAllowed";

import { LESSON_TYPES } from "../lesson.type";
import { LessonRepository } from "../repositories/lesson.repository";

import type {
  AnswerQuestionBody,
  EnrolledLesson,
  EnrolledLessonsFilters,
  LessonShow,
  QuestionBody,
  QuestionDetails,
} from "../lesson.schema";
import type { SupportedLanguages } from "src/ai/utils/ai.type";
import type { UUIDType } from "src/common";
import { questions, quizAttempts, studentQuestionAnswers } from "src/storage/schema";

@Injectable()
export class LessonService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly lessonRepository: LessonRepository,
    private readonly questionService: QuestionService,
    private readonly questionRepository: QuestionRepository,
    private readonly fileService: FileService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly aiService: AiService,
    private readonly eventBus: EventBus,
  ) {}

  async getLessonById(
    id: UUIDType,
    userId: UUIDType,
    userRole: UserRole,
    userLanguage?: SupportedLanguages,
  ): Promise<LessonShow> {
    const isStudent = userRole === USER_ROLES.STUDENT;

    const lesson = await this.lessonRepository.getLessonDetails(id, userId);

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (isStudent && !lesson.isFreemium && !lesson.isEnrolled)
      throw new UnauthorizedException("You don't have access");

    if (lesson.type === LESSON_TYPES.TEXT && !lesson.fileUrl) return lesson;

    if (
      lesson.type === LESSON_TYPES.QUIZ ||
      lesson.type === LESSON_TYPES.VIDEO ||
      lesson.type === LESSON_TYPES.AI_MENTOR
    ) {
      await this.studentLessonProgressService.markLessonAsStarted(lesson.id, userId, userRole);
    }

    if (
      lesson.type !== LESSON_TYPES.QUIZ &&
      lesson.type !== LESSON_TYPES.AI_MENTOR &&
      lesson.type !== LESSON_TYPES.EMBED
    ) {
      if (!lesson.fileUrl) throw new NotFoundException("Lesson file not found");

      if (lesson.fileUrl.startsWith("https://")) return lesson;

      try {
        const signedUrl = await this.fileService.getFileUrl(lesson.fileUrl);
        return { ...lesson, fileUrl: signedUrl };
      } catch (error) {
        console.error(`Failed to get signed URL for ${lesson.fileUrl}:`, error);
        throw new NotFoundException("Lesson file not found");
      }
    }

    if (lesson.type === LESSON_TYPES.AI_MENTOR) {
      const { data: thread } = await this.aiService.getThreadWithSetup({
        lessonId: id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: userLanguage ?? "en",
        userId,
      });

      return {
        ...lesson,
        threadId: thread.id,
        userLanguage: thread.userLanguage,
        status: thread.status,
      };
    }

    if (lesson.type === LESSON_TYPES.EMBED) {
      const lessonResources = await this.lessonRepository.getLessonResources(lesson.id);

      return { ...lesson, lessonResources: lessonResources };
    }

    const questionList = await this.questionRepository.getQuestionsForLesson(
      lesson.id,
      lesson.lessonCompleted,
      userId,
    );

    const questionListWithUrls: QuestionBody[] = await Promise.all(
      questionList.map(async (question) => {
        if (!question.photoS3Key) return question;

        try {
          const signedUrl = await this.fileService.getFileUrl(question.photoS3Key);

          return { ...question, photoS3Key: signedUrl };
        } catch (error) {
          console.error(`Failed to get signed URL for ${question.photoS3Key}:`, error);
          return question;
        }
      }),
    );

    if (lesson.lessonCompleted && isNumber(lesson.quizScore)) {
      const [quizResult] = await this.lessonRepository.getQuizResult(
        lesson.id,
        lesson.quizScore,
        userId,
      );

      const quizDetails: QuestionDetails = {
        questions: questionListWithUrls,
        questionCount: questionListWithUrls.length,
        score: quizResult?.score ?? 0,
        correctAnswerCount: quizResult?.correctAnswerCount ?? 0,
        wrongAnswerCount: quizResult?.wrongAnswerCount ?? 0,
      };

      return { ...lesson, quizDetails };
    }

    const quizDetails = {
      questions: questionListWithUrls,
      questionCount: questionListWithUrls.length,
      score: null,
      correctAnswerCount: null,
      wrongAnswerCount: null,
    };

    return { ...lesson, quizDetails };
  }

  async evaluationQuiz(
    studentQuizAnswers: AnswerQuestionBody,
    userId: UUIDType,
  ): Promise<{
    correctAnswerCount: number;
    wrongAnswerCount: number;
    questionCount: number;
    score: number;
  }> {
    const [accessCourseLessonWithDetails] = await this.lessonRepository.checkLessonAssignment(
      studentQuizAnswers.lessonId,
      userId,
    );

    if (accessCourseLessonWithDetails.lessonIsCompleted) {
      throw new ConflictException("You have already answered this quiz");
    }

    if (!accessCourseLessonWithDetails.isAssigned && !accessCourseLessonWithDetails.isFreemium)
      throw new UnauthorizedException("You don't have assignment to this lesson");

    const quizSettings = await this.lessonRepository.getLessonSettings(studentQuizAnswers.lessonId);

    const correctAnswersForQuizQuestions =
      await this.questionRepository.getQuizQuestionsToEvaluation(studentQuizAnswers.lessonId);

    if (correctAnswersForQuizQuestions.length !== studentQuizAnswers.questionsAnswers.length) {
      throw new ConflictException("Quiz is not completed");
    }

    return await this.db.transaction(async (trx) => {
      try {
        const evaluationResult = await this.questionService.evaluationsQuestions(
          correctAnswersForQuizQuestions,
          studentQuizAnswers,
          userId,
          trx,
        );

        const requiredCorrect = Math.ceil(
          ((quizSettings?.thresholdScore ?? 0) *
            (evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount)) /
            100,
        );

        const quizScore = Math.floor(
          (evaluationResult.correctAnswerCount /
            (evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount)) *
            100,
        );

        const isQuizPassed = quizSettings?.thresholdScore
          ? requiredCorrect <= evaluationResult.correctAnswerCount
          : true;

        await this.studentLessonProgressService.updateQuizProgress(
          accessCourseLessonWithDetails.chapterId,
          studentQuizAnswers.lessonId,
          userId,
          evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount,
          quizScore,
          accessCourseLessonWithDetails.attempts ?? 1,
          isQuizPassed,
          true,
          trx,
        );

        await this.studentLessonProgressService.markLessonAsCompleted({
          id: studentQuizAnswers.lessonId,
          studentId: userId,
          quizCompleted: isQuizPassed,
          completedQuestionCount:
            evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount,
          dbInstance: trx,
        });

        this.eventBus.publish(
          new QuizCompletedEvent(
            userId,
            accessCourseLessonWithDetails.courseId,
            studentQuizAnswers.lessonId,
            evaluationResult.correctAnswerCount,
            evaluationResult.wrongAnswerCount,
            quizScore,
          ),
        );

        return {
          correctAnswerCount: evaluationResult.correctAnswerCount,
          wrongAnswerCount: evaluationResult.wrongAnswerCount,
          questionCount: evaluationResult.wrongAnswerCount + evaluationResult.correctAnswerCount,
          score: quizScore,
        };
      } catch (error) {
        throw new ConflictException(
          "Quiz evaluation failed, problem with question: " +
            error?.message +
            " problem is: " +
            error?.response?.error,
        );
      }
    });
  }

  async manualQuizGrade(
    lessonId: UUIDType,
    studentId: UUIDType,
    evaluations: { questionId: UUIDType; isCorrect: boolean }[],
  ) {
    const [accessCourseLessonWithDetails] = await this.lessonRepository.checkLessonAssignment(
      lessonId,
      studentId,
    );

    if (!accessCourseLessonWithDetails.lessonIsCompleted) {
      throw new ConflictException("Student has not completed this lesson");
    }

    const lessonQuestions = await this.questionRepository.getQuizQuestionsToEvaluation(lessonId);
    const evaluableQuestionIds = lessonQuestions.map((question) => question.id);

    const invalidQuestionIds = evaluations
      .map((evaluation) => evaluation.questionId)
      .filter((questionId) => !evaluableQuestionIds.includes(questionId));

    if (invalidQuestionIds.length > 0) {
      throw new ConflictException("Only questions that belong to this lesson can be graded manually");
    }

    const quizSettings = await this.lessonRepository.getLessonSettings(lessonId);
    const completedQuestionCount = lessonQuestions.length;

    const evaluationMap = evaluations.reduce<Record<UUIDType, boolean>>((map, evaluation) => {
      map[evaluation.questionId] = evaluation.isCorrect;
      return map;
    }, {} as Record<UUIDType, boolean>);

    const questionIdsToUpdate = Object.keys(evaluationMap);

    return await this.db.transaction(async (trx) => {
      if (questionIdsToUpdate.length > 0) {
        for (const questionId of questionIdsToUpdate) {
          await trx
            .update(studentQuestionAnswers)
            .set({ isCorrect: evaluationMap[questionId as UUIDType] })
            .where(
              and(
                eq(studentQuestionAnswers.studentId, studentId),
                eq(studentQuestionAnswers.questionId, questionId as UUIDType),
              ),
            );
        }
      }

      const [currentStats] = await trx
        .select({
          correctAnswerCount: sql<number>`COALESCE(SUM(CASE WHEN ${studentQuestionAnswers.isCorrect} THEN 1 ELSE 0 END), 0)::INTEGER`,
          questionCount: sql<number>`COUNT(*)::INTEGER`,
        })
        .from(studentQuestionAnswers)
        .innerJoin(questions, eq(questions.id, studentQuestionAnswers.questionId))
        .where(and(eq(studentQuestionAnswers.studentId, studentId), eq(questions.lessonId, lessonId)));

      const correctAnswerCount = currentStats?.correctAnswerCount ?? 0;
      const questionCount = currentStats?.questionCount ?? completedQuestionCount;
      const wrongAnswerCount = Math.max(questionCount - correctAnswerCount, 0);
      const score = questionCount ? Math.floor((correctAnswerCount / questionCount) * 100) : 0;

      const requiredCorrect = Math.ceil(((quizSettings?.thresholdScore ?? 0) * questionCount) / 100);
      const isQuizPassed = quizSettings?.thresholdScore
        ? requiredCorrect <= correctAnswerCount
        : true;

      await this.studentLessonProgressService.updateQuizProgress(
        accessCourseLessonWithDetails.chapterId,
        lessonId,
        studentId,
        questionCount,
        score,
        accessCourseLessonWithDetails.attempts ?? 1,
        isQuizPassed,
        true,
        trx,
      );

      const [latestAttempt] = await trx
        .select({ id: quizAttempts.id })
        .from(quizAttempts)
        .where(and(eq(quizAttempts.lessonId, lessonId), eq(quizAttempts.userId, studentId)))
        .orderBy(desc(quizAttempts.createdAt))
        .limit(1);

      if (latestAttempt) {
        await trx
          .update(quizAttempts)
          .set({
            correctAnswers: correctAnswerCount,
            wrongAnswers: wrongAnswerCount,
            score,
          })
          .where(eq(quizAttempts.id, latestAttempt.id));
      } else {
        await trx.insert(quizAttempts).values({
          userId: studentId,
          courseId: accessCourseLessonWithDetails.courseId,
          lessonId,
          correctAnswers: correctAnswerCount,
          wrongAnswers: wrongAnswerCount,
          score,
        });
      }

      return {
        correctAnswerCount,
        wrongAnswerCount,
        questionCount,
        score,
      };
    });
  }

  async deleteStudentQuizAnswers(lessonId: UUIDType, userId: UUIDType): Promise<void> {
    const [accessCourseLessonWithDetails] = await this.lessonRepository.checkLessonAssignment(
      lessonId,
      userId,
    );

    if (!accessCourseLessonWithDetails.lessonIsCompleted) {
      throw new ConflictException("You have not answered this quiz yet");
    }

    const quizSettings = await this.lessonRepository.getLessonSettings(lessonId);

    let attempts = accessCourseLessonWithDetails.attempts ?? 1;

    if (
      !isQuizAccessAllowed(
        attempts,
        quizSettings?.attemptsLimit,
        accessCourseLessonWithDetails.updatedAt,
        quizSettings?.quizCooldownInHours,
      )
    ) {
      throw new ConflictException(
        "Quiz answers cannot be deleted due to attempts limit or cooldown",
      );
    }

    attempts += 1;

    const questions = await this.questionRepository.getQuestionsIdsByLessonId(lessonId);

    if (questions.length === 0) {
      return;
    }

    return await this.db.transaction(async (trx) => {
      try {
        await this.questionRepository.deleteStudentQuizAnswers(questions, userId, trx);

        await this.studentLessonProgressService.updateQuizProgress(
          accessCourseLessonWithDetails.chapterId,
          lessonId,
          userId,
          0,
          0,
          attempts,
          false,
          false,
          trx,
        );
      } catch (error) {
        throw new ConflictException(`Failed to delete student quiz answers: ${error.message}`);
      }
    });
  }

  async getEnrolledLessons(
    userId: UUIDType,
    filters: EnrolledLessonsFilters,
  ): Promise<EnrolledLesson[]> {
    return await this.lessonRepository.getEnrolledLessons(userId, filters);
  }

  // async studentAnswerOnQuestion(
  //   questionId: UUIDType,
  //   studentId: UUIDType,
  //   isCorrect: boolean,
  //   trx?: PostgresJsDatabase<typeof schema>,
  // ) {
  //   await this.db.insert(studentQuestionAnswers).values({
  //     questionId,
  //     studentId,
  //     answer: isCorrect,
  //   });
  // }

  // async clearQuizProgress(courseId: UUIDType, lessonId: UUIDType, userId: UUIDType) {
  //   const [accessCourseLessons] = await this.chapterRepository.checkLessonAssignment(
  //     courseId,
  //     lessonId,
  //     userId,
  //   );

  //   if (!accessCourseLessons)
  //     throw new UnauthorizedException("You don't have assignment to this lesson");

  //   const quizProgress = await this.chapterRepository.lessonProgress(
  //     courseId,
  //     lessonId,
  //     userId,
  //     true,
  //   );

  //   if (!quizProgress) throw new NotFoundException("Lesson progress not found");

  //   try {
  //     return await this.db.transaction(async (trx) => {
  //       const questionIds = await this.chapterRepository.getQuestionsIdsByLessonId(lessonId);

  //       await this.chapterRepository.retireQuizProgress(courseId, lessonId, userId, trx);

  //       await this.chapterRepository.removeQuestionsAnswer(
  //         courseId,
  //         lessonId,
  //         questionIds,
  //         userId,
  //         trx,
  //       );

  //       await this.chapterRepository.removeStudentCompletedLessonItems(
  //         courseId,
  //         lessonId,
  //         userId,
  //         trx,
  //       );

  //       return true;
  //     });
  //   } catch (error) {
  //     return false;
  //   }
  // }
}
