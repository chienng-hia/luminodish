export class DishRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isRecording = false;
  private startedAt = 0;

  public get active(): boolean {
    return this.isRecording;
  }

  public get elapsedSeconds(): number {
    if (!this.isRecording) return 0;
    return Math.floor((performance.now() - this.startedAt) / 1000);
  }

  public start(canvas: HTMLCanvasElement, audioStream: MediaStream | null): boolean {
    if (this.isRecording || typeof MediaRecorder === 'undefined') {
      return false;
    }

    const tracks: MediaStreamTrack[] = [];
    let hasVideo = false;

    if (typeof canvas.captureStream === 'function') {
      const videoStream = canvas.captureStream(30);
      videoStream.getVideoTracks().forEach((t) => {
        tracks.push(t);
        hasVideo = true;
      });
    }

    if (audioStream) {
      audioStream.getAudioTracks().forEach((t) => tracks.push(t));
    }

    if (tracks.length === 0) {
      return false;
    }

    const combinedStream = new MediaStream(tracks);
    const mimeCandidates = hasVideo
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['audio/webm;codecs=opus', 'audio/webm'];

    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

    try {
      this.chunks = [];
      this.mediaRecorder = mimeType
        ? new MediaRecorder(combinedStream, { mimeType })
        : new MediaRecorder(combinedStream);

      this.mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          this.chunks.push(ev.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blobType = mimeType || (hasVideo ? 'video/webm' : 'audio/webm');
        const blob = new Blob(this.chunks, { type: blobType });
        this.downloadBlob(blob, hasVideo ? 'webm' : 'audio.webm');
        this.chunks = [];
        this.isRecording = false;
      };

      this.mediaRecorder.start(250);
      this.startedAt = performance.now();
      this.isRecording = true;
      return true;
    } catch {
      this.isRecording = false;
      return false;
    }
  }

  public stop(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
  }

  private downloadBlob(blob: Blob, ext: string): void {
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    const a = document.createElement('a');
    a.href = url;
    a.download = `luminodish-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
