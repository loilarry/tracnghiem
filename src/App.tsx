import { useMemo, useState } from "react";
import { datasetVersion, questions, verifiedQuestions } from "./data/questions";
import {
  clearProgress,
  loadProgress,
  progressFor,
  reviewIds,
  saveProgress,
  startSession,
  submitAnswer,
} from "./features/progress/progressStore";
import type { AnswerFeedback, PersistedProgress, QuizMode, QuizQuestion } from "./types";

type Session = NonNullable<PersistedProgress["activeSession"]>;

function Icon({ name, size = 21 }: { name: "all" | "review" | "check" | "arrow" | "empty" | "reset"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "all") return <svg {...common}><path d="M5 5h2M11 5h8M5 12h2M11 12h8M5 19h2M11 19h8" /><circle cx="3.5" cy="5" r=".7" fill="currentColor" /><circle cx="3.5" cy="12" r=".7" fill="currentColor" /><circle cx="3.5" cy="19" r=".7" fill="currentColor" /></svg>;
  if (name === "review") return <svg {...common}><path d="M6 4.5h12v16l-6-3.6-6 3.6z" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12.5 4.3 4.2L19 7" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
  if (name === "reset") return <svg {...common}><path d="M4 7v5h5" /><path d="M5.2 12a7 7 0 1 0 2-5" /></svg>;
  return <svg {...common}><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" /><path d="M9 19v2h6v-2" /></svg>;
}

function Sidebar({ mode, reviewCount, onModeChange, onReset }: { mode: QuizMode; reviewCount: number; onModeChange: (mode: QuizMode) => void; onReset: () => void }) {
  return (
    <aside className="sidebar" aria-label="Điều hướng bài thi">
      <div className="brand">
        <div className="brand-mark">Ô</div>
        <div>
          <p className="brand-name">Ôn thi</p>
          <p className="brand-subtitle">Bộ câu hỏi của bạn</p>
        </div>
      </div>
      <div className="sidebar-rule" />
      <nav className="mode-nav">
        <button className={`mode-item ${mode === "all" ? "is-active" : ""}`} onClick={() => onModeChange("all")} aria-current={mode === "all" ? "page" : undefined}>
          <Icon name="all" />
          <span>Tất cả câu hỏi</span>
          <strong>{verifiedQuestions.length}</strong>
        </button>
        <button className={`mode-item ${mode === "review" ? "is-active" : ""}`} onClick={() => onModeChange("review")} aria-current={mode === "review" ? "page" : undefined}>
          <Icon name="review" />
          <span>Câu cần ôn</span>
          <strong className={reviewCount ? "has-review" : ""}>{reviewCount}</strong>
        </button>
      </nav>
      <div className="sidebar-footer">
        <div className="status-dot" />
        <div>
          <span>Dữ liệu đã lưu trên máy này</span>
          <button className="reset-link" type="button" onClick={onReset}>Xóa tiến độ</button>
        </div>
      </div>
    </aside>
  );
}

function MobileModeSwitch({ mode, reviewCount, onModeChange, onReset }: { mode: QuizMode; reviewCount: number; onModeChange: (mode: QuizMode) => void; onReset: () => void }) {
  return (
    <div className="mobile-mode-switch" role="navigation" aria-label="Chọn chế độ">
      <button className={mode === "all" ? "is-active" : ""} onClick={() => onModeChange("all")} aria-current={mode === "all" ? "page" : undefined}>Tất cả <span>{verifiedQuestions.length}</span></button>
      <button className={mode === "review" ? "is-active" : ""} onClick={() => onModeChange("review")} aria-current={mode === "review" ? "page" : undefined}>Cần ôn <span className={reviewCount ? "has-review" : ""}>{reviewCount}</span></button>
      <button className="mobile-reset-link" type="button" onClick={onReset}>Xóa tiến độ</button>
    </div>
  );
}

function ProgressBar({ index, total }: { index: number; total: number }) {
  const shown = Math.min(index + 1, total);
  const percent = total ? Math.round((shown / total) * 100) : 0;
  return (
    <div className="progress-block" aria-label={`Đang ở câu ${shown} trên ${total}`}>
      <div className="progress-meta"><span>Câu hỏi {shown} / {total}</span><span>{percent}%</span></div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

export function QuestionCard({ question, feedback, selected, onSelect, onSubmit, onNext, disabled }: {
  question: QuizQuestion;
  feedback: AnswerFeedback | null;
  selected: string;
  onSelect: (id: QuizQuestion["options"][number]["id"]) => void;
  onSubmit: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  const correctOption = question.options.find((option) => option.id === question.correctOptionId);
  return (
    <section className="question-card" aria-labelledby="question-title">
      <div className="question-copy">
        <p className="question-kicker">Câu hỏi</p>
        <h1 id="question-title">{question.text}</h1>
        <fieldset className="options" disabled={Boolean(feedback) || disabled}>
          <legend className="sr-only">Chọn một đáp án</legend>
          {question.options.map((option) => {
            const isSelected = selected === option.id;
            const isCorrect = feedback && option.id === question.correctOptionId;
            const isWrong = feedback && isSelected && !feedback.correct;
            return (
              <label key={option.id} className={`option ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`}>
                <input type="radio" name={question.id} value={option.id} checked={isSelected} onChange={() => onSelect(option.id)} />
                <span className="option-marker">{option.id}</span>
                <span className="option-text">{option.text}</span>
                {isCorrect && <span className="option-check"><Icon name="check" size={17} /></span>}
              </label>
            );
          })}
        </fieldset>
        <div className="question-actions">
          {!feedback ? (
            <button className="primary-button" onClick={onSubmit} disabled={!selected || disabled}>Trả lời <Icon name="arrow" size={18} /></button>
          ) : (
            <button className="primary-button" onClick={onNext}>{disabled ? "Đã hoàn thành" : "Câu tiếp theo"} <Icon name="arrow" size={18} /></button>
          )}
        </div>
      </div>
      <aside className={`feedback-panel ${feedback ? (feedback.correct ? "is-correct" : "is-wrong") : "is-idle"}`} aria-live="polite">
        {feedback ? (
          <>
            <p className="feedback-label">Kết quả</p>
            <div className="feedback-state"><span className="feedback-icon"><Icon name={feedback.correct ? "check" : "review"} size={23} /></span><strong>{feedback.correct ? "Câu trả lời đúng" : "Chưa đúng lần này"}</strong></div>
            <p className="answer-line">Đáp án đúng: <b>{correctOption?.id}</b></p>
            {!feedback.correct && <p className="feedback-note">Câu này đã được ghi nhớ ở mục <b>Câu cần ôn</b>. Hãy quay lại để củng cố.</p>}
            {feedback.correct && <p className="feedback-note">Tốt lắm. Câu hỏi này không còn nằm trong hàng đợi ôn sai.</p>}
          </>
        ) : (
          <>
            <p className="feedback-label">Gợi ý</p>
            <div className="idle-state"><span className="idle-line" /><p>Chọn đáp án bạn cho là đúng, sau đó bấm <b>Trả lời</b>.</p></div>
          </>
        )}
        <div className="source-note">Nguồn: trang {question.source.printedPage ?? "—"} · câu {question.source.questionIndexOnPage}</div>
      </aside>
    </section>
  );
}

function EmptyReview({ onAll }: { onAll: () => void }) {
  return (
    <section className="empty-review" aria-live="polite">
      <div className="empty-illustration"><Icon name="empty" size={54} /></div>
      <p className="question-kicker">Hoàn thành</p>
      <h1>Bạn không còn câu nào cần ôn</h1>
      <p>Tuyệt vời. Những câu từng làm sai đã được trả lời đúng trở lại.</p>
      <button className="secondary-button" onClick={onAll}>Làm lại toàn bộ <Icon name="arrow" size={17} /></button>
    </section>
  );
}

function Summary({ mode, correct, total, reviewCount, onReview, onRestart }: { mode: QuizMode; correct: number; total: number; reviewCount: number; onReview: () => void; onRestart: () => void }) {
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return (
    <section className="summary-card" aria-live="polite">
      <div className="summary-mark"><Icon name="check" size={33} /></div>
      <p className="question-kicker">{mode === "review" ? "Vòng ôn đã xong" : "Lượt làm đã xong"}</p>
      <h1>{mode === "review" ? "Không còn câu sai cần khắc phục" : "Bạn đã hoàn thành lượt câu hỏi"}</h1>
      <div className="summary-stats"><div><strong>{correct}</strong><span>Đúng</span></div><div><strong>{total - correct}</strong><span>Sai lượt này</span></div><div><strong>{percent}%</strong><span>Kết quả</span></div></div>
      <p className="summary-note">{reviewCount ? `Hiện còn ${reviewCount} câu trong hàng đợi cần ôn.` : "Hàng đợi câu cần ôn hiện đang trống."}</p>
      <div className="summary-actions">
        {reviewCount > 0 && <button className="primary-button" onClick={onReview}>Ôn câu sai <Icon name="arrow" size={18} /></button>}
        <button className="secondary-button" onClick={onRestart}>Làm lại lượt này <Icon name="reset" size={17} /></button>
      </div>
    </section>
  );
}

export default function App() {
  const initialProgress = useMemo(() => loadProgress(), []);
  const [progress, setProgress] = useState<PersistedProgress>(initialProgress);
  const [mode, setMode] = useState<QuizMode>(initialProgress.activeSession?.mode ?? "all");
  const [session, setSession] = useState<Session>(() => initialProgress.activeSession ?? startSession(initialProgress, "all").activeSession!);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [complete, setComplete] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const reviewCount = reviewIds(progress).length;
  const currentQuestion = session.queue[session.currentIndex] ? questions.find((question) => question.id === session.queue[session.currentIndex]) : undefined;

  function persist(nextProgress: PersistedProgress, nextSession?: Session) {
    const withSession = { ...nextProgress, activeSession: nextSession };
    setProgress(withSession);
    saveProgress(withSession);
    if (nextSession) setSession(nextSession);
  }

  function changeMode(nextMode: QuizMode) {
    const next = startSession(progress, nextMode).activeSession!;
    setMode(nextMode);
    setSelected("");
    setFeedback(null);
    setComplete(next.queue.length === 0 && nextMode === "review");
    setScore({ correct: 0, total: 0 });
    persist(progress, next);
  }

  function submit() {
    if (!currentQuestion || !selected || feedback) return;
    const correct = selected === currentQuestion.correctOptionId;
    const nextProgress = submitAnswer(progress, currentQuestion.id, correct);
    setFeedback({ selectedOptionId: selected as AnswerFeedback["selectedOptionId"], correct });
    setScore((current) => ({ correct: current.correct + (correct ? 1 : 0), total: current.total + 1 }));
    persist(nextProgress, session);
  }

  function nextQuestion() {
    if (!currentQuestion || !feedback) return;
    if (mode === "review") {
      const remaining = feedback.correct ? session.queue.filter((id) => id !== currentQuestion.id) : [...session.queue.filter((id) => id !== currentQuestion.id), currentQuestion.id];
      if (remaining.length === 0) {
        const finished = { ...session, queue: [], currentIndex: 0 };
        persist(progress, finished);
        setComplete(true);
      } else {
        const nextIndex = Math.min(session.currentIndex, remaining.length - 1);
        const nextSession = { ...session, queue: remaining, currentIndex: nextIndex, round: feedback.correct ? session.round : (nextIndex === 0 ? session.round + 1 : session.round) };
        persist(progress, nextSession);
      }
    } else if (session.currentIndex + 1 >= session.queue.length) {
      setComplete(true);
      persist(progress, undefined);
    } else {
      persist(progress, { ...session, currentIndex: session.currentIndex + 1 });
    }
    setSelected("");
    setFeedback(null);
  }

  function restart() {
    const next = startSession(progress, mode).activeSession!;
    setComplete(next.queue.length === 0 && mode === "review");
    setSelected("");
    setFeedback(null);
    setScore({ correct: 0, total: 0 });
    persist(progress, next);
  }

  function resetAllProgress() {
    if (typeof window !== "undefined" && !window.confirm("Xóa toàn bộ tiến độ và hàng đợi câu cần ôn trên thiết bị này?")) return;
    const clean = clearProgress();
    const next = startSession(clean, "all").activeSession!;
    setProgress(clean);
    setMode("all");
    setSession(next);
    setSelected("");
    setFeedback(null);
    setComplete(false);
    setScore({ correct: 0, total: 0 });
    saveProgress(clean);
  }

  const hasContent = Boolean(currentQuestion) && !complete;
  const dataError = verifiedQuestions.length === 0;
  return (
    <div className="app-shell">
      <Sidebar mode={mode} reviewCount={reviewCount} onModeChange={changeMode} onReset={resetAllProgress} />
      <main className="main-content">
        <MobileModeSwitch mode={mode} reviewCount={reviewCount} onModeChange={changeMode} onReset={resetAllProgress} />
        <header className="page-header"><div><p className="eyebrow">Không gian luyện tập</p><h2>{mode === "review" ? "Câu cần ôn" : "Tất cả câu hỏi"}</h2></div><div className="header-meta"><span className="saved-indicator"><span className="status-dot" /> Đã lưu tự động</span></div></header>
        {dataError ? <section className="data-error" role="alert"><p className="question-kicker">Không thể bắt đầu</p><h1>Chưa có câu hỏi đã xác minh</h1><p>Kiểm tra lại <code>src/data/questions.json</code>, sau đó chạy <code>npm run validate:data</code> và tải lại trang.</p></section> : <>
          {hasContent && <ProgressBar index={session.currentIndex} total={session.queue.length} />}
          {hasContent && currentQuestion ? <QuestionCard question={currentQuestion} feedback={feedback} selected={selected} onSelect={setSelected} onSubmit={submit} onNext={nextQuestion} disabled={false} /> : complete || mode === "review" ? (mode === "review" && reviewCount === 0 ? <EmptyReview onAll={() => changeMode("all")} /> : <Summary mode={mode} correct={score.correct} total={score.total} reviewCount={reviewCount} onReview={() => changeMode("review")} onRestart={restart} />) : <div className="loading-card">Đang chuẩn bị câu hỏi…</div>}
        </>}
        <footer className="main-footer"><span>{verifiedQuestions.length} câu đã được đối chiếu trong bộ hiện tại</span><span>Phiên bản dữ liệu {datasetVersion}</span></footer>
      </main>
    </div>
  );
}
