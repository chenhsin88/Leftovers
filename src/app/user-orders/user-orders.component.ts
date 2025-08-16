// src/app/user-orders/user-orders.component.ts
import { Component, OnInit,inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { map,catchError  } from 'rxjs/operators';
import { Observable,of  } from 'rxjs';
import { TriggerAlertService } from '../@Services/trigger-alert.service';
import { Router } from '@angular/router';
import { UsersServicesService } from '../@Services/users-services.service';
import { UserVo } from '../@Services/users-services.service';

// --- 後端 API 回傳的原始介面定義 ---
// 今日訂單的商品詳細資料介面
interface ApiProduct {
  merchantsId: number;
  orderId: number;
  foodId: number;
  quantity: number;
  foodName: string;
  foodPrice: number;
}

// 今日訂單的商家資訊介面
interface ApiMerchantInfo {
  name: string;
  addressText: string;
  openingHoursDescription: string;
  phoneNumber: string;
}
  // 【新增】定義後端 "新增評論" API 需要的請求格式
interface ReviewsCreateReq {
  merchants: string;
  rating: number;
  orderId: number;
  userName: string;
  comment: string;
  merchantId: number;
}
// ApiOrderVo: 今日訂單 API 回傳的資料格式
interface ApiOrderVo {
  userName: string;
  orderId: number;
  totalAmount: number;
  status: 'pending' | 'picked_up' | 'completed' | 'cancelled_by_user' | 'cancelled_by_merchant' | 'rejected';
  paymentMethodSimulated: string; // 支付方式 (例如 'CREDIT_CARD', '現金')
  pickupCode: string;
  notesToMerchant: string;
  orderedAt: string; // "YYYY-MM-DDTHH:mm:ss"
  rejectReason: string | null;
  cancellationReason: string | null;
  cancelStatus: 'REQUESTED' | 'APPROVED' | 'REJECTED' | null; // 取消申請的狀態
  foodId: number; // 注意：這個欄位在 `orderFoodItemList` 中已有，此處可能冗餘，但為保持原介面不變
  orderFoodItemList: ApiProduct[]; // 訂單中的商品列表
  merchantInfo: ApiMerchantInfo; // 商家資訊
}

// ApiHistoryGetUserAllOrderVoItem: 歷史訂單 API 回傳的單個項目資料格式 (已根據您提供的最新 JSON 範例更新)
interface ApiHistoryGetUserAllOrderVoItem {
  userEmail: string;
  orderId: string; // 歷史訂單的 ID
  unitPrice: number; // <-- 根據最新 JSON，這是後端提供的該歷史訂單的總金額 (現在將會被重新計算的值覆蓋)
  createdAt: string; // "YYYY-MM-DDTHH:mm:ss" 訂單創建時間
  status: 'pending' | 'picked_up' | 'completed' | 'cancelled_by_user' | 'cancelled_by_merchant' | 'rejected' | null; // 歷史訂單的狀態，現在可能為 null
  merchantId: number;
  merchantName: string; // <-- 歷史訂單中包含的商家名稱
  userName: string;
  items: { // 訂單中包含的商品列表
    foodName: string;
    quantity: number;
    foodPrice: number; // <-- 這是單一商品的價格，用於計算總價和顯示詳情
    foodId: number;
  }[];
  cancellationReason?: string | null; // 取消原因
  cancelStatus?: 'REQUESTED' | 'APPROVED' | 'REJECTED' | null; // 取消申請的狀態
  // 舊的 redundant 欄位 (originalUnitPrice, quantity, foodName, food_price 等) 已根據新 JSON 移除
}

// HistoryGetAllByUserEmailRes: 歷史訂單 API 回傳的頂層響應結構
interface HistoryGetAllByUserEmailRes {
  code: number;
  message: string;
  historyGetUserAllOrderVo: ApiHistoryGetUserAllOrderVoItem[]; // 歷史訂單列表的鍵名和類型
}

// BasicRes: 後端通用響應格式 (用於取消操作的回應)
interface BasicRes {
  code: number;
  message: string;
}

// --- 前端所需的標準化介面定義 (統一格式，供 HTML 模板使用) ---
export interface Order {
  id: string; // 訂單ID (字串)
  date: string; // 訂單日期 (YYYY-MM-DD 格式)
  status: 'ordered' | 'ready_for_pickup' | 'completed' | 'cancelled' | 'cancellation_requested';
  total: number; // 訂單總金額
  items: number; // 訂單中商品總數量
  pickupInfo?: PickupInformation; // 取貨資訊 (可選)
  products: Product[]; // 訂單中的商品列表 (必需)

  userName: string;       // 評論 API 需要
  merchantId: number;     // 評論 API 需要
  merchantName: string;   // 評論 API 需要
  cancellationReason?: string; // 取消原因 (可選)
}

interface Product {
  name: string;
  quantity: number;
  price: number; // 這個價格是單一商品的價格
}

interface PickupInformation {
  storeName: string; // <-- 商店名稱
  address: string;
  openingHours: string[];
  pickupCode: string;
  contactPhone: string;
}

// 用於篩選器選項的介面
interface StatusOption {
  value: string;
  label: string;
}


interface ReviewVo {
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
  merchantReply: string | null;
  merchantReplyAt: string | null;
  profilePictureUrl: string | null;
}
interface OrderToReviewVo {
  numericOrderId: number;
  displayOrderId: string;
}
interface OrdersToReviewRes {
  code: number;
  message: string;
  orders: OrderToReviewVo[];
}


@Component({
  selector: 'app-user-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    HttpClientModule
  ],
  templateUrl: './user-orders.component.html',
  styleUrls: ['./user-orders.component.scss']
})
export class UserOrdersComponent implements OnInit {
  private apiUrl = 'http://localhost:8080/orders'; // 今日訂單相關 API
  private historyApiUrl = 'http://localhost:8080/historyOrder'; // 歷史訂單相關 API
   private reviewsApiUrl = 'http://localhost:8080/reviews';
   private reviewableOrderIdSet = new Set<number>();
  private router = inject(Router);
  existingReview: ReviewVo | null = null;
  reviewRating: number = 0; // 預設0顆星
  reviewComment: string = '';
  isCheckingReview: boolean = false;
  orders: Order[] = [];

  searchTerm: string = '';
  statusFilter: string = 'all';
  viewMode: 'today' | 'history' = 'today';

  filteredOrders: Order[] = [];
  selectedOrder: Order | null = null;

  today: string;

  isCancelling: boolean = false;
  cancellationReasonInput: string = '';
  cancellingOrderId: string | null = null;

  // 新增篩選器選項的陣列
  todayStatusOptions: StatusOption[];
  historyStatusOptions: StatusOption[];

  // 日期篩選器 (保持不變)
  startDateFilter: string = '';
  endDateFilter: string = '';

  constructor(
    private httpClient: HttpClient,
    public triggerAlertService: TriggerAlertService,
    private usersServices: UsersServicesService
  ) {
    const now = new Date();
    this.today = now.toISOString().slice(0, 10);

    // 初始化今日訂單的篩選選項
    this.todayStatusOptions = [
      { value: 'all', label: '所有狀態' },
      { value: 'ordered', label: '已下單' },
      { value: 'ready_for_pickup', label: '待取貨' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' },
      { value: 'cancellation_requested', label: '申請取消' },
    ];

    // 初始化歷史訂單的篩選選項 (只保留指定狀態)
    this.historyStatusOptions = [
      { value: 'all', label: '所有狀態' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' },
    ];
  }

  ngOnInit() {
    this.loadOrdersByViewMode(this.usersServices.currentUserValue?.email || '');
    this.fetchReviewableOrderIds(this.usersServices.currentUserValue?.email || '');
  }

  /**
   * mapApiOrderToFrontendOrder: 將後端 ApiOrderVo (今日訂單) 轉換為前端 Order 介面。
   * 精確根據所有後端 statusenum 進行狀態映射。
   */
  private mapApiOrderToFrontendOrder(apiOrder: ApiOrderVo): Order {
    let frontendStatus: Order['status'];
    let cancellationReason: string | undefined = apiOrder.cancellationReason || undefined;

    // 根據後端狀態進行映射
    switch (apiOrder.status) {
      case 'pending':
        frontendStatus = 'ordered'; // 後端 'pending' -> 前端 '已下單'
        break;
      case 'picked_up':
        frontendStatus = 'ready_for_pickup'; // 後端 'picked_up' -> 前端 '待取貨'
        break;
      case 'completed':
        frontendStatus = 'completed'; // 後端 'completed' -> 前端 '已完成'
        break;
      case 'cancelled_by_user':
        frontendStatus = 'cancellation_requested'; // 後端 'cancelled_by_user' -> 前端 '申請取消'
        break;
      case 'cancelled_by_merchant':
        frontendStatus = 'cancelled'; // 後端 'cancelled_by_merchant' -> 前端 '已取消'
        break;
      case 'rejected':
        frontendStatus = 'cancelled'; // 假設 'rejected' 也映射為 '已取消'
        break;
      default:
        console.warn(`[UserOrdersComponent] 未知今日訂單主狀態，預設為 '已下單': status=${apiOrder.status}, orderId=${apiOrder.orderId}`);
        frontendStatus = 'ordered';
        break;
    }

    // 處理取消申請的 `cancelStatus` 覆寫，確保如果正在申請取消，狀態會更新
    if (frontendStatus !== 'cancelled' && apiOrder.cancelStatus === 'REQUESTED') {
      frontendStatus = 'cancellation_requested'; // 如果有明確的取消申請狀態，優先顯示為申請中
    }

    const products: Product[] = apiOrder.orderFoodItemList.map(item => ({
      name: item.foodName,
      quantity: item.quantity,
      price: item.foodPrice
    }));

    const totalItems = products.reduce((sum, prod) => sum + prod.quantity, 0);

    // ✅ 在這附近加上 console.log
    if (apiOrder.merchantInfo) {
      console.log('收到的原始營業時間字串:', (apiOrder.merchantInfo as any).openingHoursDescription);
    }

    const pickupInfo: PickupInformation | undefined = apiOrder.merchantInfo ? {
      storeName: apiOrder.merchantInfo.name,
      address: apiOrder.merchantInfo.addressText,
      openingHours: this.formatOpeningHours((apiOrder.merchantInfo as any).openingHoursDescription),
      contactPhone: apiOrder.merchantInfo.phoneNumber,
      pickupCode: apiOrder.pickupCode
    } : undefined;

    return {
      id: String(apiOrder.orderId),
      date: apiOrder.orderedAt.split('T')[0], // 提取日期部分
      status: frontendStatus,
      total: apiOrder.totalAmount,
      items: totalItems,
      userName: apiOrder.userName,                     // 【新增】
    merchantId: apiOrder.orderFoodItemList[0]?.merchantsId || 0, // 【新增】從第一個商品取商家ID
    merchantName: apiOrder.merchantInfo?.name || '',
      pickupInfo: pickupInfo,
      products: products,
      cancellationReason: cancellationReason
    };
  }

  /**
   * mapApiHistoryOrderToFrontendOrder: 將單個後端 ApiHistoryGetUserAllOrderVoItem (歷史訂單) 轉換為前端 Order 介面。
   * 這個函數現在假設每個 ApiHistoryGetUserAllOrderVoItem 代表一個完整的訂單，並且其 'items' 陣列包含所有商品。
   */
  private mapApiHistoryOrderToFrontendOrder(apiHistoryItem: ApiHistoryGetUserAllOrderVoItem): Order {
    let frontendStatus: Order['status'];
    let cancellationReason: string | undefined = apiHistoryItem.cancellationReason || undefined;

    // 歷史訂單的狀態判斷：優先使用 `status` 字段，如果為 null 則預設為 'completed'
    if (apiHistoryItem.status) {
      switch (apiHistoryItem.status) {
        case 'pending': frontendStatus = 'ordered'; break;
        case 'picked_up': frontendStatus = 'ready_for_pickup'; break;
        case 'completed': frontendStatus = 'completed'; break;
        case 'cancelled_by_user': frontendStatus = 'cancellation_requested'; break;
        case 'cancelled_by_merchant': frontendStatus = 'cancelled'; break;
        case 'rejected': frontendStatus = 'cancelled'; break;
        default:
          console.warn(`[UserOrdersComponent] 歷史訂單狀態不明確或未映射，預設為 '已完成': orderId=${apiHistoryItem.orderId}, status_field=${apiHistoryItem.status}`);
          frontendStatus = 'completed';
          break;
      }
    } else {
      console.warn(`[UserOrdersComponent] 歷史訂單無狀態字段或為 null，預設為 '已完成': orderId=${apiHistoryItem.orderId}`);
      frontendStatus = 'completed';
    }

    // 如果歷史訂單 API 也有 `cancelStatus`，並且是 `REQUESTED`，則覆寫狀態
    if (frontendStatus !== 'cancelled' && apiHistoryItem.cancelStatus === 'REQUESTED') {
      frontendStatus = 'cancellation_requested';
    }

    // 從 apiHistoryItem.items 陣列中映射商品
    const products: Product[] = apiHistoryItem.items.map(item => ({
      name: item.foodName,
      quantity: item.quantity,
      price: item.foodPrice // <-- 這裡精確使用 foodPrice 作為單一商品的價格
    }));

    // 計算訂單總金額：所有 foodPrice * quantity 的總和 (根據您的新要求)
    const calculatedTotal = products.reduce((sum, prod) => sum + (prod.price * prod.quantity), 0);

    // 計算訂單中商品的總數量
    const totalItems = products.reduce((sum, prod) => sum + prod.quantity, 0);

    // 歷史訂單的取貨資訊：現在將 merchantName 映射到 storeName
    const pickupInfo: PickupInformation | undefined = apiHistoryItem.merchantName ? {
      storeName: apiHistoryItem.merchantName, // <-- 將商家名稱映射到商店名稱
      address: '', // 歷史訂單 JSON 中未提供地址
      openingHours: [], // 歷史訂單 JSON 中未提供營業時間
      contactPhone: '', // 歷史訂單 JSON 中未提供電話
      pickupCode: '' // 歷史訂單 JSON 中未提供取貨碼
    } : undefined;

    return {
      id: apiHistoryItem.orderId,
      date: apiHistoryItem.createdAt.split('T')[0], // 從 createdAt 提取日期部分
      status: frontendStatus, // 映射後的狀態
      total: calculatedTotal, // <-- 使用重新計算的總金額
      items: totalItems, // 歷史訂單的總項目數 (總數量)
      userName: apiHistoryItem.userName,
    merchantId: apiHistoryItem.merchantId,            // 【新增】
    merchantName: apiHistoryItem.merchantName,
      pickupInfo: pickupInfo, // 取貨資訊
      products: products, // 商品列表
      cancellationReason: cancellationReason // 取消原因
    };
  }

  /**
   * loadOrdersByViewMode: 根據當前 `viewMode` (今日或歷史) 載入相應的訂單數據。
   * @param userEmail 用戶的電子郵件地址
   */
  private loadOrdersByViewMode(userEmail: string): void {
    if (this.viewMode === 'today') {
      this.fetchOrders(userEmail); // 載入今日訂單
    } else {
      this.fetchHistoryOrders(userEmail); // 載入歷史訂單
    }
  }

  /**
   * fetchOrders: 從後端 API 獲取今日訂單數據。
   * @param userEmail 用戶的電子郵件地址
   */
  fetchOrders(userEmail: string): void {
    const url = `${this.apiUrl}/getOrderInformationByEmail?userEmail=${userEmail}`;
    this.httpClient.get<ApiOrderVo[]>(url).pipe(
      map(apiOrders => apiOrders.map(apiOrder => this.mapApiOrderToFrontendOrder(apiOrder)))
    ).subscribe({
      next: (data: Order[]) => {
        console.log('--- 從 API 獲取的今日訂單資料 (已轉換為前端 Order 格式) ---');
        console.log(data);
        console.log('----------------------------------------------------');

        this.orders = data;
        this.updateDisplayedOrders();
      },
      error: (err) => {
        console.error('獲取今日訂單失敗:', err);
        // alert('載入今日訂單失敗，請檢查網路連線或稍後再試。');
        this.orders = []; // 失敗時清空數據
        this.filteredOrders = []; // 失敗時清空篩選後的數據
      }
    });
  }

  /**
   * fetchHistoryOrders: 從後端 API 獲取歷史訂單數據。
   * @param userEmail 用戶的電子郵件地址
   */
  fetchHistoryOrders(userEmail: string): void {
    const url = `${this.historyApiUrl}/getUserAllOrder/${userEmail}`;
    this.httpClient.get<HistoryGetAllByUserEmailRes>(url).pipe(
      map(response => {
        if (response && response.historyGetUserAllOrderVo) {
          // 現在每個 historyGetUserAllOrderVo 項目就是一個獨立的訂單
          return response.historyGetUserAllOrderVo.map(apiHistoryOrder => this.mapApiHistoryOrderToFrontendOrder(apiHistoryOrder));
        }
        return []; // 如果沒有歷史訂單或響應格式不符，返回空陣列
      })
    ).subscribe({
      next: (data: Order[]) => {
        console.log('--- 從 API 獲取的歷史訂單資料 (已轉換為前端 Order 格式) ---');
        console.log(data);
        console.log('----------------------------------------------------');

        this.orders = data; // 歷史訂單載入後，同樣更新 this.orders
        this.updateDisplayedOrders(); // 更新顯示列表
      },
      error: (err) => {
        console.error('獲取歷史訂單失敗:', err);
        // alert('載入歷史訂單失敗，請檢查網路連線或稍後再試。');
        this.orders = [];
        this.filteredOrders = [];
      }
    });
  }

  // --- 輔助函數：獲取訂單狀態的排序權重 ---
  private getStatusSortOrder(status: string): number {
    switch (status) {
      case 'ready_for_pickup': return 1;
      case 'ordered': return 2;
      case 'cancellation_requested': return 3;
      case 'completed': return 4;
      case 'cancelled': return 5;
      default: return 99;
    }
  }

  /**
   * updateDisplayedOrders: 根據當前的篩選條件和檢視模式更新 `filteredOrders`。
   * 此方法會在 `orders` 數據載入後被呼叫。
   */
  updateDisplayedOrders(): void {
    let tempOrders = [...this.orders];

    const startDateObj = this.startDateFilter ? new Date(this.startDateFilter + 'T00:00:00') : null;
    const endDateObj = this.endDateFilter ? new Date(this.endDateFilter + 'T23:59:59') : null;

    // 根據檢視模式（今日訂單或歷史訂單）應用日期篩選
    if (this.viewMode === 'today') {
      tempOrders = tempOrders.filter(order => order.date === this.today);
    } else { // 歷史訂單模式
      tempOrders = tempOrders.filter(order => order.date !== this.today);

      if (startDateObj) {
        tempOrders = tempOrders.filter(order => new Date(order.date + 'T00:00:00').getTime() >= startDateObj.getTime());
      }
      if (endDateObj) {
        tempOrders = tempOrders.filter(order => new Date(order.date + 'T00:00:00').getTime() <= endDateObj.getTime());
      }
    }

    // 應用搜尋關鍵字篩選：匹配訂單 ID 或訂單中任何商品的名稱
    tempOrders = tempOrders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        order.products.some((product) =>
          product.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      return matchesSearch;
    });

    // 應用訂單狀態篩選
    tempOrders = tempOrders.filter((order) => {
      const matchesStatus =
        this.statusFilter === 'all' || order.status === this.statusFilter;
      return matchesStatus;
    });

    // 最終排序：首先按狀態權重排序（例如待取貨優先），然後按日期倒序（最近的在前面）
    this.filteredOrders = tempOrders.sort((a, b) => {
      const statusA = this.getStatusSortOrder(a.status);
      const statusB = this.getStatusSortOrder(b.status);

      if (statusA !== statusB) {
        return statusA - statusB;
      } else {
        // 狀態相同時，按日期倒序 (最新的在前面)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
  }

  // --- 輔助函數：判斷是否為今日訂單 (在數據處理邏輯中使用) ---
  isTodayOrderInList(orderDate: string): boolean {
    return orderDate === this.today;
  }

  // --- 徽章樣式與文字邏輯 ---
  // 根據訂單狀態返回對應的 CSS 類別，用於控制徽章顏色
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ordered': return 'badge-pale-blue';
      case 'ready_for_pickup': return 'badge-blue';
      case 'completed': return 'badge-green';
      case 'cancelled': return 'badge-red';
      case 'cancellation_requested': return 'badge-orange';
      default: return 'badge-secondary'; // 預設樣式
    }
  }

  // 根據訂單狀態返回對應的中文文字
  getStatusBadgeText(status: string): string {
    switch (status) {
      case 'ordered': return '已下單';
      case 'ready_for_pickup': return '待取貨';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      case 'cancellation_requested': return '申請取消';
      default: return '未知狀態';
    }
  }

  // --- 訂單詳情彈出視窗控制 ---
  openOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.isCancelling = false;
    this.cancellationReasonInput = '';
    this.cancellingOrderId = null;

    // 重設評論表單
    this.reviewRating = 0;
    this.reviewComment = '';
    this.existingReview = null; // 先清空舊的評論資料

    // 【新增】如果訂單是已完成狀態，就去後端查詢是否已有評論
    if (order.status === 'completed') {
      this.isCheckingReview = true;
      this.fetchExistingReview(order);
    }
  }

  closeOrderDetails(): void {
    this.selectedOrder = null;
    this.isCancelling = false;
    this.cancellationReasonInput = '';
    this.cancellingOrderId = null;
  }

  // --- 今日訂單統計數據 ---
  // 這些統計數據現在會基於 `this.orders` 陣列（無論是今日還是歷史數據），
  // 但其名稱仍帶有「今日」，請根據實際顯示的意圖來決定是否需要調整。
  // 通常，這些卡片會顯示「當前視圖模式」下的統計。
  getTodayReadyForPickupAndOrderedCount(): number {
    // 這裡仍然篩選符合「今日」的訂單，如果 this.orders 已經被載入為歷史訂單，這裡會是 0
    return this.orders.filter(order =>
      order.date === this.today &&
      (order.status === 'ready_for_pickup' || order.status === 'ordered')
    ).length;
  }

  getTodayCompletedCount(): number {
    return this.orders.filter(order => order.date === this.today && order.status === 'completed').length;
  }

  getTodayCancellationRequestedCount(): number {
    return this.orders.filter(order => order.date === this.today && order.status === 'cancellation_requested').length;
  }

  getTodayCancelledCount(): number {
    return this.orders.filter(order => order.date === this.today && order.status === 'cancelled').length;
  }

  // 計算當前 filteredOrders 的總花費 (無論是今日或歷史模式)
  getTodayTotalSpending(): number {
    return this.filteredOrders.reduce((sum, order) => sum + order.total, 0);
  }

  // --- 歷史訂單統計數據 (這些通常只在 `viewMode === 'history'` 時顯示) ---
  getHistoryCompletedOrdersCount(): number {
    // 這裡從 `this.orders` 中過濾所有非今日的已完成訂單
    return this.orders.filter(order => order.date !== this.today && order.status === 'completed').length;
  }

  getHistoryCancelledOrdersCount(): number {
    // 這裡從 `this.orders` 中過濾所有非今日的已取消訂單
    return this.orders.filter(order => order.date !== this.today && order.status === 'cancelled').length;
  }

  // --- 切換檢視模式 (今日 / 歷史) ---
  // 當用戶點擊「今日訂單資訊」或「歷史訂單資訊」按鈕時觸發
  setViewMode(mode: 'today' | 'history'): void {
    this.viewMode = mode; // 更新檢視模式
    this.searchTerm = ''; // 清空搜尋詞
    this.statusFilter = 'all'; // 重設狀態篩選為「所有狀態」
    this.startDateFilter = ''; // 清空日期篩選（開始日期）
    this.endDateFilter = '';   // 清空日期篩選（結束日期）

    // 根據新的 viewMode 重新載入數據
    this.loadOrdersByViewMode(this.usersServices.currentUserValue?.email || '');
  }

  // --- 取消訂單相關方法 ---
  // 當用戶點擊「申請取消訂單」按鈕時觸發
  requestCancelOrder(): void {
    // 只有當前選中的訂單狀態為「已下單」時才允許申請取消
    if (this.selectedOrder?.status === 'ordered') {
      this.isCancelling = true; // 顯示取消原因輸入框
      this.cancellationReasonInput = ''; // 清空輸入框
      this.cancellingOrderId = this.selectedOrder.id; // 記錄正在取消的訂單 ID
    }
  }

  // 當用戶輸入取消原因並點擊「確認取消」時觸發
  confirmCancelOrder(): void {
    // 檢查是否有訂單 ID 且取消原因不為空
    if (this.cancellingOrderId && this.cancellationReasonInput.trim()) {
      const orderIdNumber = Number(this.cancellingOrderId); // 將字串型別的訂單 ID 轉換為數字型別
      const orderPickupCode = this.selectedOrder?.pickupInfo?.pickupCode; // 獲取取貨碼

      // 確保取貨碼存在，因為後端 API 需要
      if (!orderPickupCode) {
        // alert('無法取得訂單取貨碼，請檢查訂單詳情！');
        console.error('取消訂單失敗: 無法取得取貨碼。');
        return; // 終止操作
      }

      // API 端點固定為 orders/cancelRequest
      const cancelApiUrl = `${this.apiUrl}/cancelRequest`;

      // 構建請求主體 (body)，包含 orderId (number), pickupCode (string), cancellationReason (string)
      const body = {
        orderId: orderIdNumber,
        pickupCode: orderPickupCode,
        cancellationReason: this.cancellationReasonInput
      };

      // 發送 POST 請求到後端 API 申請取消訂單
      this.httpClient.post<BasicRes>(cancelApiUrl, body).subscribe({
        next: (response) => {
          if (response.code === 200) { // 檢查後端返回的 code
            console.log('取消訂單申請成功:', response.message);
            this.triggerAlertService.trigger('取消訂單申請已提交', 'success');
            this.closeOrderDetails(); // 關閉詳情模態視窗
            // 手動更新前端狀態，以提供即時的 UI 響應
            // 將訂單狀態更新為 'cancellation_requested'
            this.manuallyUpdateOrderStatus(orderIdNumber, 'cancellation_requested', this.cancellationReasonInput);

          } else {
            console.error('取消訂單申請失敗:', response.message);
            this.triggerAlertService.trigger('取消訂單申請失敗', 'error');
            this.closeOrderDetails();
          }
        },
        error: (err) => {
          console.error('申請取消失敗 (API 錯誤):', err);
          this.triggerAlertService.trigger('取消申請失敗，請稍後再試', 'error');
          this.closeOrderDetails();
        }
      });
    } else {
      this.triggerAlertService.trigger('請輸入取消原因', 'error');
    }
  }

  // 手動更新訂單狀態的方法，用於 UI 即時響應
  private manuallyUpdateOrderStatus(orderId: number, newStatus: Order['status'], cancellationReason?: string): void {
    const updatedOrders = this.orders.map(order => {
      // 確保只更新正確的訂單，並更新其狀態和取消原因
      if (order.id === String(orderId)) {
        return {
          ...order,
          status: newStatus,
          cancellationReason: cancellationReason || order.cancellationReason
        };
      }
      return order;
    });
    this.orders = updatedOrders; // 更新原始數據
    this.updateDisplayedOrders(); // 重新觸發篩選和顯示
  }


  // 當用戶點擊「取消」按鈕（放棄取消訂單）時觸發
  cancelCancelRequest(): void {
    this.isCancelling = false; // 隱藏取消原因輸入框
    this.cancellationReasonInput = ''; // 清空取消原因
    this.cancellingOrderId = null; // 清空正在處理的取消訂單 ID
  }

  // user-orders.component.ts

  /**
   * ✅ [最終正確版本] 格式化並整合營業時間，能處理不連續的日期分組
   * @param hoursString 後端回傳的營業時間字串 (格式: "星期一 休息，星期二 11:30-18:30...")
   * @returns 整合後的營業時間字串陣列，供前端顯示
   */
  private formatOpeningHours(hoursString: string): string[] {
    if (!hoursString) {
      return ['未提供營業時間'];
    }

    // 1. 解析輸入字串，建立 Map<日期, 時間>
    const dailyHours = new Map<string, string>();
    const dayEntries = hoursString.split('，').filter(entry => entry.trim() !== '');
    for (const entry of dayEntries) {
      const parts = entry.trim().split(/\s+/);
      if (parts.length === 2) {
        dailyHours.set(parts[0], parts[1].trim() === '未營業' ? '休息' : parts[1].trim());
      }
    }

    if (dailyHours.size === 0) {
      return ['營業時間格式無法解析'];
    }

    // 2. 反向分組：建立 Map<時間, 日期[]>
    const timeToDaysMap = new Map<string, string[]>();
    for (const [day, time] of dailyHours.entries()) {
      if (!timeToDaysMap.has(time)) {
        timeToDaysMap.set(time, []);
      }
      timeToDaysMap.get(time)!.push(day);
    }

    // 3. 格式化每個分組，並產生最終的顯示字串
    const weekOrder = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    const resultLines: string[] = [];

    for (const [time, days] of timeToDaysMap.entries()) {
      // 排序日期以確保處理順序正確
      days.sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b));

      const formattedDays = this.consolidateDayRanges(days, weekOrder);
      resultLines.push(`${formattedDays}：${time}`);
    }

    return resultLines;
  }

  /**
   * 輔助函式：將日期陣列轉換為帶有 ~ 和 、 的字串
   * @param days - e.g., ['星期一', '星期六', '星期日']
   * @param weekOrder - 用於判斷連續性的星期順序
   * @returns e.g., "星期一、星期六 ~ 星期日"
   */
  private consolidateDayRanges(days: string[], weekOrder: string[]): string {
    if (days.length === 0) return '';
    if (days.length === 1) return days[0];

    const ranges: string[] = [];
    let startIndex = 0;

    for (let i = 1; i <= days.length; i++) {
      // 判斷當前日期是否與前一個日期不連續，或已經是最後一個日期
      if (i === days.length || weekOrder.indexOf(days[i]) !== weekOrder.indexOf(days[i - 1]) + 1) {
        const endIndex = i - 1;
        const startDay = days[startIndex];
        const endDay = days[endIndex];

        if (startIndex === endIndex) {
          ranges.push(startDay); // 單獨一天
        } else {
          ranges.push(`${startDay} ~ ${endDay}`); // 連續多天
        }
        startIndex = i; // 開始新的範圍
      }
    }

    return ranges.join('、'); // 用頓號連接不同的範圍
  }
  /**
   * [新增方法 1/3] 從後端獲取可評論的訂單ID列表，並存入 Set 中
   * @param userEmail 當前登入者的 email
   */
  private fetchReviewableOrderIds(userEmail: string): void {
    const url = `${this.reviewsApiUrl}/to-be-reviewed/${userEmail}`;
    this.httpClient.get<OrdersToReviewRes>(url).pipe(
      catchError(err => {
        console.error('獲取待評論訂單列表失敗:', err);
        return of({ code: 500, message: '獲取失敗', orders: [] }); // 發生錯誤時回傳空資料
      })
    ).subscribe(res => {
      if (res && res.code === 200 && res.orders) {
        const ids = res.orders.map(order => order.numericOrderId);
        this.reviewableOrderIdSet = new Set(ids);
        console.log('可評論的訂單ID已載入:', this.reviewableOrderIdSet);
      }
    });
  }

  /**
   * [新增方法 2/3] 判斷一筆訂單是否可以評論 (給 HTML 模板使用)
   * @param order 要檢查的訂單物件
   * @returns boolean
   */
  isReviewable(order: Order): boolean {
    // 條件1: 訂單狀態必須是 'completed'
    if (order.status !== 'completed') {
      return false;
    }

    // 條件2: 該訂單的純數字ID必須存在於我們剛才載入的 Set 中
    // 使用正規表示式 `/\D/g` 來移除所有非數字字元，例如 "RF"
    const numericId = parseInt(order.id.replace(/\D/g, ''), 10);
    return this.reviewableOrderIdSet.has(numericId);
  }

  /**
   * [新增方法 3/3] 當使用者點擊「撰寫評論」按鈕時，導航至評論頁面
   * @param order 被點擊的訂單物件
   */
  navigateToReview(order: Order): void {
    const numericId = parseInt(order.id.replace(/\D/g, ''), 10);
    // 導航到撰寫評論的頁面，您需要建立一個對應的路由和元件
    // 這裡的路徑是範例，請根據您的專案結構修改
    this.router.navigate(['/create-review', numericId]);
    console.log(`準備導航至評論頁面，訂單ID: ${numericId}`);
  }

  /**
   * [新增方法] 根據訂單ID和使用者Email，從後端獲取已存在的評論
   * @param order 當前被選中的訂單物件
   */
   private fetchExistingReview(order: Order): void {
    const numericId = parseInt(order.id.replace(/\D/g, ''), 10);
    const userEmail = this.usersServices.currentUserValue?.email;

    if (!userEmail) {
      console.error('無法獲取使用者 Email，無法查詢評論');
      this.isCheckingReview = false; // 【修改】如果出錯，也要結束檢查狀態
      return;
    }

    const url = `${this.reviewsApiUrl}/order/${numericId}/${userEmail}`;

    this.httpClient.get<ReviewVo>(url).subscribe({
      next: (review) => {
        if (review) {
          this.existingReview = review;
        } else {
          this.existingReview = null;
        }
        // 【修改】無論成功與否，API 回來後都要結束檢查狀態
        this.isCheckingReview = false;
      },
      error: (err) => {
        console.error('查詢既有評論失敗:', err);
        this.existingReview = null;
        // 【修改】發生錯誤時，也要結束檢查狀態
        this.isCheckingReview = false;
      }
    });
  }
  /**
   * [新增方法 1/2] 設定星級評分
   * @param rating 使用者點擊的星數
   */
  setRating(rating: number): void {
    this.reviewRating = rating;
  }

  /**
   * [新增方法 2/2] 提交評論到後端 API
   */
  submitReview(): void {
    // 檢查是否有選定的訂單
    if (!this.selectedOrder) {
      this.triggerAlertService.trigger('沒有選定的訂單', 'error');
      return;
    }
    // 檢查是否已給星
    if (this.reviewRating === 0) {
      this.triggerAlertService.trigger('請至少給予一顆星評價', 'error');
      return;
    }

    const numericId = parseInt(this.selectedOrder.id.replace(/\D/g, ''), 10);

    // 構建要發送到後端的資料
    const reviewData: ReviewsCreateReq = {
      merchants: this.selectedOrder.merchantName,
      rating: this.reviewRating,
      orderId: numericId,
      userName: this.usersServices.currentUserValue?.name || '', // 使用者名稱
      comment: this.reviewComment,
      merchantId: this.selectedOrder.merchantId
    };
    console.log('準備提交評論:', reviewData);

    const url = `${this.reviewsApiUrl}/create`;

    // 呼叫後端 API
    this.httpClient.post<BasicRes>(url, reviewData).subscribe({
      next: (res) => {
        if (res.code === 200) {
          this.triggerAlertService.trigger('感謝您的評論！', 'success');

          // 成功提交後，重新查詢一次該訂單的評論狀態，UI 就會自動更新為「顯示已留評價」的畫面
          this.fetchExistingReview(this.selectedOrder!);

          // 並且，從可評論清單中移除，讓列表頁的按鈕也消失
          this.reviewableOrderIdSet.delete(numericId);
          // this.closeOrderDetails(); // 或者也可以選擇不關閉視窗，讓使用者直接看到他留下的評論
        } else {
          this.triggerAlertService.trigger(res.message, 'error');
        }
      },
       error: (err) => { // 'err' 是 HttpErrorResponse 評論者不能空
        console.error('提交評論失敗:', err); // 保留這個 log，方便未來偵錯

        // 1. 嘗試從後端的回應中，取得巢狀的 message 屬性
        const backendMessage = err.error?.message;

        // 2. 如果有從後端取到具體的錯誤訊息，就用它；否則，才使用通用的預設訊息
        const displayMessage = backendMessage || '提交評論失敗，請稍後再試';

        // 3. 觸發錯誤提示，顯示我們最終決定的訊息
        this.triggerAlertService.trigger(displayMessage, 'error');
      }
    });
  }
}
