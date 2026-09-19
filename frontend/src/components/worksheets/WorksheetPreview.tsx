import type { Ref } from "react";
import Card from "@/components/ui/Card";
import { COLORS, TYPOGRAPHY } from "@/constants";
import { curriculum } from "@/lib/worksheets/mock-data";
import type { Worksheet } from "@/lib/worksheets/types";

type WorksheetPreviewProps = {
  worksheet: Worksheet;
  headingRef?: Ref<HTMLHeadingElement>;
};

export default function WorksheetPreview({ worksheet, headingRef }: WorksheetPreviewProps) {
  const { config, questions } = worksheet;
  const selectedClass = curriculum.find((item) => item.id === config.classId);
  const subject = selectedClass?.subjects.find((item) => item.id === config.subjectId);
  const topic = subject?.topics.find((item) => item.id === config.topicId);

  return (
    <section aria-labelledby="worksheet-preview-title">
      <Card>
        <h2
          id="worksheet-preview-title"
          ref={headingRef}
          tabIndex={-1}
          className={`scroll-mt-6 ${TYPOGRAPHY.sectionTitle}`}
        >
          Worksheet Preview
        </h2>
        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className={COLORS.text.secondary}>Class</dt>
            <dd className="font-semibold">{selectedClass?.label ?? config.classId}</dd>
          </div>
          <div>
            <dt className={COLORS.text.secondary}>Subject</dt>
            <dd className="font-semibold">{subject?.label ?? config.subjectId}</dd>
          </div>
          <div>
            <dt className={COLORS.text.secondary}>Topic</dt>
            <dd className="font-semibold">{topic?.label ?? config.topicId}</dd>
          </div>
          <div>
            <dt className={COLORS.text.secondary}>Difficulty</dt>
            <dd className="font-semibold capitalize">{config.difficulty}</dd>
          </div>
          <div>
            <dt className={COLORS.text.secondary}>Question Count</dt>
            <dd className="font-semibold">{config.questionCount}</dd>
          </div>
        </dl>
        <h3 className="mt-8 text-xl font-bold">Questions</h3>
        <ol className={`mt-4 list-decimal space-y-4 pl-6 ${TYPOGRAPHY.body}`}>
          {questions.map((question) => (
            <li key={question.id} className="pl-2 break-words">{question.prompt}</li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
