import { Component } from '@angular/core';
import { CommonModule,NgClass } from '@angular/common';
// 引入我們剛剛建立的服務
import { TriggerAlertService } from '../@Services/trigger-alert.service';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule,NgClass],
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss'] // 確保路徑正確
})
export class AlertComponent {
  // 將 TriggerAlertService 注入，並設為 public
  // 這樣 HTML 模板中就可以直接用 `triggerAlertService.show()` 來讀取狀態
  constructor(public triggerAlertService: TriggerAlertService) { }

   // 變數：用來控制提示框的狀態、訊息和類型
  showAlert = false;
  alertMessage = '';
  alertType = 'alert-info'; // 預設類型
  private alertTimeoutId: any; // 用來儲存 setTimeout 的 ID

  /**
   * 觸發提示框的函式
   * @param message 要顯示的訊息
   * @param type 提示框的類型 ('success', 'error', 'warning', 'info')
   * @param duration 顯示時間（毫秒），預設為 3 秒
   */
  triggerAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration: number = 3000): void {

    // 1. 設定訊息和類型
    this.alertMessage = message;
    this.alertType = `alert-${type}`; // 對應到 daisyUI 的 class

    // 2. 顯示提示框
    this.showAlert = true;

    // 3. 如果之前有計時器，先清除，避免閃爍
    if (this.alertTimeoutId) {
      clearTimeout(this.alertTimeoutId);
    }

    // 4. 設定計時器，在指定時間後自動隱藏提示框
    this.alertTimeoutId = setTimeout(() => {
      this.showAlert = false;
    }, duration);
  }
}
