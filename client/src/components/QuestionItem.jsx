import { CheckCircle, XCircle, MinusCircle } from 'lucide-react';

export const QuestionBadges = ({ q }) => {
  const badges = [];
  if (q.isBonusQuestion) badges.push({ text: 'Bonus', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' });
  if (q.isOptional) badges.push({ text: 'Optional', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' });
  if (q.allowMultipleCorrect) badges.push({ text: 'Multi-Correct', bg: 'bg-teal-500/20 text-teal-400 border-teal-500/30' });
  if (q.marksWeight !== undefined && q.marksWeight !== 1) badges.push({ text: `${q.marksWeight} Mark${q.marksWeight > 1 ? 's' : ''}`, bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' });
  
  if (badges.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {badges.map((b, i) => (
        <span key={i} className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full border ${b.bg}`}>
          {b.text}
        </span>
      ))}
    </div>
  );
};

/**
 * QuestionItem - displays a single question with options during a quiz
 */
export default function QuestionItem({ question, index, selected, onSelect }) {
  const isMulti = question.allowMultipleCorrect === true;
  const isDirectInput = question.questionType === 'integer' || question.questionType === 'text';

  // Parse selected answer list
  let selectedList = [];
  if (selected && !isDirectInput) {
    if (typeof selected === 'string') {
      try {
        selectedList = JSON.parse(selected);
        if (!Array.isArray(selectedList)) selectedList = [selected];
      } catch (e) {
        selectedList = [selected];
      }
    } else if (Array.isArray(selected)) {
      selectedList = selected;
    }
  }

  const handleOptionClick = (option) => {
    if (isMulti) {
      const newList = selectedList.includes(option)
        ? selectedList.filter(o => o !== option)
        : [...selectedList, option];
      onSelect(newList.length > 0 ? JSON.stringify(newList) : null);
    } else {
      onSelect(option);
    }
  };

  const hasSelections = isDirectInput
    ? (selected !== undefined && selected !== null && String(selected).trim() !== '')
    : (isMulti ? selectedList.length > 0 : !!selected);

  return (
    <div className="card animate-slide-up">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold border border-primary-500/30">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 font-medium leading-relaxed">{question.questionText}</p>
          <QuestionBadges q={question} />
        </div>
      </div>

      {/* Image Preview */}
      {question.imageUrl && (
        <div className="pl-11 mb-4">
          <div className="max-w-md rounded-xl overflow-hidden border border-slate-700 bg-slate-800/40 p-2">
            <img 
              src={question.imageUrl} 
              alt={`Diagram for Question ${index + 1}`} 
              className="max-h-64 md:max-h-80 w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {isDirectInput ? (
        <div className="pl-11 pr-4 space-y-2">
          <input
            type={question.questionType === 'integer' ? 'number' : 'text'}
            className="input text-sm w-full max-w-md"
            placeholder={question.questionType === 'integer' ? 'Enter numerical value...' : 'Enter your answer...'}
            value={selected || ''}
            onChange={e => onSelect(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-3 pl-11">
          {question.options.map((option, i) => {
            const isSelected = isMulti ? selectedList.includes(option) : selected === option;
            return (
              <label
                key={i}
                className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-300 ${
                  isSelected
                    ? 'bg-slate-900 text-accent-500 shadow-nm-inset'
                    : 'bg-slate-800 text-slate-300 shadow-nm-extruded-sm hover:-translate-y-[0.5px] hover:shadow-nm-extruded'
                }`}
              >
                <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isMulti ? 'rounded' : 'rounded-full'
                } ${
                  isSelected ? 'bg-accent-500 shadow-nm-inset-sm text-white' : 'bg-slate-900 shadow-nm-inset-sm'
                }`}>
                  {isSelected && (
                    isMulti ? (
                      <div className="w-1.5 h-1.5 bg-white rounded-sm" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )
                  )}
                </div>
                <input
                  type={isMulti ? 'checkbox' : 'radio'}
                  name={`question-${question._id}`}
                  value={option}
                  checked={isSelected}
                  onChange={() => handleOptionClick(option)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{option}</span>
              </label>
            );
          })}
        </div>
      )}

      {hasSelections && (
        <div className="mt-4 pl-11 flex justify-start">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors underline font-medium"
          >
            Clear Response
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * QuestionReview - shows a question after submission with correct/wrong highlighting
 */
export function QuestionReview({ answer, index }) {
  const isCorrect = answer.isCorrect;
  const isBonus = answer.isBonusQuestion === true;

  const parseValue = (val) => {
    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.join(', ');
      } catch (e) {}
    }
    return val;
  };

  const formattedCorrect = parseValue(answer.correctAnswer);
  const formattedSelected = parseValue(answer.selectedAnswer);
  const wasSkipped = !answer.selectedAnswer || answer.selectedAnswer === '' || answer.selectedAnswer === '[]';

  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-4">
        <span className={`flex-shrink-0 w-8 h-8 rounded-full shadow-nm-inset-sm bg-slate-900 flex items-center justify-center ${
          isCorrect ? 'text-accent-secondary' : 'text-red-400'
        }`}>
          {isCorrect
            ? <CheckCircle className="w-4 h-4" />
            : wasSkipped ? <MinusCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
          }
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 font-medium leading-relaxed">{answer.questionText}</p>
          <QuestionBadges q={answer} />
        </div>
      </div>

      {/* Image Preview in Review */}
      {answer.imageUrl && (
        <div className="pl-11 mb-4">
          <div className="max-w-md rounded-xl overflow-hidden border border-slate-700 bg-slate-800/40 p-2">
            <img 
              src={answer.imageUrl} 
              alt={`Diagram for Question ${index + 1}`} 
              className="max-h-64 md:max-h-80 w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="space-y-2 pl-11">
        {/* Correct answer */}
        {!isBonus && answer.correctAnswer && (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge-correct">✓ Correct</span>
            <span className="text-slate-300">{formattedCorrect}</span>
          </div>
        )}

        {/* Student's answer */}
        {!isBonus && !wasSkipped && (
          <div className="flex items-center gap-2 text-sm">
            <span className={isCorrect ? 'badge-correct' : 'badge-wrong'}>
              {isCorrect ? '✓ Your answer' : '✗ Your answer'}
            </span>
            <span className={isCorrect ? 'text-emerald-300' : 'text-red-300'}>{formattedSelected}</span>
          </div>
        )}
        {!isBonus && wasSkipped && (
          <div className="flex items-center gap-2 text-sm">
            <span className="badge-skipped">— Skipped</span>
          </div>
        )}

        {/* Bonus indicator */}
        {isBonus && (
          <div className="flex items-center gap-2 text-sm text-purple-400">
            <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-[10px] uppercase font-bold tracking-wide rounded">Auto-Awarded</span>
            <span>Full marks awarded (Bonus Question)</span>
          </div>
        )}

        {/* Explanation Text */}
        {answer.explanationText && (
          <div className="mt-4 p-4 bg-slate-900 shadow-nm-inset-sm rounded-2xl text-xs text-slate-400 leading-relaxed">
            <span className="block font-semibold text-slate-300 mb-1">Explanation:</span>
            {answer.explanationText}
          </div>
        )}
      </div>
    </div>
  );
}
