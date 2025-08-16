import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { HttpClientService } from "../@http-services/http.service";
import { ActivatedRoute } from '@angular/router';
import { MerchantsService } from "../@Services/merchants.service";
import { Subscription } from 'rxjs';
import { NotificationService } from "../@Services/notification.service";

// 訂單列表項目介面定義
export interface OrderListItem {
  orderNumber: string;  // 訂單編號
  customerName: string; // 下單用戶名
  // status: 'pending' | 'picked_up';  // 訂單狀態
  status: OrderStatus; // 使用統一型別
  totalAmount: number;  // 總金額
  orderTime: string;    // 訂單時間
  pickupCode: string;   // 取餐碼
}

// OrderGetByMechantIdRes 表示後端返回的資料結構
export interface OrderGetByMechantIdRes {
  code: number;
  message: string;
  orders: OrderSimpleVo[];
}

export interface OrderSimpleVo {
  orderId: number;
  userName: string;
  totalAmount: number;
  orderAt: string;
  status: string;
  pickupCode: string;
}

// 訂單狀態
export type OrderStatus = 'pending' | 'picked_up' | 'completed' | 'cancelled_by_user' | 'cancelled_by_merchant';


@Component({
  selector: "app-order-list",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./orders.component.html",
  styleUrls: ["./orders.component.scss"],
})
export class OrdersComponent implements OnInit, OnDestroy {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private httpClientService: HttpClientService,
    private merchantsService: MerchantsService,
    private cdr: ChangeDetectorRef, // 2. 在建構函式中注入 ChangeDetectorRef
    private notificationService: NotificationService // <-- 新增注入
  ) { }

  orders: OrderListItem[] = []; // 訂單資料
  storeId: string | null = null;
  // ✨ 4. 新增一個屬性來儲存訂閱
  private refreshSubscription: Subscription | undefined;
  // ✨ 1. 新增一個明確的屬性來儲存篩選後的列表
  filteredOrders: OrderListItem[] = [];

  private _searchTerm = ""; // 使用私有變數
  get searchTerm(): string {
    return this._searchTerm;
  }
  set searchTerm(value: string) {
    this._searchTerm = value;
    this.updateFilteredList(); // 當搜尋詞改變時，更新列表
  }

  private _statusFilter = "all"; // 使用私有變數
  get statusFilter(): string {
    return this._statusFilter;
  }
  set statusFilter(value: string) {
    this._statusFilter = value;
    this.updateFilteredList(); // 當篩選條件改變時，更新列表
  }

  refreshOrders(): void {
    if (!this.storeId) return;

    const allowedStatuses: OrderStatus[] = ['pending', 'picked_up', 'cancelled_by_user', 'cancelled_by_merchant'];

    this.httpClientService
      .getApi<OrderGetByMechantIdRes>(`http://localhost:8080/orders/getAllOrder/${this.storeId}`)
      .subscribe({
        next: (data) => {
          // ✨【診斷日誌】在處理資料前，先印出從後端收到的最原始的訂單資料
          console.log('API /getAllOrder 回傳的原始資料:', JSON.stringify(data));
          this.orders = data.orders
            .filter((order): order is OrderSimpleVo & { status: OrderStatus } =>
              allowedStatuses.includes(order.status as OrderStatus)
            )
            .map((order) => ({
              orderNumber: `${order.orderId}`,
              customerName: order.userName,
              status: order.status as OrderStatus,
              totalAmount: order.totalAmount,
              orderTime: this.formatDate(new Date(order.orderAt).toISOString()),
              pickupCode: order.pickupCode,
            }))
            .sort((a, b) => {
              if (a.status === 'cancelled_by_user' && b.status !== 'cancelled_by_user') return -1;
              if (a.status !== 'cancelled_by_user' && b.status === 'cancelled_by_user') return 1;
              return 0;
            });
          // ✨ 3. 在初次載入並更新主列表後，呼叫更新方法
          this.updateFilteredList();
        },
        error: (error) => {
          console.error('Error fetching orders:', error);
        },
      });
  }

  ngOnInit(): void {
    // 初次載入的邏輯不變
    this.route.parent?.paramMap.subscribe(params => {
      this.storeId = params.get('storeId');
      if (this.storeId) {
        this.refreshOrders();
      }
    });

    this.refreshSubscription = this.notificationService.orderListRefresh$.subscribe((newOrder: OrderSimpleVo) => {

      // 使用 try...catch 來捕捉任何可能發生的隱藏錯誤
      try {
        console.log('🔄 1. [OrdersComponent] 訂閱被觸發，成功收到新訂單物件:', newOrder);

        // 檢查收到的物件和時間，避免後續轉換出錯
        if (!newOrder || !newOrder.orderId) {
          console.error('❌ 收到的新訂單物件格式不正確，已中斷更新。');
          return;
        }

        // 將收到的新訂單物件轉換成前端列表的格式
        const newListItem: OrderListItem = {
          orderNumber: `${newOrder.orderId}`,
          customerName: newOrder.userName,
          status: (newOrder.status as OrderStatus) || 'pending', // 提供預設值
          totalAmount: newOrder.totalAmount || 0,
          // 為 orderAt 提供備用方案，防止因 null 或 undefined 導致錯誤
          orderTime: this.formatDate(new Date(newOrder.orderAt || new Date()).toISOString()),
          pickupCode: newOrder.pickupCode || 'N/A',
        };
        console.log('✅ 2. 已成功將新訂單物件轉換為列表項目格式:', newListItem);

        // 將新的項目插入到現有訂單列表的最前面
        this.orders = [newListItem, ...this.orders];
        console.log('✅ 3. 已將新項目加入 this.orders 陣列。');

        // 呼叫方法來更新篩選後的列表並刷新畫面
        this.updateFilteredList();

      } catch (error) {
        console.error('❌ 在處理新訂單的訂閱中發生了致命錯誤!', error);
      }
    });
    // ▲▲▲▲▲【請用以上區塊替換您原有的 refreshSubscription】▲▲▲▲▲
  }

  // ✨ 7. 在元件銷毀時，取消訂閱以避免記憶體洩漏
  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  /**
  * ✨ 2. 建立一個專門的方法來更新 filteredOrders 屬性
  */
  updateFilteredList(): void {
    this.filteredOrders = this.orders.filter((order) => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(this._searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(this._searchTerm.toLowerCase()) ||
        order.pickupCode.toLowerCase().includes(this._searchTerm.toLowerCase());

      const matchesStatus =
        this._statusFilter === "all" || order.status === this._statusFilter;

      return matchesSearch && matchesStatus;
    });

    // 每次更新完篩選列表後，都手動觸發一次畫面刷新，確保萬無一失
    this.cdr.detectChanges();
    console.log('✅ 篩選後的訂單列表已更新並刷新畫面！');
  }



  // 時間日期格式轉換
  private formatDate(date: string): string {
    const d = new Date(date); // 將字符串轉換為 Date 物件
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0"); // 確保月份兩位數
    const day = d.getDate().toString().padStart(2, "0"); // 確保日期兩位數
    const hours = d.getHours().toString().padStart(2, "0"); // 確保小時兩位數
    const minutes = d.getMinutes().toString().padStart(2, "0"); // 確保分鐘兩位數

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }


  /**
   * 根據訂單狀態獲取對應的 CSS 類別
   * @param status 訂單狀態
   * @returns CSS 類別字串
   */
  getStatusClass(status: string): string {
    const baseClass = "status-badge"
    switch (status) {
      case "pending":
        return `${baseClass} pending`
      case "picked_up":
        return `${baseClass} picked-up`
      case "completed":
        return `${baseClass} completed`
      case "cancelled_by_user":
        return `${baseClass} cancelled-by-user`;
      case "cancelled_by_merchant":
        return `${baseClass} cancelled-by-merchant`;
      default:
        return ""
    }
  }

  /**
   * 根據訂單狀態獲取顯示文字
   * @param status 訂單狀態
   * @returns 狀態顯示文字
   */
  getStatusText(status: string): string {
    switch (status) {
      case "pending":
        return "待付款"
      case "picked_up":
        return "待取餐"
      case "completed":
        return "已完成"
      case "cancelled_by_user":
        return "待取消";
      case "cancelled_by_merchant":
        return "已取消";
      default:
        return ""
    }
  }

  // 獲取統計數據
  getStats() {
    const pending = this.orders.filter((order) => order.status === "pending").length;
    const pickedUp = this.orders.filter((order) => order.status === "picked_up").length;
    const cancelledByUser = this.orders.filter((order) => order.status === "cancelled_by_user").length;
    const cancelledByMerchant = this.orders.filter((order) => order.status === "cancelled_by_merchant").length;
    return { pending, pickedUp, cancelledByUser, cancelledByMerchant };
  }

  // 獲取當前篩選結果的總金額
  getFilteredTotal(): number {
    return this.filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  }

  // 導航到訂單詳細頁面
  viewOrderDetail(orderNumber: string): void {
    console.log(`從「訂單列表」跳轉到訂單詳情頁面，訂單編號：${orderNumber}`);

    if (this.storeId) {
      this.merchantsService.setStoreId(this.storeId);

      // ✨【修改點】定義返回路徑，並透過 queryParams 傳遞
      const returnUrl = `/merchants/${this.storeId}/orders`;
      this.router.navigate(
        ['/merchants', this.storeId, 'orderDetail', orderNumber],
        { queryParams: { returnUrl: returnUrl } }
      );
    }
  }

  // 重置篩選條件
  resetFilters(): void {
    this.searchTerm = ""; // 這會自動觸發 updateFilteredList()
    this.statusFilter = "all"; // 這也會自動觸發 updateFilteredList()
  }
}
