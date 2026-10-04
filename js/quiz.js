// Logic làm bài trắc nghiệm

import * as storage from './storage.js';
import { Timer, calculateDuration } from './timer.js';

export class Quiz {
  constructor(subject, questions, mode, onUpdate) {
    this.subject = subject;
    this.questions = questions;
    this.mode = mode;
    this.onUpdate = onUpdate;
    this.currentIndex = 0;
    this.answers = {}; // questionId -> {selected: index, usedHint: bool}
    this.startTime = Date.now();
    this.endTime = null;
    this.timer = null;
    this.submitted = false;
  }

  startTimer(durationMinutes) {
    if (durationMinutes > 0) {
      this.endTime = Date.now() + durationMinutes * 60 * 1000;
      this.timer = new Timer(
        durationMinutes,
        (minutes, seconds, isWarning) => {
          this.onUpdate({ type: 'timer', minutes, seconds, isWarning });
        },
        () => {
          alert('Hết giờ! Bài làm sẽ được nộp tự động.');
          this.submit(true);
        }
      );
      this.timer.start();
    }
  }

  restoreTimer(endTime) {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      alert('Hết giờ! Bài làm sẽ được nộp tự động.');
      this.submit(true);
      return;
    }

    this.endTime = endTime;
    this.timer = Timer.fromEndTime(
      endTime,
      (minutes, seconds, isWarning) => {
        this.onUpdate({ type: 'timer', minutes, seconds, isWarning });
      },
      () => {
        alert('Hết giờ! Bài làm sẽ được nộp tự động.');
        this.submit(true);
      }
    );
    this.timer.start();
  }

  getCurrentQuestion() {
    return this.questions[this.currentIndex];
  }

  selectAnswer(optionIndex) {
    const question = this.getCurrentQuestion();
    if (this.answers[question.id]?.selected !== undefined) return false;

    this.answers[question.id] = {
      ...this.answers[question.id],
      selected: optionIndex
    };

    const isCorrect = optionIndex === question.answer;

    // Lưu tiến độ
    storage.saveProgress(this.subject.id, question.id, {
      correct: isCorrect,
      usedHint: this.answers[question.id]?.usedHint || false
    });

    // Thêm vào danh sách câu sai nếu sai
    if (!isCorrect) {
      storage.addWrongAnswer(this.subject.id, question.id);
    } else {
      // Xoá khỏi danh sách câu sai nếu trả lời đúng
      storage.removeWrongAnswer(this.subject.id, question.id);
    }

    this.onUpdate({ type: 'answer', isCorrect });
    this.saveSession();
    return true;
  }

  useHint() {
    const question = this.getCurrentQuestion();
    if (!this.answers[question.id]) {
      this.answers[question.id] = {};
    }
    this.answers[question.id].usedHint = true;
    this.saveSession();
  }

  goToQuestion(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentIndex = index;
      this.onUpdate({ type: 'navigate' });
      this.saveSession();
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.onUpdate({ type: 'navigate' });
      this.saveSession();
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.onUpdate({ type: 'navigate' });
      this.saveSession();
    }
  }

  getUnansweredCount() {
    return this.questions.filter(q => this.answers[q.id]?.selected === undefined).length;
  }

  canSubmit() {
    return !this.submitted;
  }

  submit(auto = false) {
    if (this.submitted) return null;

    const unanswered = this.getUnansweredCount();
    if (!auto && unanswered > 0) {
      if (!confirm(`Còn ${unanswered} câu chưa làm. Bạn có chắc muốn nộp bài?`)) {
        return null;
      }
    }

    if (this.timer) {
      this.timer.stop();
    }

    this.submitted = true;
    const endTime = Date.now();
    const duration = Math.floor((endTime - this.startTime) / 1000);

    const results = this.questions.map(q => {
      const answer = this.answers[q.id];
      const selected = answer?.selected;
      const isCorrect = selected === q.answer;
      const isSkipped = selected === undefined;

      return {
        id: q.id,
        text: q.text,
        options: q.options,
        answer: q.answer,
        selected,
        isCorrect,
        isSkipped,
        usedHint: answer?.usedHint || false,
        explanation: q.explanation
      };
    });

    const correct = results.filter(r => r.isCorrect).length;
    const incorrect = results.filter(r => !r.isCorrect && !r.isSkipped).length;
    const skipped = results.filter(r => r.isSkipped).length;
    const score = (correct / this.questions.length * 10).toFixed(1);

    // Lưu lịch sử
    storage.addHistory({
      timestamp: endTime,
      subjectId: this.subject.id,
      subjectName: this.subject.name,
      mode: this.mode,
      questionCount: this.questions.length,
      correct,
      incorrect,
      skipped,
      score: parseFloat(score),
      duration,
      questions: results.map(r => ({
        id: r.id,
        selected: r.selected,
        correct: r.isCorrect,
        usedHint: r.usedHint
      }))
    });

    storage.clearCurrentSession();

    return {
      correct,
      incorrect,
      skipped,
      score,
      duration,
      results
    };
  }

  saveSession() {
    storage.saveCurrentSession({
      subjectId: this.subject.id,
      mode: this.mode,
      questions: this.questions.map(q => q.id),
      currentIndex: this.currentIndex,
      answers: this.answers,
      startTime: this.startTime,
      endTime: this.endTime
    });
  }

  static restoreSession(subject, allQuestions) {
    const session = storage.getCurrentSession();
    if (!session || session.subjectId !== subject.id) return null;

    const questions = session.questions
      .map(id => allQuestions.find(q => q.id === id))
      .filter(q => q);

    if (questions.length === 0) return null;

    return {
      questions,
      mode: session.mode,
      currentIndex: session.currentIndex,
      answers: session.answers,
      startTime: session.startTime,
      endTime: session.endTime
    };
  }
}
