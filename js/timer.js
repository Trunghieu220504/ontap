// Đồng hồ đếm ngược dựa trên mốc thời gian kết thúc

export class Timer {
  constructor(durationMinutes, onTick, onExpire) {
    this.endTime = Date.now() + durationMinutes * 60 * 1000;
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.intervalId = null;
    this.expired = false;
  }

  start() {
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  tick() {
    const remaining = this.endTime - Date.now();

    if (remaining <= 0 && !this.expired) {
      this.expired = true;
      this.stop();
      this.onExpire();
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const isWarning = remaining < 5 * 60 * 1000;

    this.onTick(minutes, seconds, isWarning);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getRemaining() {
    return Math.max(0, this.endTime - Date.now());
  }

  static fromEndTime(endTime, onTick, onExpire) {
    const timer = new Timer(0, onTick, onExpire);
    timer.endTime = endTime;
    return timer;
  }
}

// Tính thời gian theo số câu
export function calculateDuration(questionCount) {
  if (questionCount <= 25) return 30;
  if (questionCount <= 40) return 45;
  if (questionCount <= 50) return 60;
  return Math.ceil(questionCount * 1.2);
}
