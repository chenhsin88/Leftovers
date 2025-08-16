import { AfterViewInit, ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CommonModule } from '@angular/common'; // 確保導入 CommonModule
import { FormsModule } from '@angular/forms';  // 載入 FormsModule
import { ActivatedRoute } from '@angular/router';
import { UsersServicesService } from './../@Services/users-services.service';
import { SafeUrlPipe } from '../safe-url.pipe';
import { gsap } from "gsap";
import { Subscription } from 'rxjs';
import { NotificationService, OrderNotification } from '../@Services/notification.service';


// 選單項目介面定義
interface MenuItem {
  icon: string;    // Material Icons 名稱
  label: string;   // 顯示文字
  active: boolean; // 是否選中
  route: string | any[]; // 改成可接受陣列
}

@Component({
  selector: 'app-merchants',
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, RouterOutlet, FormsModule, CommonModule, SafeUrlPipe, RouterLink],
  templateUrl: './merchants.component.html',
  styleUrl: './merchants.component.scss'
})
export class MerchantsComponent implements AfterViewInit, OnInit, OnDestroy {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private UsersServicesService: UsersServicesService,
    private notificationService: NotificationService, // 3. 注入 NotificationService
    private cdr: ChangeDetectorRef, // 2. 在建構函式中注入 ChangeDetectorRef
    private zone: NgZone // <-- 新增

  ) { }

  storeId: string | null = null;
  profilePictureUrl: string = '';
  IconShowOrNot: boolean = false;
  LightDarkContolIsChoose: boolean = false;
  hasNewNotification = false; // 用於控制鈴鐺紅點的變數
  private notificationSubscription: Subscription | undefined; // 用於儲存訂閱，方便取消
  // 儲存未讀數量
  unreadNotificationCount = 0;
  // 儲存完整的通知列表
  notifications: OrderNotification[] = [];

  // 用於儲存所有的訂閱
  private subscriptions: Subscription[] = [];
  private eventSource: EventSource | null = null;
  // 定錨向上滾動鈕
  showScrollToTopButton: boolean = false;


  // 監聽 window 的捲動事件
  @HostListener('window:scroll', [])
  onWindowScroll() {
    // 當垂直捲動距離大於 200px 時顯示按鈕，否則隱藏
    if (window.pageYOffset > 200) {
      this.showScrollToTopButton = true;
    } else {
      this.showScrollToTopButton = false;
    }
  }

  // 回到頂部的方法
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth' // 使用平滑捲動效果
    });
  }


  ngOnInit(): void {
    // 【這一段偵測店家切換的邏輯保持不變】
    this.route.paramMap.subscribe(params => {
      const newStoreId = params.get('storeId');
      if (newStoreId && this.storeId !== newStoreId) {
        console.log(`🏃‍♂️ 用戶切換店家：從 ${this.storeId} 到 ${newStoreId}`);
        this.notificationService.clearAllNotifications();
      }
      this.storeId = newStoreId;
      if (this.storeId) {
        console.log('✅ merchants.component 已準備就緒，當前店家 ID:', this.storeId);
        // 3. 當取得 storeId 後，建立 SSE 連線
        this.setupSseConnection(this.storeId);
      }
    });
    this.profilePictureUrl = this.UsersServicesService.currentUserValue?.profilePictureUrl || '';

    // --- ✨【以下是關鍵修改】---
    console.log('--- ngOnInit: 正在設定通知的訂閱 ---');

    // 1. 訂閱「未讀數量」- 使用物件形式來捕捉所有情況
    const unreadSub = this.notificationService.unreadCount$.subscribe({
      next: (count) => {
        console.log(`🟢 [unreadCount$] 成功收到更新，數量為: ${count}`);
        this.unreadNotificationCount = count;
        // ✨【最終修復】在資料更新後，立刻手動通知 Angular 刷新畫面
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(`🔴 [unreadCount$] 訂閱中發生了錯誤:`, err);
      },
      complete: () => {
        console.warn(`🟡 [unreadCount$] 訂閱已完成，將不再收到更新。`);
      }
    });
    this.subscriptions.push(unreadSub);

    // 2. 訂閱「完整通知列表」- 同樣使用物件形式
    const notificationsSub = this.notificationService.notifications$.subscribe({
      next: (notifications) => {
        console.log(`🟢 [notifications$] 成功收到更新，列表長度為: ${notifications.length}`);
        this.notifications = notifications;
        // ✨【最終修復】同樣在這裡也刷新一次，確保下拉選單內容也是最新的
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(`🔴 [notifications$] 訂閱中發生了錯誤:`, err);
      },
      complete: () => {
        console.warn(`🟡 [notifications$] 訂閱已完成，將不再收到更新。`);
      }
    });
    this.subscriptions.push(notificationsSub);
  }

  // 4. 新增一個專門處理 SSE 的方法
  private setupSseConnection(storeId: string): void {
    // 如果已有連線，先關閉舊的
    if (this.eventSource) {
      this.eventSource.close();
    }

    // 建立新的 SSE 連線
    this.eventSource = new EventSource(`http://localhost:8080/sse/merchant/${storeId}`);
    console.log(`🔌 [MerchantsComponent] 正在為店家 ${storeId} 建立新的 SSE 連線...`);

    this.eventSource.addEventListener("new-order", (event: MessageEvent) => {
      this.zone.run(() => {
        try {
          const newOrderData = JSON.parse(event.data);
          if (newOrderData && newOrderData.orderId && newOrderData.userName) {
            console.log("🔔 [MerchantsComponent] 收到新訂單，準備發送通知:", newOrderData);
            this.notificationService.addNotification({
              orderId: newOrderData.orderId,
              userName: newOrderData.userName
            });
            // ✨【修改點】將完整的訂單資料傳遞給刷新觸發器
            this.notificationService.triggerOrderListRefresh(newOrderData);
          }
        } catch (error) {
          console.error('[MerchantsComponent] 解析 SSE 的 JSON 資料失敗', error);
        }
      });
    });

    this.eventSource.onerror = (error) => {
      this.zone.run(() => {
        console.error("❌ [MerchantsComponent] SSE 連線錯誤", error);
        this.eventSource?.close();
      });
    };
  }

  // 5. 在元件銷毀時，確保關閉連線
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.eventSource) {
      this.eventSource.close();
      console.log(`🔌 [MerchantsComponent] 已關閉店家 ${this.storeId} 的 SSE 連線。`);
    }
  }

  // ✨【新增清除通知的方法】
  onClearNotifications(event: MouseEvent): void {
    // 1. 阻止事件冒泡，避免觸發外層的 markNotificationsAsRead()
    event.stopPropagation();

    console.log('🧹 正在清除所有通知...');

    // 2. 呼叫我們在服務中早已建立好的方法
    this.notificationService.clearAllNotifications();
  }

  /**
    * ✨【新的診斷版本】使用 try...catch 來捕捉潛在的錯誤
    */
  testNotification(): void {
    console.log('🧪 1. 測試按鈕點擊成功。準備呼叫通知服務...');

    try {
      // 我們將可疑的程式碼放進 try 區塊
      this.notificationService.addNotification({
        orderId: Math.floor(Math.random() * 9000) + 1000,
        userName: '手動測試員'
      });

      console.log('✅ 2. 呼叫 notificationService.addNotification() 成功，沒有拋出錯誤。');

    } catch (error) {
      // 如果 try 區塊發生任何錯誤，都會在這裡被捕捉到
      console.error('❌ 3. 呼叫 notificationService.addNotification() 時捕捉到致命錯誤!', error);
    }

    console.log('🏁 4. testNotification() 方法已執行完畢。');
  }

  // ✨ 新增或修改成這個方法，用來處理標示已讀的邏輯
  markNotificationsAsRead(): void {
    if (this.unreadNotificationCount > 0) {
      this.notificationService.markAllAsRead();
    }
  }

  // 點擊通知項目後的跳轉邏輯
  goToOrder(orderId: number): void {
    if (this.storeId) {
      console.log(`從小鈴鐺跳轉到訂單詳情，訂單ID：${orderId}`);

      // ✨【修改點】從小鈴鐺跳轉，我們預期使用者想回到「訂單列表」
      const returnUrl = `/merchants/${this.storeId}/orders`;

      this.router.navigate(
        ['/merchants', this.storeId, 'orderDetail', `${orderId}`],
        { queryParams: { returnUrl: returnUrl } } // 同樣附帶 returnUrl
      );
    }
  }

  // (可選，但建議) 增加一個輔助方法，讓點擊鈴鐺時也能切換左邊選單的 active 狀態
  selectMenuItemByRoute(route: string[]): void {
    const targetIndex = this.menuItems.findIndex(item =>
      JSON.stringify(item.route) === JSON.stringify(route)
    );
    if (targetIndex !== -1) {
      this.selectMenuItem(targetIndex);
    }
  }


  ngAfterViewInit(): void {
    // 當 View 準備好後，根據初始狀態設定圖示的樣式
    // 使用 gsap.set() 可以立即設定樣式，沒有動畫效果
    if (this.LightDarkContolIsChoose) {
      // 初始是暗模式
      gsap.set("#Sun", { opacity: 0, scale: 0 });
      gsap.set("#Moon", { opacity: 1, scale: 1 });
    } else {
      // 初始是亮模式
      gsap.set("#Sun", { opacity: 1, scale: 1 });
      gsap.set("#Moon", { opacity: 0, scale: 0 });
    }
  }

  // 切換主題的邏輯 (你的原版動畫邏輯是正確的，現在它將可以正常工作)
  LightDarkContolison(): void {
    // 關鍵修復：在執行任何動畫判斷之前，先將狀態反轉
    this.LightDarkContolIsChoose = !this.LightDarkContolIsChoose;

    // 現在，底下的判斷邏輯就能根據最新的狀態正確運作了
    if (this.LightDarkContolIsChoose) {
      // 切到暗模式，太陽隱藏，月亮出現
      gsap.to("#Sun", {
        duration: 0.4,
        opacity: 0,
        scale: 0.7,
        rotation: -90,
        ease: "power1.in",
        force3D: true,
        overwrite: "auto"
      });

      gsap.fromTo(
        "#Moon",
        {
          opacity: 0,
          scale: 0.5,
          rotation: 90,
          y: 20
        },
        {
          duration: 0.5,
          opacity: 1,
          scale: 1,
          rotation: 0,
          y: 0,
          ease: "back.out(1.7)",
          force3D: true,
          overwrite: "auto",
          delay: 0.1
        }
      );
    } else {
      // 切到淺色模式，月亮隱藏，太陽出現
      gsap.to("#Moon", {
        duration: 0.4,
        opacity: 0,
        scale: 0.7,
        rotation: 90,
        ease: "power1.in",
        force3D: true,
        overwrite: "auto"
      });

      gsap.fromTo(
        "#Sun",
        {
          opacity: 0,
          scale: 0.5,
          rotation: -90,
          y: 20
        },
        {
          duration: 0.5,
          opacity: 1,
          scale: 1,
          rotation: 0,
          y: 0,
          ease: "back.out(1.7)",
          force3D: true,
          overwrite: "auto",
          delay: 0.1
        }
      );
    }
  }

  // 選單項目數據
  menuItems: MenuItem[] = [
    { icon: 'storefront', label: '商家管理', active: true, route: ['storeManagement'] },
    { icon: 'notifications_active', label: '推播管理', active: false, route: ['pushNotification'] },
    { icon: 'inventory_2', label: '商品庫存管理', active: false, route: ['productInventory'] },
    { icon: 'receipt', label: '訂單管理', active: false, route: ['orders'] },
    { icon: 'history', label: '歷史訂單', active: false, route: ['orderHistory'] },
    { icon: 'paid', label: '營收統計', active: false, route: ['revenue'] },
    { icon: 'question_answer', label: '顧客評論管理', active: false, route: ['reviewReply'] },
    // { icon: 'settings', label: '其他設定', active: false, route: ['settings'] },
  ];


  selectMenuItem(index: number): void {
    // 重置所有項目的選中狀態
    this.menuItems.forEach(item => item.active = false);
    // 設置當前選中項目
    this.menuItems[index].active = true;

    // 從目前 URL 取得 storeId（你變數名稱改成 merchantId 可能會混淆，改叫 storeId 會更清楚）
    const selectedItem = this.menuItems[index];
    console.log('選中選單項目:', selectedItem.label);

    if (this.storeId && selectedItem.route) {
      this.router.navigate(['/merchants', this.storeId, ...selectedItem.route]);
    } else {
      console.warn('找不到 storeId，無法導航');
    }
  }

  // 首頁方法
  storeList(): void {
    console.log('選擇店家畫面');
    this.router.navigate(['/storeList']);
  }

  // 登出方法
  logout(): void {
    this.UsersServicesService.LoginOutNow();
  }

  // 導航到使用者個人資料頁面
  GoToChange(): void {
    // 在跳轉頁面前，讓當前活動元素失去焦點，這會自動關閉 dropdown
    (document.activeElement as HTMLElement)?.blur();

    // 接著執行原本的頁面跳轉邏輯
    this.router.navigate(['/profile-edit']);
  }
}
