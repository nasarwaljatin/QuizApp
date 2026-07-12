import { CheckCircle, XCircle, MinusCircle } from 'lucide-react';

/**
 * QuestionItem - displays a single question with radio options during a quiz
 */
export default function QuestionItem({ question, index, selected, onSelect }) {
  return (
    <div className="card animate-slide-up">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold border border-primary-500/30">
          {index + 1}
        </span>
        <p className="text-slate-100 font-medium leading-relaxed">{question.questionText}</p>
      </div>

      <div className="space-y-3 pl-11">
        {question.options.map((option, i) => {
          const isSelected = selected === option;
          return (
            <label
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                isSelected
                  ? 'bg-primary-500/20 border-primary-500/60 text-primary-300'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                isSelected ? 'border-primary-400 bg-primary-400' : 'border-slate-600'
              }`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <input
                type="radio"
                name={`question-${question._id}`}
                value={option}
                checked={isSelected}
                onChange={() => onSelect(option)}
                className="sr-only"
              />
              <span className="text-sm">{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * QuestionReview - shows a question after submission with correct/wrong highlighting
 */
export function QuestionReview({ answer, index }) {
  const isCorrect = answer.isCorrect;
  const wasSkipped = !answer.selectedAnswer || answer.selectedAnswer === '';

  return (
    <div className={`card border ${isCorrect ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
      <div className="flex items-start gap-3 mb-4">
        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {isCorrect
            ? <CheckCircle className="w-5 h-5" />
            : wasSkipped ? <MinusCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
          }
        </span>
        <p className="text-slate-100 font-medium leading-relaxed">{answer.questionText}</p>
      </div>

      <div className="space-y-2 pl-11">
        {/* Correct answer */}
        <div className="flex items-center gap-2 text-sm">
          <span className="badge-correct">✓ Correct</span>
          <span className="text-slate-300">{answer.correctAnswer}</span>
        </div>

        {/* Student's answer */}
        {!wasSkipped && (
          <div className="flex items-center gap-2 text-sm">
            <span className={isCorrect ? 'badge-correct' : 'badge-wrong'}>
              {isCorrect ? '✓ Your answer' : '✗ Your answer'}
            </span>
            <span className={isCorrect ? 'text-emerald-300' : 'text-red-300'}>{answer.selectedAnswer}</span>
          </div>
        )}
        {wasSkipped && (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge-skipped">— Skipped</span>
          </div>
        )}
      </div>
    </div>
  );
}
