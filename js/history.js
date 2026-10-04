// Quản lý lịch sử làm bài

import * as storage from './storage.js';

export function renderHistoryList(container, onViewDetail) {
  const history = storage.getHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="notice info">
        Chưa có lịch sử làm bài. Hãy làm một bài để bắt đầu.
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(record => `
    <div class="card history-item" data-id="${record.id}">
      <div class="history-info">
        <h4>${record.subjectName}</h4>
        <p>
          ${formatDate(record.timestamp)} • ${record.mode} •
          ${record.questionCount} câu • ${formatDuration(record.duration)}
        </p>
      </div>
      <div class="history-stats">
        <div class="history-score">${record.score}</div>
        <div style="font-size: 0.875rem; color: var(--text-light);">
          ${record.correct} đúng / ${record.incorrect} sai / ${record.skipped} bỏ
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const record = history.find(h => h.id === id);
      if (record) onViewDetail(record);
    });
  });
}

export function renderHistoryDetail(container, record, subject, onClose, onDelete) {
  const questions = record.questions.map(q => {
    const question = subject.questions.find(sq => sq.id === q.id);
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

      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <button class="secondary" id="btn-back">Quay lại</button>
        <button class="danger" id="btn-delete">Xoá lịch sử này</button>
      </div>

      <div class="result-questions">
        ${questions.map((q, i) => `
          <div class="card result-question ${q.correct ? 'correct' : (q.selected !== undefined ? 'incorrect' : 'skipped')}">
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
        `).join('')}
      </div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', onClose);
  container.querySelector('#btn-delete').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xoá lịch sử này?')) {
      onDelete(record.id);
    }
  });
}

export function exportHistoryFile() {
  const jsonString = storage.exportHistory();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lich-su-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importHistoryFile(file, onSuccess, onError) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const success = storage.importHistory(e.target.result);
    if (success) {
      onSuccess();
    } else {
      onError('File không đúng định dạng');
    }
  };
  reader.onerror = () => onError('Không đọc được file');
  reader.readAsText(file);
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

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
