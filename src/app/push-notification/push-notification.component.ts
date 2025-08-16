import { Component } from "@angular/core"
import { CommonModule } from "@angular/common"
import { HttpClientService } from "../@http-services/http.service"
import { ActivatedRoute } from '@angular/router';
import { TriggerAlertService } from "../@Services/trigger-alert.service";
// 商品介面定義
interface Product {
  foodItemId?: number
  name: string
  imageUrl: string
  originalPrice: number
  discountedPrice: number
  newPrice: number
  discountPercentage: number
  finalDiscountPercentage: number
  pickupEndTime: string
  defaultHours: number
  category: string
  description: string
  pushNotifications: boolean
}

@Component({
  selector: "app-push-notification",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./push-notification.component.html",
  styleUrls: ["./push-notification.component.scss"],
})
export class PushNotificationComponent {

  constructor(
    private httpClientService: HttpClientService,
    private route: ActivatedRoute,
    public triggerAlertService: TriggerAlertService,
  ) { }

  products: Product[] = [];
  storeId: string | null = null;

  ngOnInit(): void {

    // 正確取得父層路由的參數（storeId）
    this.route.parent?.paramMap.subscribe(params => {
      this.storeId = params.get('storeId');
      console.log('子路由收到父路由 storeId:', this.storeId);
    });

    const merchantsId = this.storeId; // ⛔目前寫死，測試用的，實際應由登入商家ID取得，記得未來替換

    // 直接在這裡呼叫 API
    this.httpClientService.postApi('http://localhost:8080/pushNotificationTokens/getUI', { merchantsId }).subscribe({
      next: (res) => {
        console.log('API 回傳資料:', res);

        this.products = res.dto.map((item: any) => {
          if (!item.foodItemId) {
            console.error('foodItemId 缺失:', item);  // 若無 `foodItemId`，顯示錯誤
          }
          return {
            ...item,
            foodItemId: item.foodItemId,  // 確保映射正確
          };
        });
      },
      error: (err) => {
        console.error('API 發生錯誤:', err)
        console.log('錯誤內容:', err.error); // 看看後端有沒有傳回錯誤訊息
      },
    })
  }

  // 時間日期格式轉換
  formatDate(date: string): string {
    const d = new Date(date); // 將字符串轉換為 Date 物件
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0"); // 確保月份兩位數
    const day = d.getDate().toString().padStart(2, "0"); // 確保日期兩位數
    const hours = d.getHours().toString().padStart(2, "0"); // 確保小時兩位數
    const minutes = d.getMinutes().toString().padStart(2, "0"); // 確保分鐘兩位數

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }

  /**
   * 切換推播通知狀態
   * @param foodItemId 商品ID
   */
  togglePushNotification(foodItemId: number): void {
    console.log('foodItemId:', foodItemId);
    const product = this.products.find(p => p.foodItemId === foodItemId);
    console.log('product:', product);

    if (!product) {
      console.warn(`找不到 ID 為 ${foodItemId} 的商品`);
      return;
    }

    const newPushStatus = !product.pushNotifications;

    // 只有在嘗試「開啟」推播通知時才進行驗證
    if (newPushStatus === true) {
      if (!product.defaultHours || product.defaultHours <= 0) {
        this.triggerAlertService.trigger('推播提前時間必須大於 0', 'error');
        return; // 阻止繼續執行
      }
      if (!product.newPrice || product.newPrice <= 0) {
        this.triggerAlertService.trigger('最終折扣價格必須大於 0', 'error');
        return; // 阻止繼續執行
      }
    }

    const toggleData = {
      foodItemsId: product.foodItemId,
      pushNotifications: newPushStatus,
      defaultHours: product.defaultHours ?? 0,
      newPrice: product.newPrice ?? 0 // 確保後端拿到數字，不是 null
    };

    console.log('切換推播送出資料：', toggleData);

    this.httpClientService.postApi('http://localhost:8080/pushNotificationTokens/toggle', toggleData).subscribe({
      next: (res) => {
        console.log('API 回傳資料：', res);
        this.products = this.products.map(p =>
          p.foodItemId === foodItemId
            ? { ...p, pushNotifications: res.dto?.pushNotifications ?? newPushStatus }
            : p
        );
        this.triggerAlertService.trigger('已成功切換推播狀態', 'success');
      },
      error: (err) => {
        console.error(`切換商品 (ID: ${foodItemId}) 的推播狀態失敗`, err);
        // 失敗時應該顯示錯誤訊息，而非成功訊息
        this.triggerAlertService.trigger('切換推播狀態失敗，請稍後再試', 'error');
      }
    });
  }

  /**
   * 更新最終折扣價格
   * @param productId 商品ID
   * @param event 輸入事件
   */
  updateFinalDiscountPrice(foodItemId: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const newPrice = Number.parseInt(target.value);

    if (newPrice > 0) {
      this.products = this.products.map((product) => {
        if (product.foodItemId === foodItemId) {
          const finalDiscountPercentage = Math.round(((product.originalPrice - newPrice) / product.originalPrice) * 100)

          return {
            ...product,
            newPrice: newPrice,
            finalDiscountPercentage,
          };
        }
        return product;
      });
    }
  }

  /**
   * 更新推播提前時間
   * @param productId 商品ID
   * @param event 輸入事件
   */
  updatePushNotificationHours(foodItemId: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const hours = Number.parseInt(target.value);

    if (hours >= 1 && hours <= 24) {
      this.products = this.products.map((product) =>
        product.foodItemId === foodItemId ? { ...product, defaultHours: hours } : product,
      );
    }
  }

  /**
   * 格式化日期時間顯示
   * @param dateTime 日期時間字串
   * @returns 格式化後的日期時間
   */
  formatDateTime(dateTime: string): string {
    const date = new Date(dateTime)
    return date.toLocaleString("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
}
