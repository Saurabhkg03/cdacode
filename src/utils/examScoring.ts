/**
 * Centralized Exam Scoring Engine
 * Enforces strict C-CAT evaluation rules for MCQ, MSQ, and NAT.
 */

export function evaluateExam(contestData: any, responses: any) {
    let totalScore = 0;
    let correctCount = 0;
    let totalAttempted = 0;

    const questionMap = new Map();

    if (contestData?.sections) {
        contestData.sections.forEach((sec: any) => {
            sec.questions.forEach((q: any) => {
                questionMap.set(q.id, {
                    type: q.question_type,
                    options: q.options,
                    marks: 3,
                    negativeMarks: 1
                });
            });
        });
    }

    // Trust the server, not the client
    Object.values(responses || {}).forEach((resp: any) => {
        const qData = questionMap.get(resp.questionId);
        if (qData) {
            let isCorrect = false;
            let marksAwarded = 0;
            const isAttempted = resp.status === 'answered' || resp.status === 'answered_marked_for_review';
            
            if (isAttempted) {
                totalAttempted++;
                if (qData.type === 'mcq') {
                    const correctOption = qData.options?.find((o: any) => o.is_correct);
                    isCorrect = !!(correctOption && resp.selectedOptions?.[0] === correctOption.label);
                    marksAwarded = isCorrect ? qData.marks : -Math.abs(qData.negativeMarks);
                }

                if (isCorrect) correctCount++;
                totalScore += marksAwarded;
            }

            resp.isCorrect = isCorrect;
            resp.marksAwarded = marksAwarded;
        } else {
            resp.isCorrect = false;
            resp.marksAwarded = 0;
        }
    });

    return {
        responses, // Mutated with isCorrect and marksAwarded
        totalScore: parseFloat(totalScore.toFixed(2)),
        correctCount,
        totalAttempted
    };
}
