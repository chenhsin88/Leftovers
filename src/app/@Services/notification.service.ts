import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Subject } from 'rxjs';
import { OrderSimpleVo } from '../orders/orders.component';

// 1. 定義一個通知物件的介面
export interface OrderNotification {
  orderId: number;
  userName: string;
  read: boolean; // 用來追蹤是否已讀
  timestamp: Date; // 紀錄通知時間
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  // 2. 將 BehaviorSubject 的類型從 boolean 改為 OrderNotification[]
  private notificationsSource = new BehaviorSubject<OrderNotification[]>([]);

  // 讓外部可以訂閱完整的通知列表
  public notifications$ = this.notificationsSource.asObservable();

  // 3. 建立一個只提供「未讀數量」的 Observable，方便鈴鐺使用
  public unreadCount$ = this.notifications$.pipe(
    map(notifications => notifications.filter(n => !n.read).length)
  );

  // ✨ 2. 新增一個 Subject 來當作刷新觸發器
  private orderListRefreshSource = new Subject<OrderSimpleVo>();
  // ✨ 3. 將觸發器轉換成外部可以訂閱的 Observable
  public orderListRefresh$ = this.orderListRefreshSource.asObservable();

  constructor() { }

  /**
   * 4. 新增一個方法來加入新的通知
   * @param newOrder 包含 orderId 和 userName 的物件
   */
  addNotification(newOrder: { orderId: number, userName: string }): void {
    const currentNotifications = this.notificationsSource.getValue();

    // 建立一個完整的通知物件
    const newNotification: OrderNotification = {
      orderId: newOrder.orderId,
      userName: newOrder.userName,
      read: false, // 新通知預設為未讀
      timestamp: new Date()
    };

    // 將新通知加到陣列的最前面，並發送更新
    this.notificationsSource.next([newNotification, ...currentNotifications]);
  }

  /**
   * 5. 新增一個方法，將所有通知標示為已讀
   */
  markAllAsRead(): void {
    const currentNotifications = this.notificationsSource.getValue();
    const updatedNotifications = currentNotifications.map(n => ({ ...n, read: true }));
    this.notificationsSource.next(updatedNotifications);
  }

  /**
 * ✨【第一處關鍵修改】新增一個清空所有通知的方法
 * 當用戶切換店家時，我們需要呼叫它。
 */
  clearAllNotifications(): void {
    this.notificationsSource.next([]);
    console.log("🧹 通知服務：已清空所有通知。");
  }

  /**
   * ✨ 3. 修改觸發器，讓它可以攜帶訂單資料
   */
  triggerOrderListRefresh(newOrderData: OrderSimpleVo): void {
    console.log('⚡️ 通知服務：正在廣播「新訂單物件」的訊號...');
    this.orderListRefreshSource.next(newOrderData);
  }
}
