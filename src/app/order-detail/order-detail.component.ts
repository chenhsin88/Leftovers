import { Component, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import { ActivatedRoute, Router } from "@angular/router"
import { HttpClientService } from "../@http-services/http.service"
import { FormsModule } from "@angular/forms";
import { MerchantsService } from "../@Services/merchants.service";
import { TriggerAlertService } from "../@Services/trigger-alert.service";

interface OrderFoodItem {
  merchantsId: number;
  orderId: number;
  foodId: number;
  quantity: number;
  foodName: string;
  foodPrice: number;
}

interface OrderData {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  pickupCode: string;
  customerNote?: string;
  orderTime: string;
  cancellationReason?: string;
  rejectReason?: string;
  updatedAt: string;
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
    foodPrice: number;
  }[];
  // 新增從後端取得的欄位
  orderId?: number; // 後端傳來的訂單 ID
  userName?: string; // 用戶名稱
  paymentMethodSimulated?: string; // 模擬付款方式
  notesToMerchant?: string; // 商家備註
  orderedAt?: string; // 訂單時間
  orderFoodItemList?: OrderFoodItem[]; // 訂單的食物項目
}


@Component({
  selector: "app-order-detail",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./order-detail.component.html",
  styleUrls: ["./order-detail.component.scss"],
})
export class OrderDetailComponent implements OnInit {
  orderData: OrderData | null = null;
  isLoading = true;
  merchantRejectReason: string = '';
  hasSubmittedRejection = false;
  hasApprovedCancellation = false;
  originalOrderNumber: string = ''; // 新增一個屬性來存儲原始的 orderNumber（包含 RF 前綴）
  storeId: string | null = null;
  // ✨ 新增一個屬性來儲存返回地址
  private returnUrl: string = '';

  // 新增一個屬性來判斷是否為歷史訂單
  isHistoryOrder: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private httpClientService: HttpClientService,
    private merchantsService: MerchantsService,
    public triggerAlertService: TriggerAlertService
  ) { }

  ngOnInit() {

    // ✨【新增邏輯】在元件初始化時，從 URL 查詢參數中獲取 returnUrl
    this.route.queryParamMap.subscribe(params => {
      // 從父路由快照中獲取 storeId，用於建立備用的返回路徑
      const currentStoreId = this.route.snapshot.paramMap.get('storeId');
      const defaultReturnUrl = currentStoreId ? `/merchants/${currentStoreId}/orders` : '/storeList';

      // 如果 URL 中有 returnUrl，就使用它；否則使用我們剛剛建立的備用路徑
      this.returnUrl = params.get('returnUrl') || defaultReturnUrl;
      console.log(`此頁面的返回路徑已設定為: ${this.returnUrl}`);
    });

    this.route.params.subscribe((params) => {
      const orderNumber = params['orderNumber'];
      if (!orderNumber) {
        this.router.navigate(['/orders']);
        return;
      }

      this.storeId = this.merchantsService.getStoreId();
      console.log('OrderDetailComponent 中獲取的 storeId:', this.storeId);
      console.log('OrderDetailComponent 中獲取的 orderNumber:', orderNumber);

      this.isLoading = true;

      // 判斷是否為歷史訂單（RF 開頭）並賦值給 isHistoryOrder
      this.isHistoryOrder = orderNumber.startsWith('RF') || orderNumber.startsWith('RC') || orderNumber.startsWith('RN');
      const actualOrderNumber = this.isHistoryOrder ? orderNumber.slice(2) : orderNumber;
      this.originalOrderNumber = orderNumber;

      const apiUrl = this.isHistoryOrder
        ? `http://localhost:8080/historyOrder/getHistoryOrder/${this.originalOrderNumber}`
        : `http://localhost:8080/orders/getOrderInformation/${actualOrderNumber}`;

      this.httpClientService.getApi<any>(apiUrl).subscribe({
        next: (data) => {
          console.log('API 回傳資料:', data);

          const isHistoryOrderResponse = Array.isArray(data.historyOrderlist);

          if (isHistoryOrderResponse) {
            const firstItem = data.historyOrderlist[0];
            if (firstItem) {
              this.orderData = {
                orderNumber: firstItem.orderId ?? orderNumber,
                customerName: firstItem.userName ?? '未知顧客',
                totalAmount: !isNaN(firstItem.foodPrice) && !isNaN(firstItem.quantity)
                  ? firstItem.foodPrice * firstItem.quantity
                  : 0,
                status: firstItem.status ?? '未知狀態',
                paymentMethod: firstItem.paymentMethodSimulated ?? '未知',
                pickupCode: firstItem.pickupCode ?? '',
                customerNote: firstItem.notesToMerchant ?? '',
                orderTime: (() => {
                  const rawDate = firstItem.createdAt;
                  if (rawDate) {
                    const d = new Date(rawDate);
                    return !isNaN(d.getTime()) ? this.formatDate(d.toISOString()) : '';
                  }
                  return '';
                })(),
                cancellationReason: firstItem.cancellationReason ?? '',
                // 歷史訂單的 rejectReason 直接從後端回傳
                rejectReason: firstItem.rejectReason ?? '',
                updatedAt: this.formatDate(new Date().toISOString()),
                items: [
                  {
                    itemId: firstItem.foodId?.toString() ?? '',
                    itemName: firstItem.foodName ?? '未命名商品',
                    quantity: firstItem.quantity ?? 0,
                    foodPrice: firstItem.foodPrice ?? 0,
                  }
                ],
                orderFoodItemList: data.historyOrderlist ?? [],
              };
            }
          } else {
            const firstItem = data;
            if (firstItem) {
              this.orderData = {
                orderNumber: firstItem.orderId ?? orderNumber,
                customerName: firstItem.userName ?? '未知顧客',
                totalAmount: firstItem.totalAmount ?? 0,
                status: firstItem.status ?? '未知狀態',
                paymentMethod: firstItem.paymentMethodSimulated ?? firstItem.paymentMethod ?? '未知',
                pickupCode: firstItem.pickupCode ?? '',
                customerNote: firstItem.notesToMerchant ?? '',
                orderTime: (() => {
                  const rawDate = firstItem.orderedAt ?? firstItem.createdAt;
                  if (rawDate) {
                    const d = new Date(rawDate);
                    return !isNaN(d.getTime()) ? this.formatDate(d.toISOString()) : '';
                  }
                  return '';
                })(),
                cancellationReason: firstItem.cancellationReason ?? '',
                rejectReason: firstItem.rejectReason ?? '',
                updatedAt: this.formatDate(new Date().toISOString()),
                items: firstItem.orderFoodItemList?.map((item: any) => ({
                  itemId: item.foodId?.toString() ?? '',
                  itemName: item.foodName ?? '未命名商品',
                  quantity: item.quantity ?? 0,
                  foodPrice: item.foodPrice ?? item.unitPrice ?? 0,
                })) ?? [],
                orderFoodItemList: firstItem.orderFoodItemList ?? [],
              };
            }
          }

          this.isLoading = false;
        },
        error: (error) => {
          console.error(`❌ 無法獲取訂單 ${orderNumber} 的資料`, error);
          this.isLoading = false;
        }
      });
    });
  }

  // 時間日期格式轉換
  private formatDate(date: string): string {
    const d = new Date(date); // 將字符串轉換為 Date 物件
    const year = d.getFullYear(); // 使用本地時間的年份
    const month = (d.getMonth() + 1).toString().padStart(2, "0"); // 使用本地時間的月份
    const day = d.getDate().toString().padStart(2, "0"); // 使用本地時間的日期
    const hours = d.getHours().toString().padStart(2, "0"); // 使用本地時間的小時
    const minutes = d.getMinutes().toString().padStart(2, "0"); // 使用本地時間的分鐘

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }


  trackByItem(index: number, item: any): string {
    return `${item?.itemId ?? 'no-id'}-${index}`;
  }

  /**
  * ✨【全新、穩健的返回方法】
  * 這個方法現在不再需要判斷訂單編號，邏輯非常簡單
  */
  goBack(): void {
    console.log(`執行返回，導航至: ${this.returnUrl}`);
    // 直接使用 Router 導航到儲存好的 returnUrl
    this.router.navigateByUrl(this.returnUrl);
  }

  /**
  * 訂單完成邏輯
  */
  markOrderComplete(): void {
    if (
      this.orderData &&
      this.orderData.status !== 'completed' &&
      this.orderData.status !== 'cancelled_by_user' &&
      this.orderData.status !== 'cancelled_by_merchant'
    ) {

      console.log('orderData:', this.orderData);
      // 檢查必要資料是否存在
      if (!this.orderData.orderNumber || !this.orderData.pickupCode) {
        console.error('缺少 orderNumber 或 pickupCode，無法更新訂單狀態');
        return;
      }

      const updateStatusData = {
        orderId: this.orderData.orderNumber,
        pickupCode: this.orderData.pickupCode,
        status: 'completed'
      };
      console.log(updateStatusData);

      this.httpClientService.postApi('http://localhost:8080/orders/updateStatus', updateStatusData).subscribe({
        next: (res) => {
          // 成功後更新畫面狀態
          this.orderData!.status = 'completed';
          this.orderData!.updatedAt = this.formatDate(new Date().toISOString());
          console.log(`✅ 訂單 ${this.orderData!.orderNumber} 已完成`);
          this.triggerAlertService.trigger('已完成訂單', 'success');
        },
        error: (err) => {
          console.error('❌ 更新訂單狀態失敗：', err);
          this.triggerAlertService.trigger('完成訂單失敗，請稍後再試', 'error');
        }
      });
    }
  }

  /**
    * ✨【修正後】標記為未取餐
    */
  markAsNotTaken(): void {
    if (!this.orderData || !this.orderData.orderNumber) {
      console.error('缺少訂單資料，無法標記為未取餐');
      return;
    }

    const orderId = this.orderData.orderNumber;
    const apiUrl = `http://localhost:8080/orders/notToken?orderId=${orderId}`;

    // 後續的 API 呼叫邏輯完全不變
    this.httpClientService.postApi(apiUrl, null).subscribe({
      next: (res) => {
        console.log(`✅ 訂單 ${orderId} 已成功標記為未取餐`, res);
        this.triggerAlertService.trigger('已成功標記為未取餐', 'success');

        this.orderData!.status = 'not_token';
        this.orderData!.updatedAt = this.formatDate(new Date().toISOString());
      },
      error: (err) => {
        console.error(`❌ 標記訂單 ${orderId} 為未取餐失敗`, err);
        const errorMessage = err.error?.message || '操作失敗，請稍後再試';
        this.triggerAlertService.trigger(`${errorMessage}`, 'error', 5000);
      }
    });
  }

  /**
   * 判斷是否顯示商家拒絕原因的輸入框
   * 只有在不是歷史訂單，且訂單狀態為 'cancelled_by_user' 且還未提交拒絕理由時顯示
   */
  shouldShowMerchantRejectInput(): boolean {
    if (!this.orderData) return false;
    // 只有在不是歷史訂單，且狀態是使用者取消，且還沒有提交過拒絕原因，才能顯示輸入框
    return !this.isHistoryOrder && this.orderData.status === 'cancelled_by_user' && !this.hasSubmittedRejection;
  }

  /**
   * 判斷是否顯示後端回傳的拒絕原因（歷史訂單或已處理的即時訂單）
   */
  shouldShowBackendRejectReason(): boolean {
    if (!this.orderData) return false;
    // 只要後端有回傳 rejectReason (無論是否為歷史訂單)，就應該顯示
    return !!this.orderData.rejectReason;
  }

  // 您原有的 rejectOrderCancellation 方法
  rejectOrderCancellation(reason: string) {
    if (!this.isRejectReasonValid() || !this.orderData) return;

    const merchantRejectData = {
      orderId: Number(this.orderData.orderNumber), // 從 orderNumber 轉成數字
      rejectReason: reason
    };

    console.log('駁回取消原因 merchantRejectData:', merchantRejectData);

    this.httpClientService.postApi('http://localhost:8080/orders/reject', merchantRejectData).subscribe({
      next: (res) => {
        console.log('✅ 駁回成功：', res);
        this.triggerAlertService.trigger('已成功拒絕取消訂單', 'success');
        this.hasSubmittedRejection = true;
        // 更新訂單狀態為商家拒絕
        this.orderData!.status = 'pending';
        this.orderData!.rejectReason = reason; // 更新本地的拒絕原因
        this.orderData!.updatedAt = this.formatDate(new Date().toISOString()); // 更新最後更新時間
      },
      error: (err) => {
        console.error('❌ 駁回失敗：', err);
        this.triggerAlertService.trigger('拒絕取消訂單失敗，請稍後再試', 'error');
      }
    });
  }

  // 檢查拒絕原因是否有效
  isRejectReasonValid(): boolean {
    return this.merchantRejectReason.trim().length > 0;
  }

  // 處理同意取消訂單的方法 (這部分您沒有提供，但通常會和 rejectOrderCancellation 一起出現)
  // in order-detail.component.ts

  markOrderCanceled(): void {
    // 檢查的邏輯保持不變
    if (!this.orderData || !this.orderData.orderNumber || !this.orderData.pickupCode) {
      console.error('缺少訂單資料、訂單編號或取餐碼，無法執行取消操作');
      this.triggerAlertService.trigger('訂單資料不完整，無法執行操作', 'error');
      return;
    }

    // 建立與 working function (markOrderComplete) 結構一致的 payload
    const cancellationData = {
      orderId: Number(this.orderData.orderNumber),
      status: 'cancelled_by_merchant',// 商家同意取消
      pickupCode: this.orderData.pickupCode,
      cancellationReason: this.orderData.cancellationReason || '商家同意取消', // ✅ 加入取消原因，可依實際需求調整

    };

    this.httpClientService.postApi('http://localhost:8080/orders/cancell', cancellationData).subscribe({
      next: (res) => {
        console.log('✅ 商家已同意取消訂單：', res);
        this.triggerAlertService.trigger('已同意取消訂單', 'success');
        this.hasApprovedCancellation = true;
        this.orderData!.status = 'cancelled_by_merchant';
        this.orderData!.updatedAt = this.formatDate(new Date().toISOString());
      },
      error: (err) => {
        console.error('❌ 同意取消訂單失敗：', err);
        this.triggerAlertService.trigger('同意取消訂單失敗，請稍後再試', 'error');
      }
    });
  }

  // 判斷是否禁用同意取消按鈕的邏輯
  shouldDisableCancelApproval(): boolean {
    // 如果商家有輸入拒絕原因，或已經提交拒絕/同意，則禁用同意取消按鈕
    return this.merchantRejectReason.trim().length > 0 || this.hasSubmittedRejection || this.hasApprovedCancellation;
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
      case "not_token": // ✨【新增】
        return "未取餐";
      default:
        return ""
    }
  }

  // 訂單狀態 Class （從您原有的 HTML 中提取並移到 TS）
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
      case "not_token": // ✨【新增】
        return `${baseClass} not-token`;
      default:
        return ""
    }
  }

  /**
   * ✅ [新增] 將付款方式代碼轉換為中文顯示文字
   * @param method 付款方式代碼 (e.g., 'CASH', 'CREDIT_CARD')
   * @returns 對應的中文文字
   */
  getPaymentMethodText(method: string): string {
    if (!method) {
      return '未知';
    }
    switch (method.toUpperCase()) {
      case 'CASH':
        return '現金';
      case 'CREDIT_CARD':
        return '信用卡';
      default:
        return method; // 如果不是預期的值，直接回傳原始值
    }
  }

  // 計算小計 (從您原有的 HTML 中提取並移到 TS)
  calculateSubtotal(foodPrice: number, quantity: number): number {
    return foodPrice * quantity;
  }
}
