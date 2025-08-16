import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  // 使用 signal 來控制對話框的顯示/隱藏及訊息內容
  public isVisible = signal<boolean>(false);
  public message = signal<string>('');

  // 使用 RxJS Subject 來發送使用者的選擇結果 (true/false)
  private confirmationSubject = new Subject<boolean>();

  constructor() { }

  /**
   * 開啟確認對話框
   * @param message - 要顯示在對話框中的訊息
   * @returns 一個 Observable，它會在使用者做出選擇後發出 true (確認) 或 false (取消)
   */
  open(message: string): Observable<boolean> {
    this.message.set(message);
    this.isVisible.set(true);

    // 每次開啟都建立一個新的 Subject，避免舊的訂閱者收到新事件
    this.confirmationSubject = new Subject<boolean>();
    return this.confirmationSubject.asObservable();
  }

  // 當使用者點擊「確認」時呼叫
  confirm(): void {
    this.isVisible.set(false);
    this.confirmationSubject.next(true); // 發送 true
    this.confirmationSubject.complete(); // 完成這個 Subject
  }

  // 當使用者點擊「取消」時呼叫
  cancel(): void {
    this.isVisible.set(false);
    this.confirmationSubject.next(false); // 發送 false
    this.confirmationSubject.complete(); // 完成這個 Subject
  }
}
