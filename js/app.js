// Ứng dụng chính

import * as storage from './storage.js';
import { Quiz } from './quiz.js';
import { calculateDuration } from './timer.js';
import * as history from './history.js';

let subjects = [];
let currentSubject = null;
let currentQuiz = null;
let lastResult = null;

// Khởi tạo ứng dụng
async function init() {
    try {
        subjects = await storage.loadSubjects();
        renderSubjects();
        setupEventHandlers();

        // Khôi phục session nếu có
        const session = storage.getCurrentSession();
        if (session) {
            const confirmResume = confirm('Bạn có bài chưa hoàn thành. Tiếp tục làm bài?');
            if (confirmResume) {
                await resumeSession(session);
            } else {
                storage.clearCurrentSession();
            }
        }
    } catch (error) {
        console.error('Lỗi khởi tạo:', error);
        alert('Không thể tải dữ liệu môn học. Vui lòng kiểm tra file data/subjects.json');
    }
}

// Hiển thị danh sách môn
function renderSubjects() {
    const list = document.getElementById('subjects-list');
    list.innerHTML = subjects.map(subject => {
        const progress = getSubjectProgress(subject.id);
        return `
            <button class="subject-card" data-subject-id="${subject.id}">
                <div class="subject-name">${subject.name}</div>
                <div class="subject-stats">
                    ${progress ? ` ${progress.correct}/${progress.total} đúng (${progress.percent}%)` : 'Chưa làm'}
                </div>
            </button>
        `;
    }).join('');
}

function getSubjectProgress(subjectId) {
    const progress = storage.getProgress(subjectId);
    if (!progress || Object.keys(progress).length === 0) return null;

    const total = Object.keys(progress).length;
    const correct = Object.values(progress).filter(q => q.correct).length;
    return {
        total,
        correct,
        percent: total > 0 ? Math.round(correct / total * 100) : 0
    };
}

// Chọn môn
async function selectSubject(subjectId) {
    try {
        const subject = subjects.find(s => s.id === subjectId);
        currentSubject = await storage.loadSubjectData(subject.dataFile);
        storage.saveLastSubject(subjectId);
        renderModeScreen();
        showScreen('screen-mode');
    } catch (error) {
        console.error('Lỗi tải môn:', error);
        alert(`Không thể tải dữ liệu môn học. Lỗi: ${error.message}`);
    }
}

// Hiển thị màn chọn chế độ
function renderModeScreen() {
    document.getElementById('mode-subject-name').textContent = currentSubject.name;

    const totalQuestions = currentSubject.questions.length;
    document.getElementById('mode-all-desc').textContent = `${totalQuestions} câu`;

    const chapterCount = currentSubject.chapters?.length || 0;
    document.getElementById('mode-chapters-desc').textContent = chapterCount > 0 ? `${chapterCount} chương` : 'Không có';

    const setCount = Math.ceil(totalQuestions / 50);
    document.getElementById('mode-sets-desc').textContent = `${setCount} đề`;

    const wrongAnswers = storage.getWrongAnswers(currentSubject.id);
    const wrongCount = wrongAnswers.length;
    document.getElementById('mode-wrong-desc').textContent = wrongCount > 0 ? `${wrongCount} câu` : 'Chưa có';
}

// Chọn chế độ
function selectMode(mode) {
    if (mode === 'all') {
        const questions = [...currentSubject.questions];
        shuffle(questions);
        showTimeConfig(questions, 'Tất cả câu hỏi');
    } else if (mode === 'chapters') {
        renderChaptersScreen();
        showScreen('screen-chapters');
    } else if (mode === 'sets') {
        renderSetsScreen();
        showScreen('screen-sets');
    } else if (mode === 'wrong') {
        startWrongMode();
    }
}

// Màn chọn chương
function renderChaptersScreen() {
    const list = document.getElementById('chapters-list');
    const chapters = currentSubject.chapters || [];

    if (chapters.length === 0) {
        list.innerHTML = '<p style="color: var(--text-light); padding: 12px 0;">Môn này không có phân chương.</p>';
        updateChaptersSummary();
        return;
    }

    list.innerHTML = chapters.map(chapter => {
        const count = currentSubject.questions.filter(q => q.chapter === chapter.id).length;
        const hasChapterPrefix = /^(chương|bài|phần)\s*\d+/i.test(chapter.name);
        const badgeHtml = hasChapterPrefix ? '' : `<span class="chapter-badge">Chương ${chapter.id}</span>`;
        return `
            <label class="chapter-row chapter-item">
                <div class="chapter-row-left">
                    <input type="checkbox" class="chapter-checkbox" value="${chapter.id}" data-count="${count}">
                    <div class="chapter-info">
                        ${badgeHtml}
                        <span class="chapter-name">${chapter.name}</span>
                    </div>
                </div>
                <div class="chapter-row-right">
                    <span class="chapter-count-badge">${count} câu</span>
                </div>
            </label>
        `;
    }).join('');

    updateChaptersSummary();
}

function updateChaptersSummary() {
    const checkboxes = Array.from(document.querySelectorAll('.chapter-checkbox'));
    const checked = checkboxes.filter(cb => cb.checked);

    checkboxes.forEach(cb => {
        const row = cb.closest('.chapter-row');
        if (row) {
            row.classList.toggle('selected', cb.checked);
        }
    });

    const totalChapters = checkboxes.length;
    const selectedChapters = checked.length;
    const selectedQuestions = checked.reduce((sum, cb) => sum + (parseInt(cb.dataset.count, 10) || 0), 0);

    const totalEl = document.getElementById('total-chapters-count');
    const selectedChaptersEl = document.getElementById('selected-chapters-count');
    const selectedQuestionsEl = document.getElementById('selected-questions-count');
    const startBtn = document.getElementById('btn-start-chapters');

    if (totalEl) totalEl.textContent = totalChapters;
    if (selectedChaptersEl) selectedChaptersEl.textContent = selectedChapters;
    if (selectedQuestionsEl) selectedQuestionsEl.textContent = selectedQuestions;

    if (startBtn) {
        startBtn.textContent = selectedQuestions > 0 
            ? `Bắt đầu (${selectedQuestions} câu)` 
            : 'Bắt đầu';
    }
}

function startChaptersMode() {
    const selected = Array.from(document.querySelectorAll('.chapter-checkbox:checked'))
        .map(cb => parseInt(cb.value));

    if (selected.length === 0) {
        alert('Vui lòng chọn ít nhất một chương');
        return;
    }

    const questions = currentSubject.questions.filter(q => selected.includes(q.chapter));
    shuffle(questions);
    const modeTitle = selected.length === (currentSubject.chapters?.length || 0)
        ? 'Tất cả các chương'
        : `Chương ${selected.join(', ')}`;
    showTimeConfig(questions, modeTitle);
}

// Màn chọn đề
function renderSetsScreen() {
    const totalQuestions = currentSubject.questions.length;
    const setCount = Math.ceil(totalQuestions / 50);

    const list = document.getElementById('sets-list');
    list.innerHTML = Array.from({ length: setCount }, (_, i) => {
        const setNum = i + 1;
        const start = i * 50;
        const end = Math.min((i + 1) * 50, totalQuestions);
        const count = end - start;
        return `
            <button class="set-card set-btn" data-set="${setNum}">
                <div class="set-card-header">
                    <span class="set-badge">Đề ${setNum}</span>
                    <span class="set-count-badge">${count} câu</span>
                </div>
                <div class="set-range-text">Câu ${start + 1} – ${end}</div>
                <div class="set-start-hint">
                    <span>Làm đề này</span>
                    <span class="set-arrow">→</span>
                </div>
            </button>
        `;
    }).join('');
}

function startSetMode(setNum) {
    const start = (setNum - 1) * 50;
    const end = Math.min(setNum * 50, currentSubject.questions.length);
    let questions = currentSubject.questions.slice(start, end);

    const shouldShuffle = document.getElementById('checkbox-shuffle-set').checked;
    if (shouldShuffle) {
        shuffle(questions);
    }

    showTimeConfig(questions, `Đề ${setNum}`);
}

// Chế độ câu đã làm sai
function startWrongMode() {
    const wrongIds = storage.getWrongAnswers(currentSubject.id);
    if (wrongIds.length === 0) {
        alert('Chưa có câu làm sai. Hãy làm bài để ghi nhận câu sai.');
        return;
    }

    const questions = currentSubject.questions.filter(q => wrongIds.includes(q.id));
    if (questions.length === 0) {
        alert('Không tìm thấy câu hỏi tương ứng.');
        return;
    }

    shuffle(questions);
    showTimeConfig(questions, 'Câu đã làm sai');
}

// Màn cấu hình thời gian
function showTimeConfig(questions, modeName) {
    const count = questions.length;
    const minutes = calculateDuration(count);

    document.getElementById('time-info').textContent = `${count} câu • ${minutes} phút`;

    showScreen('screen-time-config');

    // Lưu tạm để dùng khi bấm Bắt đầu
    window._pendingQuiz = { questions, modeName, minutes };
}

function startQuiz() {
    const { questions, modeName, minutes } = window._pendingQuiz;
    const unlimited = document.getElementById('checkbox-unlimited-time').checked;
    const answerMode = document.querySelector('input[name="answer-mode"]:checked')?.value || 'instant';

    currentQuiz = new Quiz(currentSubject, questions, modeName, handleQuizUpdate);
    currentQuiz.answerMode = answerMode; // 'instant' | 'exam'

    if (!unlimited) {
        currentQuiz.startTimer(minutes);
    }

    renderQuiz();
    showScreen('screen-quiz');
    delete window._pendingQuiz;
}

// Render giao diện làm bài
function renderQuiz() {
    document.getElementById('quiz-subject-name').textContent = currentSubject.name;
    document.getElementById('quiz-mode-name').textContent = currentQuiz.mode;

    renderQuestionNavigation();
    renderCurrentQuestion();
}

function renderQuestionNavigation() {
    const nav = document.getElementById('question-navigation');
    const isExamMode = currentQuiz.answerMode === 'exam' && !currentQuiz.submitted;

    nav.innerHTML = currentQuiz.questions.map((q, i) => {
        const answer = currentQuiz.answers[q.id];
        let className = 'nav-btn';

        if (i === currentQuiz.currentIndex) {
            className += ' active';
        }

        if (answer?.selected !== undefined) {
            if (isExamMode) {
                className += ' answered';
            } else {
                const isCorrect = answer.selected === q.answer;
                className += isCorrect ? ' correct' : ' incorrect';
            }
        }

        return `<button class="${className}" data-index="${i}">${i + 1}</button>`;
    }).join('');

    nav.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentQuiz.goToQuestion(parseInt(btn.dataset.index));
        });
    });
}

function renderCurrentQuestion() {
    const question = currentQuiz.getCurrentQuestion();
    const answer = currentQuiz.answers[question.id];
    const isAnswered = answer?.selected !== undefined;
    const isExamMode = currentQuiz.answerMode === 'exam' && !currentQuiz.submitted;
    // In exam mode, treat as "not yet revealed" until submitted
    const showResult = isAnswered && !isExamMode;

    const qNum = currentQuiz.currentIndex + 1;
    const totalQ = currentQuiz.questions.length;
    const cleanText = question.text.replace(/^câu\s*\d+\s*[:.]\s*/i, '');

    document.getElementById('question-text').innerHTML = `
        <span class="question-number">Câu ${qNum}:</span> <span class="question-content">${cleanText}</span>
    `;

    const progressBadge = document.getElementById('question-progress-badge');
    if (progressBadge) {
        progressBadge.textContent = `Câu ${qNum} / ${totalQ}`;
    }

    const optionsHtml = question.options.map((option, i) => {
        let className = 'option';

        if (showResult) {
            // Instant mode: show correct/incorrect immediately
            if (i === question.answer) className += ' correct';
            if (i === answer.selected) {
                className += ' selected';
                if (i !== question.answer) className += ' incorrect';
            }
            className += ' disabled';
        } else if (isAnswered && isExamMode) {
            // Exam mode: only highlight selected, no color feedback
            if (i === answer.selected) className += ' selected exam-selected';
            className += ' disabled';
        }

        return `
            <button class="${className}" data-index="${i}">
                <span class="option-label">${String.fromCharCode(65 + i)}</span>
                <span class="option-text">${option}</span>
            </button>
        `;
    }).join('');

    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = optionsHtml;

    if (!isAnswered) {
        optionsContainer.querySelectorAll('.option').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                currentQuiz.selectAnswer(index);
            });
        });
    }

    // Gợi ý — ẩn trong chế độ thi
    const hintBtn = document.getElementById('btn-hint');
    const hintText = document.getElementById('hint-text');

    if (question.hint && !isAnswered && !isExamMode) {
        hintBtn.classList.remove('hidden');
        hintBtn.onclick = () => {
            currentQuiz.useHint();
            hintText.textContent = question.hint;
            hintText.classList.remove('hidden');
            hintBtn.disabled = true;
        };

        if (answer?.usedHint) {
            hintText.textContent = question.hint;
            hintText.classList.remove('hidden');
            hintBtn.disabled = true;
        } else {
            hintText.classList.add('hidden');
            hintBtn.disabled = false;
        }
    } else {
        hintBtn.classList.add('hidden');
        hintText.classList.add('hidden');
    }

    // Giải thích — chỉ hiện sau khi trả lời ở chế độ instant, hoặc sau nộp bài
    const explanationEl = document.getElementById('explanation-text');
    if (showResult && question.explanation) {
        explanationEl.textContent = question.explanation;
        explanationEl.classList.remove('hidden');
    } else {
        explanationEl.classList.add('hidden');
    }

    // Exam mode badge indicator
    const examBadge = document.getElementById('exam-mode-indicator');
    if (examBadge) {
        examBadge.classList.toggle('hidden', !isExamMode);
    }

    // Navigation buttons
    document.getElementById('btn-prev').disabled = currentQuiz.currentIndex === 0;
    document.getElementById('btn-next').disabled = currentQuiz.currentIndex === currentQuiz.questions.length - 1;
}

// Xử lý cập nhật từ Quiz
function handleQuizUpdate(update) {
    if (update.type === 'timer') {
        const display = document.getElementById('timer-display');
        const timeStr = `${update.minutes}:${update.seconds.toString().padStart(2, '0')}`;
        display.textContent = timeStr;
        display.style.color = update.isWarning ? 'var(--incorrect)' : '';
    } else if (update.type === 'answer') {
        renderQuestionNavigation();
        renderCurrentQuestion();
    } else if (update.type === 'navigate') {
        renderCurrentQuestion();
        renderQuestionNavigation();
    }
}

// Nộp bài
function submitQuiz() {
    const result = currentQuiz.submit();
    if (!result) return;

    lastResult = result;
    renderResult(result);
    showScreen('screen-result');
}

// Hiển thị kết quả
function renderResult(result) {
    const summary = document.getElementById('result-summary');
    summary.innerHTML = `
        <div class="result-stat">
            <div class="value">${result.score}</div>
            <div class="label">Điểm</div>
        </div>
        <div class="result-stat">
            <div class="value" style="color: var(--correct)">${result.correct}</div>
            <div class="label">Đúng</div>
        </div>
        <div class="result-stat">
            <div class="value" style="color: var(--incorrect)">${result.incorrect}</div>
            <div class="label">Sai</div>
        </div>
        <div class="result-stat">
            <div class="value" style="color: var(--text-light)">${result.skipped}</div>
            <div class="label">Bỏ qua</div>
        </div>
        <div class="result-stat">
            <div class="value">${formatDuration(result.duration)}</div>
            <div class="label">Thời gian</div>
        </div>
    `;

    renderResultQuestions(result.results, false);

    // Ẩn/hiện nút làm lại câu sai
    const wrongCount = result.incorrect + result.skipped;
    document.getElementById('btn-redo-wrong').style.display = wrongCount > 0 ? '' : 'none';
}

function renderResultQuestions(results, filterWrong) {
    const filtered = filterWrong ? results.filter(r => !r.isCorrect) : results;

    const details = document.getElementById('result-details');
    details.innerHTML = filtered.map(r => {
        const actualIndex = results.indexOf(r);
        const badge = r.isSkipped ? 'skipped' : (r.isCorrect ? 'correct' : 'incorrect');
        const badgeText = r.isSkipped ? 'Bỏ qua' : (r.isCorrect ? 'Đúng' : 'Sai');

        return `
            <div class="card result-question">
                <div class="question-header">
                    <strong>Câu ${actualIndex + 1}</strong>
                    <span class="badge ${badge}">${badgeText}</span>
                </div>
                <div style="margin-bottom: 12px;">${r.text}</div>
                ${r.selected !== undefined ? `
                    <div class="answer-line">
                        Bạn chọn: <strong>${String.fromCharCode(65 + r.selected)}. ${r.options[r.selected]}</strong>
                    </div>
                ` : ''}
                <div class="answer-line">
                    Đáp án đúng: <strong style="color: var(--correct)">${String.fromCharCode(65 + r.answer)}. ${r.options[r.answer]}</strong>
                </div>
                ${r.usedHint ? '<div class="answer-line" style="font-style: italic;">Đã dùng gợi ý</div>' : ''}
                ${r.explanation ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 0.875rem;">${r.explanation}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Làm lại câu sai từ kết quả vừa nộp
function redoWrongFromResult() {
    if (!lastResult) return;

    const wrongQuestionIds = lastResult.results
        .filter(r => !r.isCorrect)
        .map(r => r.id);

    if (wrongQuestionIds.length === 0) {
        alert('Không có câu sai hoặc bỏ qua.');
        return;
    }

    const questions = currentSubject.questions.filter(q => wrongQuestionIds.includes(q.id));
    shuffle(questions);
    showTimeConfig(questions, 'Làm lại câu sai');
}

// Khôi phục session
async function resumeSession(session) {
    try {
        const subject = subjects.find(s => s.id === session.subjectId);
        currentSubject = await storage.loadSubjectData(subject.dataFile);

        const questions = session.questions
            .map(id => currentSubject.questions.find(q => q.id === id))
            .filter(q => q);

        if (questions.length === 0) {
            throw new Error('Không tìm thấy câu hỏi trong session');
        }

        currentQuiz = new Quiz(currentSubject, questions, session.mode, handleQuizUpdate);
        currentQuiz.currentIndex = session.currentIndex;
        currentQuiz.answers = session.answers;
        currentQuiz.startTime = session.startTime;

        if (session.endTime) {
            currentQuiz.restoreTimer(session.endTime);
        }

        renderQuiz();
        showScreen('screen-quiz');
    } catch (error) {
        console.error('Lỗi khôi phục session:', error);
        alert('Không thể khôi phục bài làm. Bắt đầu bài mới.');
        storage.clearCurrentSession();
    }
}

// Hiển thị lịch sử
function showHistoryScreen() {
    const container = document.getElementById('history-list');
    history.renderHistoryList(container, viewHistoryDetail);
    showScreen('screen-history');
}

function viewHistoryDetail(record) {
    const container = document.getElementById('history-detail-summary');
    const questionsContainer = document.getElementById('history-detail-questions');

    // Tìm subject
    const subject = subjects.find(s => s.id === record.subjectId);
    if (!subject) {
        alert('Không tìm thấy dữ liệu môn học');
        return;
    }

    // Load subject data và render
    storage.loadSubjectData(subject.dataFile).then(subjectData => {
        const questions = record.questions.map(q => {
            const question = subjectData.questions.find(sq => sq.id === q.id);
            return question ? { ...question, ...q } : null;
        }).filter(q => q);

        container.innerHTML = `
            <div class="card">
                <h2>${record.subjectName} - ${record.mode}</h2>
                <p style="color: var(--text-light); margin-bottom: 20px;">
                    ${formatDate(record.timestamp)} • ${formatDuration(record.duration)}
                </p>

                <div class="result-summary">
                    <div class="result-stat">
                        <div class="value">${record.score}</div>
                        <div class="label">Điểm</div>
                    </div>
                    <div class="result-stat">
                        <div class="value" style="color: var(--correct)">${record.correct}</div>
                        <div class="label">Đúng</div>
                    </div>
                    <div class="result-stat">
                        <div class="value" style="color: var(--incorrect)">${record.incorrect}</div>
                        <div class="label">Sai</div>
                    </div>
                    <div class="result-stat">
                        <div class="value" style="color: var(--text-light)">${record.skipped}</div>
                        <div class="label">Bỏ qua</div>
                    </div>
                </div>
            </div>
        `;

        questionsContainer.innerHTML = questions.map((q, i) => `
            <div class="card result-question">
                <div class="question-header">
                    <strong>Câu ${i + 1}</strong>
                    <span class="badge ${q.correct ? 'correct' : (q.selected !== undefined ? 'incorrect' : 'skipped')}">
                        ${q.correct ? 'Đúng' : (q.selected !== undefined ? 'Sai' : 'Bỏ qua')}
                    </span>
                </div>
                <div style="margin-bottom: 12px;">${q.text}</div>
                ${q.selected !== undefined ? `
                    <div class="answer-line">
                        Bạn chọn: <strong>${String.fromCharCode(65 + q.selected)}. ${q.options[q.selected]}</strong>
                    </div>
                ` : ''}
                <div class="answer-line">
                    Đáp án đúng: <strong style="color: var(--correct)">${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}</strong>
                </div>
                ${q.usedHint ? '<div class="answer-line" style="font-style: italic;">Đã dùng gợi ý</div>' : ''}
                ${q.explanation ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 0.875rem;">${q.explanation}</div>` : ''}
            </div>
        `).join('');

        showScreen('screen-history-detail');
    }).catch(error => {
        console.error('Lỗi tải chi tiết lịch sử:', error);
        alert('Không thể tải chi tiết bài làm');
    });
}

// Hiển thị màn hình
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// Xáo trộn mảng
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Format thời gian
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Thiết lập sự kiện
function setupEventHandlers() {
    // Chọn môn
    document.getElementById('subjects-list').addEventListener('click', e => {
        const card = e.target.closest('.subject-card');
        if (card) {
            selectSubject(card.dataset.subjectId);
        }
    });

    // Quay lại chọn môn
    document.getElementById('btn-back-to-subjects').addEventListener('click', () => {
        renderSubjects();
        showScreen('screen-subjects');
    });

    // Chọn chế độ
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => selectMode(btn.dataset.mode));
    });

    // Chọn chương
    document.getElementById('btn-back-to-mode').addEventListener('click', () => {
        showScreen('screen-mode');
    });
    document.getElementById('btn-start-chapters').addEventListener('click', startChaptersMode);

    document.getElementById('btn-select-all-chapters')?.addEventListener('click', () => {
        document.querySelectorAll('.chapter-checkbox').forEach(cb => {
            cb.checked = true;
        });
        updateChaptersSummary();
    });

    document.getElementById('btn-deselect-all-chapters')?.addEventListener('click', () => {
        document.querySelectorAll('.chapter-checkbox').forEach(cb => {
            cb.checked = false;
        });
        updateChaptersSummary();
    });

    document.getElementById('chapters-list')?.addEventListener('change', (e) => {
        if (e.target.classList.contains('chapter-checkbox')) {
            updateChaptersSummary();
        }
    });

    // Chọn đề
    document.getElementById('btn-back-to-mode-sets').addEventListener('click', () => {
        showScreen('screen-mode');
    });
    document.getElementById('sets-list').addEventListener('click', e => {
        const btn = e.target.closest('.set-btn');
        if (btn) {
            startSetMode(parseInt(btn.dataset.set));
        }
    });

    // Cấu hình thời gian
    document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
    document.getElementById('btn-cancel-quiz').addEventListener('click', () => {
        showScreen('screen-mode');
        delete window._pendingQuiz;
    });

    // Quiz controls
    document.getElementById('btn-prev').addEventListener('click', () => {
        currentQuiz.prevQuestion();
    });
    document.getElementById('btn-next').addEventListener('click', () => {
        currentQuiz.nextQuestion();
    });
    document.getElementById('btn-submit').addEventListener('click', submitQuiz);

    // Result screen
    document.getElementById('checkbox-filter-wrong').addEventListener('change', e => {
        if (lastResult) {
            renderResultQuestions(lastResult.results, e.target.checked);
        }
    });
    document.getElementById('btn-redo-wrong').addEventListener('click', redoWrongFromResult);
    document.getElementById('btn-back-to-mode-result').addEventListener('click', () => {
        lastResult = null;
        currentQuiz = null;
        renderModeScreen();
        showScreen('screen-mode');
    });

    // History
    document.getElementById('btn-view-history').addEventListener('click', showHistoryScreen);
    document.getElementById('btn-back-from-history').addEventListener('click', () => {
        showScreen('screen-mode');
    });
    document.getElementById('btn-back-to-history').addEventListener('click', () => {
        showHistoryScreen();
    });

    document.getElementById('btn-export-history').addEventListener('click', () => {
        history.exportHistoryFile();
    });

    document.getElementById('btn-import-history').addEventListener('click', () => {
        document.getElementById('file-import-history').click();
    });

    document.getElementById('file-import-history').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            history.importHistoryFile(
                file,
                () => {
                    alert('Nhập lịch sử thành công');
                    showHistoryScreen();
                },
                (error) => {
                    alert(`Lỗi nhập lịch sử: ${error}`);
                }
            );
            e.target.value = '';
        }
    });

    document.getElementById('btn-clear-history').addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xoá toàn bộ lịch sử?')) {
            storage.clearHistory();
            showHistoryScreen();
        }
    });

    document.getElementById('btn-delete-history-item').addEventListener('click', () => {
        // This will be handled in viewHistoryDetail
    });

    // Xử lý thoát trang
    window.addEventListener('beforeunload', e => {
        if (currentQuiz && !currentQuiz.submitted) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

init();
