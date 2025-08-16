import { Injectable, signal } from '@angular/core';

// 為了讓程式碼更嚴謹，我們先定義一個通知類型的 Type
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

@Injectable({
  providedIn: 'root'
})
export class TriggerAlertService {

  // 步驟一：建立用來儲存狀態的 Signal
  // 這些就是 HTML 模板中需要的屬性
  public show = signal<boolean>(false);
  public message = signal<string>('');
  public type = signal<NotificationType>('info');

  // 私有屬性，用來管理計時器
  private timeoutId: any;

  constructor() { }

  // 步驟二：建立用來從外部呼叫的 trigger 方法
  /**
   * 觸發全域提示框的函式
   * @param message 要顯示的訊息
   * @param type 提示框的類型
   * @param duration 顯示時間（毫秒），預設為 3 秒
   */
  public trigger(message: string, type: NotificationType = 'info', duration: number = 3000): void {

    // 1. 使用 .set() 方法來更新 signal 的值
    this.message.set(message);
    this.type.set(type);
    this.show.set(true);

    // 2. 清除上一個計時器，防止訊息顯示時間錯亂
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // 3. 設定一個新的計時器，在時間到後自動隱藏提示框
    this.timeoutId = setTimeout(() => {
      this.show.set(false);
    }, duration);
  }
}
